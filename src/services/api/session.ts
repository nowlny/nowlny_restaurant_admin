import Cookies from "js-cookie";
import { jwtDecode } from "jwt-decode";

/**
 * The one place that knows where the session lives.
 *
 * Tokens used to be written and read inline from four different files, each
 * with its own idea of the cookie options — the login page wrote them with
 * js-cookie's defaults (a *session* cookie, gone the moment the browser
 * closes) while the refresh interceptor wrote a second, differently-scoped
 * pair. Centralising it means "signed in?" has exactly one answer.
 */

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

/** Dispatched once a refresh has definitively failed and the session is over. */
export const SESSION_EXPIRED_EVENT = "nowlny:session-expired";

/**
 * `loading` is the state that matters. Cookies are invisible to the server
 * render, so the first paint genuinely does not know yet — and answering
 * "unauthenticated" there is what used to bounce operators to the login screen
 * on every refresh.
 */
export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

/**
 * The API answers snake_case on the restaurant auth routes and camelCase on
 * some others, so both spellings are accepted rather than guessed at.
 */
export interface SessionTokens {
  access_token?: string;
  accessToken?: string;
  refresh_token?: string;
  refreshToken?: string;
}

/**
 * How long the browser keeps the cookies. The tokens' own lifetimes are
 * shorter and enforced by the API; this is only how long the *session* is
 * remembered across restarts, and it deliberately outlives the access token so
 * an expired one can still be traded in for a fresh pair.
 */
const SESSION_MAX_AGE_DAYS = 30;

const cookieOptions = (): Cookies.CookieAttributes => ({
  expires: SESSION_MAX_AGE_DAYS,
  path: "/",
  sameSite: "lax",
  // Set on HTTPS only: a `secure` cookie is silently dropped on `http://localhost`.
  secure: typeof window !== "undefined" && window.location.protocol === "https:",
});

const readCookie = (name: string): string | null => {
  if (typeof document === "undefined") return null;
  return Cookies.get(name) ?? null;
};

export const getAccessToken = (): string | null => readCookie(ACCESS_TOKEN_COOKIE);
export const getRefreshToken = (): string | null => readCookie(REFRESH_TOKEN_COOKIE);

/**
 * Deliberately permissive: a token we cannot read is treated as live and left
 * for the API to reject. Guessing "expired" locally is the failure mode that
 * signs out a perfectly good session, which is the whole bug class here.
 */
const isTokenExpired = (token: string): boolean => {
  try {
    const { exp } = jwtDecode<{ exp?: number }>(token);
    if (typeof exp !== "number") return false;
    return exp * 1000 <= Date.now();
  } catch {
    return false;
  }
};

/**
 * An expired access token is still a live session while a refresh token
 * remains — `apiClient` trades it for a new pair on the first 401.
 */
export const hasLiveSession = (): boolean => {
  const accessToken = getAccessToken();
  if (accessToken && !isTokenExpired(accessToken)) return true;
  return Boolean(getRefreshToken());
};

// ── Store ────────────────────────────────────────────────────────────────
// A real external store, so `useSyncExternalStore` re-renders the gate when
// the session changes. The previous `subscribe` was a no-op that never
// notified anyone, which left every consumer holding a stale answer.

const listeners = new Set<() => void>();
let snapshot: SessionStatus | null = null;

const computeSnapshot = (): SessionStatus =>
  hasLiveSession() ? "authenticated" : "unauthenticated";

export const subscribeToSession = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Cached: `getSnapshot` must be stable between renders or React loops. */
export const getSessionSnapshot = (): SessionStatus => {
  if (snapshot === null) snapshot = computeSnapshot();
  return snapshot;
};

export const getServerSessionSnapshot = (): SessionStatus => "loading";

/** Re-read the cookies and wake up subscribers if the answer changed. */
export const syncSession = (): void => {
  const next = computeSnapshot();
  if (next === snapshot) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
};

/** Returns whether an access token was actually present in the response. */
export const saveSession = (tokens: SessionTokens): boolean => {
  const accessToken = tokens.access_token ?? tokens.accessToken;
  const refreshToken = tokens.refresh_token ?? tokens.refreshToken;

  if (accessToken) {
    Cookies.set(ACCESS_TOKEN_COOKIE, accessToken, cookieOptions());
  }
  if (refreshToken) {
    Cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, cookieOptions());
  }

  syncSession();
  return Boolean(accessToken);
};

export const clearSession = (): void => {
  // The path has to match the one used to set them, or removal is a no-op.
  Cookies.remove(ACCESS_TOKEN_COOKIE, { path: "/" });
  Cookies.remove(REFRESH_TOKEN_COOKIE, { path: "/" });
  syncSession();
};

/**
 * The session is over and it was not the operator's doing. Clears the tokens
 * and announces it, so the shell can redirect once instead of every screen
 * hard-navigating to `/auth/login` on its own.
 */
export const endSession = (): void => {
  clearSession();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
};
