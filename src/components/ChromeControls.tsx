"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { LOCALES, useI18n } from "@/lib/i18n";

/**
 * Theme and language switches.
 *
 * They travel together because they are the only two controls that change the
 * whole shell rather than the screen you are on, and because both have to be
 * reachable from the signed-out screens too — an Arabic operator needs to
 * switch language *before* logging in, not after.
 */

export function ThemeToggle() {
  const { isDark, toggleTheme } = useTheme();
  const { t } = useI18n();
  const label = isDark ? t("chrome.switch_to_light") : t("chrome.switch_to_dark");

  return (
    <button
      type="button"
      className="chrome-toggle"
      onClick={toggleTheme}
      title={label}
      aria-label={label}
    >
      {isDark ? (
        <Sun size={16} color="var(--warning)" />
      ) : (
        <Moon size={16} />
      )}
    </button>
  );
}

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="chrome-segmented" role="group" aria-label={t("chrome.language")}>
      {LOCALES.map((option) => (
        <button
          key={option.value}
          type="button"
          className="chrome-segment"
          aria-pressed={locale === option.value}
          aria-label={option.label}
          onClick={() => {
            if (option.value !== locale) setLocale(option.value);
          }}
        >
          {option.nativeLabel}
        </button>
      ))}
    </div>
  );
}

/** Both controls, side by side. */
export default function ChromeControls({ style }: { style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", ...style }}>
      <LanguageToggle />
      <ThemeToggle />
    </div>
  );
}
