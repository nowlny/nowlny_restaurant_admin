/**
 * Cleanup for whatever the Gemini menu scanner returns.
 *
 * The model answers free-form JSON, so nothing it sends can be trusted to be
 * the right type: prices arrive as `"12.99 $"`, items arrive with no name, and
 * headings arrive with nothing under them. Everything the import writes to the
 * live menu goes through here first — on the server, so the client only ever
 * renders the shape below.
 *
 * Ported from the super-admin panel's `menuParsing.ts`, minus the storefront
 * adapters and the ingredients pass, which this dashboard does not use.
 */

/** One choice a customer can pick. `price` is what it adds to the dish. */
export interface ParsedOption {
  name: string;
  price: number;
}

/** `radio` = pick exactly one, `checkbox` = any number — the platform's meaning. */
export interface ParsedOptionGroup {
  name: string;
  type: "radio" | "checkbox";
  isRequired: boolean;
  options: ParsedOption[];
}

export interface ParsedItem {
  name: string;
  description?: string;
  price: number;
  /** Left out entirely when the dish has no modifiers. */
  optionGroups?: ParsedOptionGroup[];
}

export interface ParsedCategory {
  name: string;
  items: ParsedItem[];
}

export interface ParsedMenu {
  categories: ParsedCategory[];
}

/**
 * Ceilings on what one dish can carry out of a source we do not control. A
 * dish with 40 groups is a payload we have misread, and each group is an API
 * call against the restaurant being onboarded.
 */
const MAX_GROUPS_PER_ITEM = 20;
const MAX_OPTIONS_PER_GROUP = 60;

/** Arabic, Persian and Urdu letters — enough to tell the script apart. */
const ARABIC_SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

function asText(value: unknown, maxChars: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxChars) : "";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Arabic menus routinely print prices in Arabic-Indic numerals (`٢٥٫٥٠`), which
 * `Number()` reads as NaN. Fold them to ASCII, mapping the Arabic decimal and
 * thousands separators onto the `.` / `,` the parser below understands.
 */
function toAsciiDigits(text: string): string {
  return text
    .replace(/[٠-٩۰-۹]/g, (digit) => {
      const code = digit.charCodeAt(0);
      return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
    })
    .replace(/٫/g, ".")
    .replace(/٬/g, ",");
}

/**
 * Prices come back however they were printed: `12.99`, `"12,50 EGP"`,
 * `"$ 1,299.50"`, `"1.299,50"`. Anything unreadable becomes 0, which the owner
 * then sees as a zero-priced dish in the preview rather than a silently wrong
 * number on the live menu.
 */
export function parsePrice(value: unknown): number {
  let text: string;
  if (typeof value === "number") {
    text = String(value);
  } else if (typeof value === "string") {
    text = toAsciiDigits(value).replace(/[^\d.,]/g, "");
  } else {
    return 0;
  }

  const hasComma = text.includes(",");
  const dots = (text.match(/\./g) || []).length;

  if (hasComma && dots > 0) {
    // Whichever separator comes last is the decimal one: "1,299.50" vs "1.299,50".
    text =
      text.lastIndexOf(",") > text.lastIndexOf(".")
        ? text.replace(/\./g, "").replace(",", ".")
        : text.replace(/,/g, "");
  } else if (hasComma) {
    // "12,50" is a decimal comma; "1,299" is a thousands separator.
    text = /,\d{1,2}$/.test(text) ? text.replace(",", ".") : text.replace(/,/g, "");
  } else if (dots > 1) {
    // "1.299.50" — dots for thousands, the last one for cents.
    const cents = text.lastIndexOf(".");
    text = text.slice(0, cents).replace(/\./g, "") + text.slice(cents);
  }

  const price = Number(text);
  return Number.isFinite(price) && price > 0 ? Number(price.toFixed(2)) : 0;
}

/**
 * Shape whatever modifiers came back into groups the platform can create.
 *
 * Also accepts the flat `addons: [{ name, price }]` list the previous prompt
 * asked for, so a model that falls back to the old shape still imports its
 * extras instead of dropping them.
 */
function normalizeOptionGroups(item: Record<string, unknown>): ParsedOptionGroup[] {
  const raw = asArray(item.optionGroups);
  const legacyAddons = asArray(item.addons);
  const groups =
    raw.length === 0 && legacyAddons.length > 0
      ? [{ name: "Add-ons", type: "checkbox", isRequired: false, options: legacyAddons }]
      : raw;

  return groups
    .slice(0, MAX_GROUPS_PER_ITEM)
    .map((rawGroup): ParsedOptionGroup | null => {
      const group = asRecord(rawGroup);
      const name = asText(group.name, 120);
      if (!name) return null;

      const isRequired = group.isRequired === true;
      const seen = new Set<string>();
      const options = asArray(group.options)
        .slice(0, MAX_OPTIONS_PER_GROUP)
        .map((rawOption): ParsedOption | null => {
          const option = asRecord(rawOption);
          const optionName = asText(option.name, 120);
          if (!optionName) return null;
          // The same choice twice would reach the storefront as two identical
          // radio buttons.
          const key = optionName.toLowerCase();
          if (seen.has(key)) return null;
          seen.add(key);
          return { name: optionName, price: parsePrice(option.price) };
        })
        .filter((option): option is ParsedOption => option !== null);

      // An empty group would reach the storefront as a question with no answers.
      if (options.length === 0) return null;

      // A source that says which kind it is wins; otherwise a group the
      // customer *must* answer can only sensibly be a single choice.
      const claimed = asText(group.type, 10).toLowerCase();
      const type =
        claimed === "radio" || claimed === "checkbox"
          ? claimed
          : isRequired
            ? "radio"
            : "checkbox";

      return { name, type, isRequired, options };
    })
    .filter((group): group is ParsedOptionGroup => group !== null);
}

/** Shape whatever the model returned into the contract the client renders. */
export function normalizeParsedMenu(raw: unknown): ParsedMenu {
  const samples: string[] = [];

  const categories = asArray(asRecord(raw).categories)
    .map((rawCategory) => {
      const category = asRecord(rawCategory);
      const name = asText(category.name, 120);
      if (name) samples.push(name);

      const items = asArray(category.items)
        .map((rawItem): ParsedItem | null => {
          const item = asRecord(rawItem);
          const itemName = asText(item.name, 200);
          if (!itemName) return null;
          samples.push(itemName);

          const description = asText(item.description, 600);
          const optionGroups = normalizeOptionGroups(item);
          return {
            name: itemName,
            ...(description ? { description } : {}),
            price: parsePrice(item.price),
            ...(optionGroups.length ? { optionGroups } : {}),
          };
        })
        .filter((item): item is ParsedItem => item !== null);

      return { name, items };
    })
    // A heading the OCR picked up with nothing under it would import as an
    // empty section the owner then has to delete by hand.
    .filter((category) => category.items.length > 0);

  // A section still needs a name to be created, and the stand-in should be
  // written in the menu's own language like everything around it.
  const arabic =
    samples.length > 0 &&
    samples.filter((sample) => ARABIC_SCRIPT.test(sample)).length / samples.length >= 0.3;
  const fallbackName = arabic ? "أصناف أخرى" : "Other items";

  return {
    categories: categories.map((category) => ({
      ...category,
      name: category.name || fallbackName,
    })),
  };
}
