import { NextResponse } from "next/server";
import { normalizeParsedMenu } from "@/lib/menuParsing";

/**
 * AI menu scanner: one uploaded menu (photo, PDF, CSV) in, sections and dishes
 * with their option groups out.
 *
 * Reading a dense PDF regularly takes longer than a serverless host's default
 * function timeout, which cut the scan off mid-answer.
 */
export const maxDuration = 60;

const GEMINI_MODEL = "gemini-2.5-flash";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://app.nowlny.com/api/v1";

/** Machine-readable reasons the client branches on (the text is for logs). */
type ErrorCode = "unauthorized" | "missing_key" | "bad_request" | "upstream" | "internal";

const fail = (code: ErrorCode, error: string, status: number) =>
  NextResponse.json({ code, error }, { status });

/**
 * Only a signed-in restaurant owner may spend the server's Gemini key.
 *
 * The route used to be open to anyone who found the URL. The token is checked
 * against the API rather than just for presence, because "Bearer x" costs an
 * attacker nothing and a menu scan costs us real money.
 */
async function isSignedIn(authHeader: string): Promise<boolean | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/restaurants/me`, {
      headers: { Authorization: authHeader },
      cache: "no-store",
    });
    if (response.status === 401 || response.status === 403) return false;
    // 404 is a signed-in partner with no restaurant yet: authenticated, and
    // the menu page won't render for them anyway.
    return response.ok || response.status === 404;
  } catch {
    return null;
  }
}

const PROMPT = `
You are an expert menu digitizer. Analyze the attached menu (a photo of a flyer, a PDF, or a spreadsheet) and extract every dish into categories (e.g. Appetizers, Main Dishes, Drinks, Desserts).

Dishes:
1. Extract every dish, sweet, appetizer and beverage. Keep names, descriptions, categories and modifiers in the menu's own language — never translate.
2. Clean up dish names. If a price is embedded in a name, move it to "price".
3. "price" is a number with no currency symbol. If no price is printed, use 0.
4. Use the description the menu prints. If it prints none, you may write one short factual line; never invent ingredients you cannot see.
5. Sizes are the one exception to rule 6: when a dish is priced per size, return ONE ITEM PER SIZE with the size in its name (e.g. "Margherita - Large").

Modifiers — the choices a customer makes about a dish:
6. Extras, add-ons, toppings, sauces, sides, bread, cooking level, "choose 2", "with or without" belong in that dish's "optionGroups". They are NEVER dishes of their own: never return "Extra cheese" or "Add pickles" as a dish.
7. For each group give its "name" and its "options", each option with a "name" and a "price". An option's price is what it ADDS to the dish: a free choice is 0, "+2" or "add 2" is 2.
8. "type" is "radio" when the customer picks exactly one (dough, cooking level, bread) and "checkbox" when they may pick several (toppings, extras, sauces). "isRequired" is true only when the dish cannot be ordered without answering.
9. A block of extras printed once for a whole section ("all burgers: add cheese 1") belongs on every dish in that section.

Respond strictly with JSON matching this schema:
{
  "categories": [
    {
      "name": "Category name",
      "items": [
        {
          "name": "Dish name",
          "description": "Dish description",
          "price": 12.99,
          "optionGroups": [
            { "name": "Group name", "type": "checkbox", "isRequired": false, "options": [{ "name": "Choice", "price": 0 }] }
          ]
        }
      ]
    }
  ]
}
`;

/** Gemini's own error text, unwrapped from its JSON envelope when possible. */
const geminiErrorMessage = (body: string): string => {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: unknown } };
    if (typeof parsed.error?.message === "string") return parsed.error.message;
  } catch {
    /* not JSON — the raw text is the best we have */
  }
  return body.slice(0, 500);
};

/** The first JSON object in the model's answer, tolerating stray prose around it. */
const parseModelJson = (text: string): unknown => {
  try {
    return JSON.parse(text.trim());
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
};

export async function POST(request: Request) {
  // Gate first — before reading the body, so an unauthenticated caller can't
  // even make us buffer a multi-megabyte upload.
  const authHeader = request.headers.get("authorization") ?? "";
  if (!/^bearer\s+\S+/i.test(authHeader)) {
    return fail("unauthorized", "You must be signed in to use the AI menu scanner.", 401);
  }
  const signedIn = await isSignedIn(authHeader);
  if (signedIn === false) {
    return fail("unauthorized", "Your session has expired. Please sign in again.", 401);
  }
  if (signedIn === null) {
    return fail("upstream", "Could not verify your session. Please try again.", 502);
  }

  let body: { fileData?: unknown; mimeType?: unknown; customApiKey?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail("bad_request", "The request body was not valid JSON.", 400);
  }

  const fileData = typeof body.fileData === "string" ? body.fileData : "";
  const mimeType = typeof body.mimeType === "string" && body.mimeType ? body.mimeType : "image/png";
  const customApiKey = typeof body.customApiKey === "string" ? body.customApiKey.trim() : "";

  if (!fileData) {
    return fail("bad_request", "No file data received in request.", 400);
  }

  // An owner's own key wins when they typed one; otherwise the server's.
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return fail("missing_key", "The AI menu scanner is not configured on this server.", 503);
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // A header rather than `?key=`, so the key stays out of URL logs.
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: PROMPT }, { inlineData: { mimeType, data: fileData } }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            // Low temperature: this is transcription, not writing.
            temperature: 0.1,
          },
        }),
      },
    );

    if (!response.ok) {
      const message = geminiErrorMessage(await response.text());
      // Passing Gemini's 400/403 straight through would make a bad key look
      // like a bad request from our own client.
      return fail("upstream", message, 502);
    }

    const result = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return fail("upstream", "The AI model returned an empty answer.", 502);
    }

    const parsed = parseModelJson(text);
    if (!parsed) {
      return fail("upstream", "The AI model's answer could not be read as a menu.", 502);
    }

    return NextResponse.json(normalizeParsedMenu(parsed));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return fail("internal", `Internal Server Error: ${message}`, 500);
  }
}
