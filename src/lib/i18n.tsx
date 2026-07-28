"use client";

import { useSyncExternalStore } from "react";
import { en, type MessageKey } from "./locales/en";
import { ar } from "./locales/ar";

/* ---------------------------------------------------------------------------
   English / Arabic localisation.

   Arabic is written right-to-left, so switching language also flips the
   document direction — `dir="rtl"` on <html>. Most of this app positions with
   flexbox and logical CSS properties, so the mirror comes for free; the cases
   that don't are listed under "RTL" in globals.css.

   Like the theme, the active locale is read back off <html> through
   `useSyncExternalStore` instead of being mirrored into React state. The
   pre-paint script in `app/layout.tsx` has already applied the stored locale by
   the time React hydrates, so the DOM is the honest source of truth and no
   provider has to be threaded through the tree.

   Keys are flat and namespaced by surface (`nav.`, `orders.`, `common.`) so a
   missing translation is obvious in review rather than silently English.
--------------------------------------------------------------------------- */

export type Locale = "en" | "ar";

export const LOCALES: { value: Locale; label: string; nativeLabel: string }[] = [
  { value: "en", label: "English", nativeLabel: "EN" },
  { value: "ar", label: "العربية", nativeLabel: "ع" },
];

export const LOCALE_STORAGE_KEY = "nowlny_locale";

export type { MessageKey };

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { en, ar };

type Vars = Record<string, string | number>;

export const isLocale = (value: unknown): value is Locale =>
  value === "en" || value === "ar";

export const dirFor = (locale: Locale): "ltr" | "rtl" =>
  locale === "ar" ? "rtl" : "ltr";

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Vars,
): string {
  const template = DICTIONARIES[locale][key] ?? en[key];
  // A key with no entry at all is a bug; render it rather than an empty gap so
  // it is obvious on screen instead of silently blank.
  if (template === undefined) return key;
  return interpolate(template, vars);
}

/**
 * Applies language + direction to <html>.
 *
 * Kept outside React so the pre-paint script in `layout.tsx` can run the same
 * logic before the first frame — otherwise an Arabic operator gets a
 * left-to-right flash of the whole dashboard on every load.
 */
export function applyLocaleToDocument(locale: Locale) {
  const root = document.documentElement;
  root.lang = locale;
  root.dir = dirFor(locale);
}

const listeners = new Set<() => void>();

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};

const getSnapshot = (): Locale =>
  document.documentElement.lang === "ar" ? "ar" : "en";

const getServerSnapshot = (): Locale => "en";

export function setLocale(next: Locale) {
  applyLocaleToDocument(next);
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
  } catch {
    /* private mode / blocked storage — the session still switches */
  }
  listeners.forEach((listener) => listener());
}

export function useI18n() {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    locale,
    setLocale,
    t: (key: MessageKey, vars?: Vars) => translate(locale, key, vars),
    dir: dirFor(locale),
    isRTL: locale === "ar",
  };
}

/**
 * Locale tag for `Intl` / `toLocaleString`. Arabic numerals stay Western
 * (`-u-nu-latn`) because prices, order numbers and phone numbers are read
 * against the POS and the printed receipt, which are Latin-digit.
 */
export const intlLocale = (locale: Locale): string =>
  locale === "ar" ? "ar-LB-u-nu-latn" : "en-US";
