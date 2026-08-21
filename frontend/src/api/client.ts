import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

import { getAppErrorMessage, normalizeAppError } from "./appError";
import { refreshToken } from "./token";
import { getCurrentLanguage, translate } from "../lib/i18n";
import { tokenStorage } from "../lib/storage";

const baseURL = import.meta.env.VITE_API_URL || "";
export const AUTH_EXPIRED_EVENT = "zani:auth-expired";

function notifyAuthExpired() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
  }
}

function isAuthEndpoint(url = "") {
  return url.includes("/api/auth/token/") || url.includes("/api/auth/token/refresh/") || url.includes("/api/auth/social/");
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
      tokenStorage.clear();
      notifyAuthExpired();
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

export function getApiFieldErrors(error: unknown) {
  return normalizeAppError(error).fieldErrors;
}
