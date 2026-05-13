import { apiClient } from "./client";
import { loginWithCredentials, refreshToken, type LoginPayload, type TokenPair } from "./token";
import { tokenStorage } from "../lib/storage";
import type { CurrentUser } from "../types";

export { refreshToken };
export type { LoginPayload, TokenPair };

export async function login(payload: LoginPayload) {
  return loginWithCredentials(payload);
}

export async function getCurrentUser() {
  const { data } = await apiClient.get<CurrentUser>("/api/auth/me/");
  return data;
}

export function logout() {
  tokenStorage.clear();
}
