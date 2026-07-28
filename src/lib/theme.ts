"use client";

import { useSyncExternalStore } from "react";

/* ---------------------------------------------------------------------------
   Light / dark theme.

   The palette already lived in CSS custom properties, but the dark values were
   locked behind `@media (prefers-color-scheme: dark)` — so the app followed the
   OS and the operator had no say. The same variables now hang off a `dark`
   class on <html>, which the pre-paint script in `app/layout.tsx` sets before
   the first frame (stored choice first, OS preference as the fallback).

   State is read straight back off that class through `useSyncExternalStore`
   rather than mirrored into React state: the DOM is already the source of
   truth by the time React boots, and reading it avoids a mount-effect that
   would repaint the whole shell one frame late.
--------------------------------------------------------------------------- */

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "nowlny_theme";

const listeners = new Set<() => void>();

/** The single source of truth for what "dark mode is on" means in the DOM. */
export function applyThemeClass(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};

// A primitive, so React's identity check settles immediately.
const getSnapshot = (): Theme =>
  document.documentElement.classList.contains("dark") ? "dark" : "light";

// The server has no way to know the operator's choice, so it renders light and
// the class set by the pre-paint script takes over on hydration.
const getServerSnapshot = (): Theme => "light";

export function setTheme(next: Theme) {
  applyThemeClass(next);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    /* private mode / blocked storage — the session still switches */
  }
  listeners.forEach((listener) => listener());
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    theme,
    isDark: theme === "dark",
    setTheme,
    toggleTheme: () => setTheme(theme === "dark" ? "light" : "dark"),
  };
}
