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
};

export type MfaPendingResponse = {
  code: "mfa_required" | "mfa_enrollment_required";
  challenge_token: string;
  expires_at: string;
  method: "totp";
};

export type MfaEnrollment = {
  challenge_token: string;
  manual_key: string;
  otpauth_uri: string;
  issuer: string;
  account: string;
  expires_at: string;
};

export type MfaSessionResponse = TokenPair & {
  recovery_codes?: string[];
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
  const { data } = await axios.post<TokenPair | MfaPendingResponse>(`${baseURL}/api/auth/token/`, payload, { withCredentials: true });
  if (isMfaPendingResponse(data)) return data;
  tokenStorage.setAccess(data.access);
  tokenStorage.setEmail(payload.email);
  return data;
}

export async function loginWithSocial(payload: SocialLoginPayload) {
  const { data } = await axios.post<SocialLoginResponse | MfaPendingResponse>(`${baseURL}/api/auth/social/`, {
    provider: payload.provider,
    id_token: payload.idToken,
  }, { withCredentials: true });
  if (isMfaPendingResponse(data)) return data;
  tokenStorage.setAccess(data.access);
  return data;
}

export async function signupOwner(payload: OwnerSignupPayload) {
  const { data } = await axios.post<SignupOwnerResponse | MfaPendingResponse>(`${baseURL}/api/auth/signup/owner/`, payload, { withCredentials: true });
  if (isMfaPendingResponse(data)) return data;
  tokenStorage.setAccess(data.access);
  tokenStorage.setEmail(payload.email);
  return data;
}

export async function requestPasswordReset(payload: PasswordResetRequestPayload) {
  const { data } = await axios.post<PasswordResetRequestResponse>(`${baseURL}/api/auth/password-reset/request/`, payload);
  return data;
}

export async function confirmPasswordReset(payload: PasswordResetConfirmPayload) {
  const { data } = await axios.post<{ ok: boolean }>(
    `${baseURL}/api/auth/password-reset/confirm/`,
    payload,
    { withCredentials: true },
  );
  return data;
}

let refreshSessionPromise: Promise<string> | null = null;

export function refreshToken() {
  if (!refreshSessionPromise) {
    refreshSessionPromise = axios
      .post<{ access: string }>(
        `${baseURL}/api/auth/token/refresh/`,
        {},
        { withCredentials: true },
      )
      .then(({ data }) => {
        tokenStorage.setAccess(data.access);
        return data.access;
      })
      .finally(() => {
        refreshSessionPromise = null;
      });
  }
  return refreshSessionPromise;
}

export async function clearRefreshCookie() {
  await axios.post(`${baseURL}/api/auth/logout/`, {}, { withCredentials: true });
}

export function isMfaPendingResponse(value: unknown): value is MfaPendingResponse {
  if (!value || typeof value !== "object") return false;
  const code = (value as { code?: string }).code;
  return code === "mfa_required" || code === "mfa_enrollment_required";
}

const pendingMfaEnrollmentRequests = new Map<string, Promise<MfaEnrollment>>();

export function startMfaEnrollment(challengeToken?: string) {
  if (challengeToken) {
    const pendingRequest = pendingMfaEnrollmentRequests.get(challengeToken);
    if (pendingRequest) return pendingRequest;
  }

  const request = axios.post<MfaEnrollment>(
    `${baseURL}/api/auth/mfa/enrollment/start/`,
    challengeToken ? { challenge_token: challengeToken } : {},
    { withCredentials: true, headers: tokenStorage.getAccess() ? { Authorization: `Bearer ${tokenStorage.getAccess()}` } : undefined },
  ).then(({ data }) => data);

  if (challengeToken) {
    pendingMfaEnrollmentRequests.set(challengeToken, request);
    void request.catch(() => pendingMfaEnrollmentRequests.delete(challengeToken));
  }
  return request;
}

export async function confirmMfaEnrollment(challengeToken: string, code: string) {
  try {
    const { data } = await axios.post<MfaSessionResponse>(
      `${baseURL}/api/auth/mfa/enrollment/confirm/`,
      { challenge_token: challengeToken, code },
      { withCredentials: true },
    );
    tokenStorage.setAccess(data.access);
    return data;
  } finally {
    pendingMfaEnrollmentRequests.delete(challengeToken);
  }
}

export async function verifyMfaLogin(challengeToken: string, code: string) {
  const { data } = await axios.post<MfaSessionResponse>(
    `${baseURL}/api/auth/mfa/verify/`,
    { challenge_token: challengeToken, code },
    { withCredentials: true },
  );
  tokenStorage.setAccess(data.access);
  return data;
}
