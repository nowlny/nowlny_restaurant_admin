import { NextResponse } from "next/server";
import {
  embedUrl,
  InstagramError,
  type InstagramMedia,
  instagramShortcode,
  parseEmbedHtml,
} from "@/lib/instagram";
import { uploadFromUrl, videoPosterUrl } from "@/lib/reelMedia";

/**
 * Turning a public Instagram reel link into a video we host.
 *
 * The browser can't read the reel page (cross-origin), and the fbcdn media
 * links inside it are signed with an `oe=` expiry — stored as-is they would
 * play for a few days and then die. So the clip is found on the embed page
 * here and Cloudinary is asked to copy it while the link is still valid.
 *
 * Deliberately narrow: only instagram.com post/reel links are accepted (the
 * media URL then comes from Instagram's own response, never the caller), and
 * a caller must be signed in.
 */

export const maxDuration = 60;

const PAGE_TIMEOUT_MS = 12_000;

/**
 * Not a desktop browser: a full desktop Chrome User-Agent is served the
 * JavaScript app shell with no media in it. Meta's link-preview crawler gets
 * the server-rendered embed; mobile Safari is the fallback.
 */
const PAGE_USER_AGENTS = [
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
];

async function readEmbed(shortcode: string): Promise<InstagramMedia> {
  let lastError: unknown;
  for (const userAgent of PAGE_USER_AGENTS) {
    try {
      const res = await fetch(embedUrl(shortcode), {
        headers: { "User-Agent": userAgent, "Accept-Language": "en" },
        signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      });
      if (!res.ok) throw new InstagramError("unavailable", `Instagram answered ${res.status}.`);
      return parseEmbedHtml(await res.text(), shortcode);
    } catch (error) {
      // A photo post is a real answer, not a reason to ask again.
      if (error instanceof InstagramError && error.reason === "not_video") throw error;
      lastError = error;
    }
  }
  throw lastError;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!/^bearer\s+\S+/i.test(authHeader)) {
    return NextResponse.json(
      { error: "You must be signed in to import an Instagram reel." },
      { status: 401 },
    );
  }

  let url = "";
  try {
    const body = await request.json();
    url = typeof body?.url === "string" ? body.url.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const shortcode = instagramShortcode(url);
  if (!shortcode) {
    return NextResponse.json({ error: "That isn't an Instagram reel or post link." }, { status: 400 });
  }

  let media: InstagramMedia;
  try {
    media = await readEmbed(shortcode);
  } catch (error) {
    if (error instanceof InstagramError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.reason === "not_video" ? 422 : 404 },
      );
    }
    console.warn(`[instagram-reel] ${shortcode}: page fetch failed`, error);
    return NextResponse.json(
      { error: "Instagram couldn't be reached. Try again in a moment." },
      { status: 502 },
    );
  }

  let videoUrl: string;
  try {
    videoUrl = await uploadFromUrl(media.videoUrl, "video");
  } catch (error) {
    console.warn(`[instagram-reel] ${shortcode}: video copy failed`, error);
    return NextResponse.json(
      { error: "The reel was found but couldn't be copied. Download it and upload the file instead." },
      { status: 502 },
    );
  }

  // The creator's cover beats an arbitrary first frame, but it is optional.
  let thumbnailUrl = videoPosterUrl(videoUrl);
  if (media.thumbnailUrl) {
    try {
      thumbnailUrl = await uploadFromUrl(media.thumbnailUrl, "image");
    } catch (error) {
      console.info(`[instagram-reel] ${shortcode}: cover copy failed, using a video frame`, error);
    }
  }

  return NextResponse.json({ videoUrl, thumbnailUrl, caption: media.caption, owner: media.owner });
}
