import { API_URL } from "../config";
import { clearSession, getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from "../storage/session";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  retryOnUnauthorized?: boolean;
};

export class MobileApiError extends Error {
  status: number;
  payload: unknown;
  requestId: string;

  constructor(status: number, payload: unknown, requestId = "") {
    super(extractErrorMessage(payload));
    this.status = status;
    this.payload = payload;
    this.requestId = requestId;
  }
}

export async function mobileRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  headers.set("X-Request-ID", createRequestId());
  const access = getAccessToken();
  if (access) {
    headers.set("Authorization", `Bearer ${access}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (response.status === 401 && options.retryOnUnauthorized !== false) {
    const refreshed = await refreshMobileSession();
    if (refreshed) {
      return mobileRequest<T>(path, { ...options, retryOnUnauthorized: false });
    }
  }

  const data = await readJson(response);
  if (!response.ok) {
    throw new MobileApiError(response.status, data, response.headers.get("X-Request-ID") || "");
  }
  return data as T;
}

export async function refreshMobileSession() {
  const refresh = await getRefreshToken();
  if (!refresh) return false;
  const response = await fetch(`${API_URL}/api/mobile/v1/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Request-ID": createRequestId() },
    body: JSON.stringify({ refresh }),
  });
  const data = await readJson(response);
  if (!response.ok || !data || typeof data !== "object" || !("access" in data)) {
    await clearSession();
    return false;
  }
  const payload = data as { access: string; refresh?: string };
  setAccessToken(payload.access);
  if (payload.refresh) {
    await setRefreshToken(payload.refresh);
  }
  return true;
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function extractErrorMessage(payload: unknown) {
  if (typeof payload === "string") return payload;
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return "Request failed.";
}

function createRequestId() {
  const random = Math.random().toString(36).slice(2, 12);
  return `mobile-${Date.now().toString(36)}-${random}`;
}
