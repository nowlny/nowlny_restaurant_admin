"use client";

import { useId, useRef, type CSSProperties, type FocusEvent } from "react";
import { useI18n } from "@/lib/i18n";

/*
 * The sign-in and delete-account screens each carried their own copy of these
 * two controls. Shared here so a fix (paste, autofill, phone width) lands in
 * both. `_components` keeps the folder out of the router.
 */

export const OTP_LENGTH = 4;
export const emptyOtp = (): string[] => Array.from({ length: OTP_LENGTH }, () => "");

/** Auth cards: roomy on desktop, but no 40px gutters eating a 375px phone. */
export const AUTH_CARD_PADDING = "clamp(20px, 6vw, 40px)";
export const AUTH_PAGE_PADDING = "clamp(12px, 4vw, 20px)";

const focusRing = (event: FocusEvent<HTMLElement>, on: boolean, filled = false) => {
  event.currentTarget.style.borderColor = on ? "var(--accent-primary)" : "var(--border-color)";
  event.currentTarget.style.boxShadow = on
    ? "0 0 0 3px var(--accent-light)"
    : filled
      ? "var(--shadow-sm)"
      : "none";
};

/** +961 prefix and the national number. Always LTR — a phone number reads the same in Arabic. */
export function PhoneField({
  label,
  placeholder,
  value,
  onChange,
  autoFocus,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div
        dir="ltr"
        style={{
          display: "flex",
          background: "var(--bg-surface)",
          border: "1px solid var(--border-color)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
        }}
        onFocus={(event) => focusRing(event, true)}
        onBlur={(event) => focusRing(event, false)}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "14px clamp(10px, 3vw, 16px)",
            background: "var(--bg-elevated)",
            borderInlineEnd: "1px solid var(--border-light)",
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          +961
        </div>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoFocus={autoFocus}
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            background: "transparent",
            color: "var(--text-primary)",
            padding: "14px clamp(10px, 3vw, 16px)",
            fontFamily: "inherit",
            fontSize: "1rem",
            outline: "none",
          }}
        />
      </div>
    </div>
  );
}

const BOX_STYLE: CSSProperties = {
  // 4 × 56px plus gaps overflowed a 375px card; shrink with the viewport.
  width: "clamp(44px, 14vw, 56px)",
  height: "clamp(52px, 16vw, 64px)",
  fontSize: "clamp(20px, 6vw, 24px)",
  fontWeight: 700,
  fontFamily: "inherit",
  textAlign: "center",
  background: "var(--bg-surface)",
  border: "1px solid var(--border-color)",
  color: "var(--text-primary)",
  borderRadius: "var(--radius-md)",
  outline: "none",
  padding: 0,
  transition: "border-color 0.2s ease, box-shadow 0.2s ease",
};

/**
 * One box per digit. Pasting — or SMS autofill, which drops the whole code
 * into the first box — spreads the digits across all four.
 */
export function OtpCodeInput({
  value,
  onChange,
  label,
  autoFocus,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  label: string;
  autoFocus?: boolean;
}) {
  const { t } = useI18n();
  const labelId = useId();
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const focusBox = (index: number) => {
    const box = refs.current[Math.max(0, Math.min(OTP_LENGTH - 1, index))];
    box?.focus();
    box?.select();
  };

  /** Writes `digits` starting at `start`; a full-length code always starts at box 1. */
  const fill = (start: number, digits: string) => {
    const from = digits.length >= OTP_LENGTH ? 0 : start;
    const next = [...value];
    digits
      .slice(0, OTP_LENGTH - from)
      .split("")
      .forEach((digit, offset) => {
        next[from + offset] = digit;
      });
    onChange(next);
    focusBox(Math.min(from + digits.length, OTP_LENGTH - 1));
  };

  const handleChange = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) {
      if (raw === "") {
        const next = [...value];
        next[index] = "";
        onChange(next);
      }
      return;
    }
    // Typing over a filled box that wasn't selected yields "old+new": keep the new one.
    if (digits.length === 2 && value[index] && digits.startsWith(value[index])) {
      fill(index, digits.slice(1));
      return;
    }
    fill(index, digits);
  };

  return (
    <div className="field" style={{ alignItems: "center" }}>
      <p id={labelId} className="field-label" style={{ margin: 0 }}>
        {label}
      </p>
      {/* Codes read left-to-right in every locale. */}
      <div
        dir="ltr"
        role="group"
        aria-labelledby={labelId}
        style={{ display: "flex", gap: "clamp(8px, 3vw, 12px)", justifyContent: "center" }}
      >
        {value.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            autoFocus={autoFocus && index === 0}
            aria-label={t("login.code_digit", { index: index + 1 })}
            // Longer than one so a paste or autofill isn't truncated before onChange sees it.
            maxLength={OTP_LENGTH}
            value={digit}
            onChange={(event) => handleChange(index, event.target.value)}
            onPaste={(event) => {
              const digits = event.clipboardData.getData("text").replace(/\D/g, "");
              if (!digits) return;
              event.preventDefault();
              fill(index, digits);
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !digit && index > 0) {
                event.preventDefault();
                const next = [...value];
                next[index - 1] = "";
                onChange(next);
                focusBox(index - 1);
              } else if (event.key === "ArrowLeft") {
                event.preventDefault();
                focusBox(index - 1);
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                focusBox(index + 1);
              }
            }}
            style={{ ...BOX_STYLE, boxShadow: digit ? "var(--shadow-sm)" : "none" }}
            onFocus={(event) => {
              event.currentTarget.select();
              focusRing(event, true);
            }}
            onBlur={(event) => focusRing(event, false, Boolean(digit))}
          />
        ))}
      </div>
    </div>
  );
}
