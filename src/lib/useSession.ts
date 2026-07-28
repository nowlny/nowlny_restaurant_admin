"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  SESSION_EXPIRED_EVENT,
  getServerSessionSnapshot,
  getSessionSnapshot,
  subscribeToSession,
  syncSession,
  type SessionStatus,
} from "@/services/api/session";

/**
 * The signed-in state of the browser, as three states rather than a boolean.
 *
 * The boolean version was the refresh bug: the server render has no cookies,
 * so it answered `false`, and the gate's effect fired `router.replace(
 * '/auth/login')` on the very first commit — before React had re-read the
 * store with the real, cookie-backed answer. Callers must treat `loading` as
 * "wait", never as "signed out".
 */
export function useSessionStatus(): SessionStatus {
  const status = useSyncExternalStore(
    subscribeToSession,
    getSessionSnapshot,
    getServerSessionSnapshot,
  );

  useEffect(() => {
    // First read that can actually see `document.cookie`.
    syncSession();

    // A tab left open overnight comes back to a session that may have lapsed;
    // re-checking on focus turns that into a clean redirect rather than a
    // screen full of failed requests.
    const recheck = () => syncSession();
    window.addEventListener("focus", recheck);
    window.addEventListener(SESSION_EXPIRED_EVENT, recheck);
    return () => {
      window.removeEventListener("focus", recheck);
      window.removeEventListener(SESSION_EXPIRED_EVENT, recheck);
    };
  }, []);

  return status;
}
