import axios from "axios";

import { tokenStorage } from "../lib/storage";
import type { CurrentUser } from "../types";

const baseURL = import.meta.env.VITE_API_URL || "";

export type LoginPayload = {
  email: string;
  password: string;
};

export type TokenPair = {
  access: string;
  refresh: string;
};

export async function login(payload: LoginPayload) {
  const { data } = await axios.post<TokenPair>(`${baseURL}/api/auth/token/`, payload);
  tokenStorage.setTokens(data.access, data.refresh);
  tokenStorage.setEmail(payload.email);
  return data;
}

export async function refreshToken(refresh: string) {
  const { data } = await axios.post<{ access: string; refresh?: string }>(`${baseURL}/api/auth/token/refresh/`, {
    refresh,
  });
  tokenStorage.setTokens(data.access, data.refresh || refresh);
  return data.access;
}

export async function getCurrentUser() {
  const access = tokenStorage.getAccess();
  const { data } = await axios.get<CurrentUser>(`${baseURL}/api/auth/me/`, {
    headers: access ? { Authorization: `Bearer ${access}` } : undefined,
  });
  return data;
}

export function logout() {
  tokenStorage.clear();
}
