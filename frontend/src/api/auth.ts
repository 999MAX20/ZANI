import { apiClient } from "./client";
import {
  loginWithCredentials,
  loginWithSocial,
  requestPasswordReset as requestPasswordResetToken,
  clearRefreshCookie,
  confirmPasswordReset as confirmPasswordResetToken,
  signupOwner as signupOwnerWithCredentials,
  refreshToken,
  confirmMfaEnrollment,
  isMfaPendingResponse,
  startMfaEnrollment,
  verifyMfaLogin,
  type MfaEnrollment,
  type MfaPendingResponse,
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
import type { CurrentUser, LoginHistory } from "../types";

export { confirmMfaEnrollment, isMfaPendingResponse, refreshToken, startMfaEnrollment, verifyMfaLogin };
export type { MfaEnrollment, MfaPendingResponse };
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

export async function restoreSession() {
  return refreshToken();
}

export async function getCurrentUser() {
  const { data } = await apiClient.get<CurrentUser>("/api/auth/me/");
  return data;
}

export async function updateCurrentUser(payload: Partial<Pick<CurrentUser, "full_name" | "phone" | "preferences">>) {
  const { data } = await apiClient.patch<CurrentUser>("/api/auth/me/", payload);
  return data;
}

export async function changePassword(payload: { current_password: string; new_password: string; mfa_code?: string }) {
  const { data } = await apiClient.post<{ ok: boolean }>("/api/auth/change-password/", payload, {
    withCredentials: true,
  });
  return data;
}

export async function getCurrentUserLoginHistory() {
  const { data } = await apiClient.get<LoginHistory[]>("/api/auth/login-history/");
  return data;
}

export type MfaStatus = {
  available: boolean;
  required: boolean;
  enabled: boolean;
  method: "totp" | null;
  confirmed_at: string | null;
  recovery_codes_remaining: number;
  active_sessions: number;
};

export async function getMfaStatus() {
  const { data } = await apiClient.get<MfaStatus>("/api/auth/mfa/status/");
  return data;
}

export async function issueMfaStepUp(code: string) {
  const { data } = await apiClient.post<{ step_up_token: string; expires_in: number }>(
    "/api/auth/mfa/step-up/",
    { code },
  );
  return data;
}

export async function regenerateMfaRecoveryCodes(code: string) {
  const { data } = await apiClient.post<{ recovery_codes: string[] }>("/api/auth/mfa/recovery-codes/", { code });
  return data;
}

export async function disableMfa(payload: { password: string; code: string; reason: string }) {
  const { data } = await apiClient.post<({ ok: boolean; access: string } | (MfaPendingResponse & { ok: boolean }))>("/api/auth/mfa/disable/", payload, { withCredentials: true });
  if (isMfaPendingResponse(data)) {
    tokenStorage.clear();
    return data;
  }
  tokenStorage.setAccess(data.access);
  return data;
}

export async function revokeMfaSessions(code: string) {
  const { data } = await apiClient.post<{ sessions_revoked: number; access: string }>(
    "/api/auth/mfa/sessions/revoke/",
    { code },
    { withCredentials: true },
  );
  tokenStorage.setAccess(data.access);
  return data;
}

export function logout() {
  void clearRefreshCookie().catch(() => undefined);
  tokenStorage.clear();
}
