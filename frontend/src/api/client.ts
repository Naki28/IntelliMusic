// ApiClient — Couche fetch authentifiée (Bearer token)
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = "@intellimusic/session_token";
const FULLSTREAM_KEY = "@intellimusic/fullstream_enabled";

export const TokenStore = {
  async get() { return AsyncStorage.getItem(TOKEN_KEY); },
  async set(t: string) { await AsyncStorage.setItem(TOKEN_KEY, t); },
  async clear() { await AsyncStorage.removeItem(TOKEN_KEY); },
};

// Préférence locale "Lecture complète" (yt-dlp) — pas de sync serveur
export const FullStreamPref = {
  async get(): Promise<boolean> {
    const v = await AsyncStorage.getItem(FULLSTREAM_KEY);
    return v === "1";
  },
  async set(v: boolean) {
    await AsyncStorage.setItem(FULLSTREAM_KEY, v ? "1" : "0");
  },
};

export async function api<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await TokenStore.get();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  if (res.status === 204) return {} as T;
  return (await res.json()) as T;
}

// Résout une track Deezer (titre + artiste) en URL audio complète via /api/stream (yt-dlp)
// Si expected_duration fourni, le backend filtre les vidéos ayant une durée trop éloignée (intro/outro/extended)
export async function resolveFullStream(query: string, expectedDuration?: number): Promise<{ url: string; title?: string; duration?: number } | null> {
  try {
    const dur = expectedDuration ? `&expected=${Math.round(expectedDuration)}` : "";
    return await api(`/stream?q=${encodeURIComponent(query)}${dur}`);
  } catch {
    return null;
  }
}

