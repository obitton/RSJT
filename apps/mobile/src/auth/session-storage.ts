import { toLoginResponse } from "@/auth/session-validation";
import type { LoginResponse } from "@rsjt/shared";
import * as SecureStore from "expo-secure-store";

const SESSION_STORAGE_KEY = "rsjt.auth.session";

export async function getStoredSession() {
  const value =
    process.env.EXPO_OS === "web"
      ? getWebStorage()?.getItem(SESSION_STORAGE_KEY)
      : await SecureStore.getItemAsync(SESSION_STORAGE_KEY);

  if (!value) {
    return null;
  }

  const parsed = parseStoredValue(value);
  if (parsed) {
    const session = toLoginResponse(parsed);
    if (session) {
      return session;
    }
  }

  await clearStoredSession();
  return null;
}

export async function setStoredSession(session: LoginResponse) {
  const value = JSON.stringify(session);

  if (process.env.EXPO_OS === "web") {
    getWebStorage()?.setItem(SESSION_STORAGE_KEY, value);
    return;
  }

  await SecureStore.setItemAsync(SESSION_STORAGE_KEY, value);
}

export async function clearStoredSession() {
  if (process.env.EXPO_OS === "web") {
    getWebStorage()?.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
}

function getWebStorage() {
  if (typeof globalThis.localStorage === "undefined") {
    return null;
  }

  return globalThis.localStorage;
}

function parseStoredValue(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
