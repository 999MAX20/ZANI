import axios from "axios";

import { tokenStorage } from "../lib/storage";
import type { Business, CurrentUser } from "../types";

const baseURL = import.meta.env.VITE_API_URL || "";

export type LoginPayload = {
  email: string;
  password: string;
};

export type TokenPair = {
  access: string;
  refresh: string;
};

export type SocialProvider = "google" | "apple";

export type SocialLoginPayload = {
  provider: SocialProvider;
  idToken: string;
};

export type SocialLoginResponse = TokenPair & {
  created: boolean;
  provider: SocialProvider;
};

export type OwnerSignupPayload = {
  email: string;
  password: string;
  full_name?: string;
  phone?: string;
  business_name: string;
  business_type: string;
  city?: string;
};

export type SignupOwnerResponse = TokenPair & {
  user: CurrentUser;
  business: Pick<Business, "id" | "name" | "slug">;
};

export type PasswordResetRequestPayload = {
  email: string;
  delivery_channel: "email" | "whatsapp" | "telegram" | "manual";
};

export type PasswordResetRequestResponse = {
  ok: boolean;
  message: string;
  uid?: string;
  token?: string;
  reset_path?: string;
  delivery_channel?: PasswordResetRequestPayload["delivery_channel"];
};

export type PasswordResetConfirmPayload = {
  uid: string;
  token: string;
  password: string;
};

export async function loginWithCredentials(payload: LoginPayload) {
  const { data } = await axios.post<TokenPair>(`${baseURL}/api/auth/token/`, payload);
  tokenStorage.setTokens(data.access, data.refresh);
  tokenStorage.setEmail(payload.email);
  return data;
}

export async function loginWithSocial(payload: SocialLoginPayload) {
  const { data } = await axios.post<SocialLoginResponse>(`${baseURL}/api/auth/social/`, {
    provider: payload.provider,
    id_token: payload.idToken,
  });
  tokenStorage.setTokens(data.access, data.refresh);
  return data;
}

export async function signupOwner(payload: OwnerSignupPayload) {
  const { data } = await axios.post<SignupOwnerResponse>(`${baseURL}/api/auth/signup/owner/`, payload);
  tokenStorage.setTokens(data.access, data.refresh);
  tokenStorage.setEmail(payload.email);
  return data;
}

export async function requestPasswordReset(payload: PasswordResetRequestPayload) {
  const { data } = await axios.post<PasswordResetRequestResponse>(`${baseURL}/api/auth/password-reset/request/`, payload);
  return data;
}

export async function confirmPasswordReset(payload: PasswordResetConfirmPayload) {
  const { data } = await axios.post<{ ok: boolean }>(`${baseURL}/api/auth/password-reset/confirm/`, payload);
  return data;
}

export async function refreshToken(refresh: string) {
  const { data } = await axios.post<{ access: string; refresh?: string }>(`${baseURL}/api/auth/token/refresh/`, {
    refresh,
  });
  tokenStorage.setTokens(data.access, data.refresh || refresh);
  return data.access;
}
