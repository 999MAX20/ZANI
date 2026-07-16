import * as SecureStore from "expo-secure-store";

const ACCESS_KEY = "zani.mobile.access";
const REFRESH_KEY = "zani.mobile.refresh";
const DEVICE_ID_KEY = "zani.mobile.deviceId";

let accessToken: string | null = null;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function setRefreshToken(token: string | null) {
  if (!token) {
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    return;
  }
  await SecureStore.setItemAsync(REFRESH_KEY, token);
}

export async function getOrCreateDeviceId() {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const generated = `zani-mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await SecureStore.setItemAsync(DEVICE_ID_KEY, generated);
  return generated;
}

export async function clearSession() {
  accessToken = null;
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}
