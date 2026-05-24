import { apiClient } from "./client";
import {
  loginWithCredentials,
  loginWithSocial,
  requestPasswordReset as requestPasswordResetToken,
  confirmPasswordReset as confirmPasswordResetToken,
  signupOwner as signupOwnerWithCredentials,
  refreshToken,
  type LoginPayload,
  type OwnerSignupPayload,
  type PasswordResetConfirmPayload,
  type PasswordResetRequestPayload,
  type PasswordResetRequestResponse,
  type SocialLoginPayload,
  type SocialLoginResponse,
  type SocialProvider,
  type SignupOwnerResponse,
  type TokenPair,
} from "./token";
import { tokenStorage } from "../lib/storage";
import type { CurrentUser } from "../types";

export { refreshToken };
export type { LoginPayload, SocialLoginPayload, SocialLoginResponse, SocialProvider, TokenPair };
export type {
  OwnerSignupPayload,
  PasswordResetConfirmPayload,
  PasswordResetRequestPayload,
  PasswordResetRequestResponse,
  SignupOwnerResponse,
};

export async function login(payload: LoginPayload) {
  return loginWithCredentials(payload);
}

export async function socialLogin(payload: SocialLoginPayload) {
  return loginWithSocial(payload);
}

export async function signupOwner(payload: OwnerSignupPayload) {
  return signupOwnerWithCredentials(payload);
}

export async function requestPasswordReset(payload: PasswordResetRequestPayload) {
  return requestPasswordResetToken(payload);
}

export async function confirmPasswordReset(payload: PasswordResetConfirmPayload) {
  return confirmPasswordResetToken(payload);
}

export async function getCurrentUser() {
  const { data } = await apiClient.get<CurrentUser>("/api/auth/me/");
  return data;
}

export function logout() {
  tokenStorage.clear();
}
