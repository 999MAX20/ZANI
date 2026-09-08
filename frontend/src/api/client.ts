import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

import { getAppErrorMessage, normalizeAppError } from "./appError";
import { refreshToken } from "./token";
import { getCurrentLanguage, translate } from "../lib/i18n";
import { tokenStorage } from "../lib/storage";

const baseURL = import.meta.env.VITE_API_URL || "";
export const AUTH_EXPIRED_EVENT = "zani:auth-expired";
export const SESSION_EXPIRED_NOTICE_KEY = "zani:session-expired";
export const SESSION_EXPIRED_RETURN_TO_KEY = "zani:session-expired-return-to";

export function isSafeInternalReturnPath(value: string) {
  return /^\/(app|platform)(\/|\?|#|$)/.test(value);
}

function notifyAuthExpired() {
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(SESSION_EXPIRED_NOTICE_KEY, "1");
      const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (isSafeInternalReturnPath(returnTo)) {
        window.sessionStorage.setItem(SESSION_EXPIRED_RETURN_TO_KEY, returnTo);
      }
    } catch {
      // A blocked sessionStorage must not prevent the auth-expired event.
    }
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
}

export function isSessionExpiryResponse(error: unknown) {
  if (!axios.isAxiosError(error)) return false;
  return error.response?.status === 400 || error.response?.status === 401;
}

export function expireBrowserSession() {
  tokenStorage.clear();
  notifyAuthExpired();
}

function isAuthEndpoint(url = "") {
  return url.includes("/api/auth/token/") || url.includes("/api/auth/token/refresh/") || url.includes("/api/auth/social/");
}

function isCredentialLoginEndpoint(url = "") {
  return url.includes("/api/auth/token/") && !url.includes("/refresh/");
}

export const apiClient = axios.create({
  baseURL,
  timeout: 20_000,
  headers: {
    "Content-Type": "application/json",
  },
});

export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
  summary?: unknown;
  facets?: unknown;
};

export function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export function unwrapList<T>(data: T[] | PaginatedResponse<T> | { results?: T[] } | null | undefined) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStorage.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status !== 401 || originalRequest._retry || isAuthEndpoint(originalRequest.url || "")) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    refreshPromise = refreshPromise || refreshToken().finally(() => {
      refreshPromise = null;
    });

    try {
      const access = await refreshPromise;
      originalRequest.headers.Authorization = `Bearer ${access}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      expireBrowserSession();
      return Promise.reject(refreshError);
    }
  },
);

export function getApiErrorMessage(
  error: unknown,
  translator: (key: string) => string = (key) => translate(getCurrentLanguage(), key),
) {
  return getAppErrorMessage(error, translator);
}

export function getLoginErrorMessage(
  error: unknown,
  translator: (key: string) => string = (key) => translate(getCurrentLanguage(), key),
) {
  const normalized = normalizeAppError(error);
  if (normalized.category === "authentication" && axios.isAxiosError(error)) {
    if (isCredentialLoginEndpoint(error.config?.url || "")) {
      return translator("auth.invalidCredentials");
    }
    return translator("auth.loginUnavailable");
  }
  return translator(normalized.messageKey);
}

export function hasSessionExpiredNotice() {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SESSION_EXPIRED_NOTICE_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearSessionExpiredNotice() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_EXPIRED_NOTICE_KEY);
  } catch {
    // A blocked sessionStorage must not break the login page.
  }
}

export function getSessionExpiredReturnTo() {
  if (typeof window === "undefined") return undefined;
  try {
    const returnTo = window.sessionStorage.getItem(SESSION_EXPIRED_RETURN_TO_KEY) || "";
    return isSafeInternalReturnPath(returnTo) ? returnTo : undefined;
  } catch {
    return undefined;
  }
}

export function clearSessionExpiredReturnTo() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SESSION_EXPIRED_RETURN_TO_KEY);
  } catch {
    // A blocked sessionStorage must not break authenticated navigation.
  }
}

export function consumeSessionExpiredReturnTo() {
  const returnTo = getSessionExpiredReturnTo();
  clearSessionExpiredReturnTo();
  return returnTo;
}

export function getApiFieldErrors(error: unknown) {
  return normalizeAppError(error).fieldErrors;
}
