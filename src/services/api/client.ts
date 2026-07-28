import axios, {
  AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios';
import {
  endSession,
  getAccessToken,
  getRefreshToken,
  saveSession,
} from './session';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://app.nowlny.com/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Routes where a 401 means "wrong code" or "expired OTP", not "your session
 * died". Running the refresh-and-sign-out path for these used to clear a
 * perfectly good session because someone fat-fingered a digit.
 */
const AUTH_ROUTES = [
  '/auth/refresh',
  '/auth/restaurant/request-otp',
  '/auth/restaurant/verify-otp',
  '/auth/restaurant/complete-signup',
];

const isAuthRoute = (url?: string) =>
  Boolean(url && AUTH_ROUTES.some((route) => url.includes(route)));

/**
 * One in-flight refresh shared by every concurrent 401.
 *
 * A dashboard screen fires several requests at once, so an expired token
 * produced several simultaneous refreshes. The API rotates refresh tokens, so
 * the first call invalidated the token the others were still holding: they all
 * failed and signed the operator out mid-session with a valid session in hand.
 */
let refreshInFlight: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  if (refreshInFlight) return refreshInFlight;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  refreshInFlight = (async () => {
    try {
      // Bare axios, not `apiClient`: a 401 here must not re-enter the
      // interceptor and recurse.
      const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      });
      const accessToken = data?.access_token ?? data?.accessToken;
      if (!accessToken) return null;

      saveSession(data);
      return accessToken as string;
    } catch {
      return null;
    } finally {
      // Cleared on the next tick so simultaneous callers all read this result.
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();

  return refreshInFlight;
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (
      error.response?.status !== 401 ||
      !request ||
      request._retry ||
      isAuthRoute(request.url)
    ) {
      return Promise.reject(error);
    }

    request._retry = true;
    const accessToken = await refreshAccessToken();

    if (!accessToken) {
      // Genuinely over. Drop the tokens and let the shell route to the login
      // screen — a `window.location.href` here threw away any unsaved work and
      // reloaded straight back into the same 401.
      endSession();
      return Promise.reject(error);
    }

    request.headers.Authorization = `Bearer ${accessToken}`;
    return apiClient(request);
  }
);
