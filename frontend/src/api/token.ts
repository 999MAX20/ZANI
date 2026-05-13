import axios from "axios";

import { tokenStorage } from "../lib/storage";

const baseURL = import.meta.env.VITE_API_URL || "";

export type LoginPayload = {
  email: string;
  password: string;
};

export type TokenPair = {
  access: string;
  refresh: string;
};

export async function loginWithCredentials(payload: LoginPayload) {
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
