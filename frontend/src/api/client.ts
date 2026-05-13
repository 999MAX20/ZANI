import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

import { refreshToken } from "./token";
import { tokenStorage } from "../lib/storage";

const baseURL = import.meta.env.VITE_API_URL || "";

export const apiClient = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

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
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    const refresh = tokenStorage.getRefresh();
    if (!refresh) {
      tokenStorage.clear();
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    refreshPromise = refreshPromise || refreshToken(refresh).finally(() => {
      refreshPromise = null;
    });

    const access = await refreshPromise;
    originalRequest.headers.Authorization = `Bearer ${access}`;
    return apiClient(originalRequest);
  },
);

export function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string") return data;
    if (data && typeof data === "object") {
      const detail = "detail" in data ? data.detail : null;
      if (typeof detail === "string") return detail;
      return Object.entries(data)
        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
        .join("; ");
    }
  }
  return "Что-то пошло не так. Попробуйте ещё раз.";
}
