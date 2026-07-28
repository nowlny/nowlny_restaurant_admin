"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  dirFor,
  isLocale,
  LOCALE_STORAGE_KEY,
  translate,
  type Locale,
} from "@/lib/i18n";

/**
 * Last-resort boundary for errors thrown in the root layout itself, where the
 * route-level `error.tsx` cannot mount. It must render its own <html>/<body>
 * because the failing layout never produced them.
 *
 * That is also why the locale is read from storage rather than off <html>: the
 * layout that carries the pre-paint script never rendered, so the document
 * attributes `useI18n` normally trusts were never set.
 *
 * TODO(WS-18): forward to Sentry once a DSN is provisioned.
 */

/** Nothing to subscribe to — the language cannot change while this page is up. */
const subscribeToLocale = () => () => {};

const readLocale = (): Locale => {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : "en";
  } catch {
    return "en"; /* storage blocked — English is a safe fallback */
  }
};

const serverLocale = (): Locale => "en";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Server-renders in English, then adopts the stored language on hydration —
  // through an external store, so no setState-in-effect is needed.
  const locale = useSyncExternalStore(
    subscribeToLocale,
    readLocale,
    serverLocale,
  );

  useEffect(() => {
    console.error("[global-error]", error?.digest ?? "", error);
  }, [error]);

  return (
    <html lang={locale} dir={dirFor(locale)}>
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
        }}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            {translate(locale, "error.title")}
          </h2>
          <button
            onClick={reset}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background: "#FF4500",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {translate(locale, "error.retry")}
          </button>
        </div>
      </body>
    </html>
  );
}
