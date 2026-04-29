// APIManager — Couche de communication avec l'API Deezer (proxifiée par notre backend)
// + cache mémoire avec TTL pour le prefetch (album, artist top, artist albums)
import type { Track, Album, Artist, Genre, ChartResponse } from "../types/music";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

// === Cache mémoire avec TTL (5 min par défaut) ===
const CACHE_TTL_MS = 5 * 60 * 1000;
type CacheEntry<T> = { data: T; ts: number };
const cache = new Map<string, CacheEntry<any>>();
const inflight = new Map<string, Promise<any>>(); // déduplication des requêtes simultanées

function getCached<T>(key: string): T | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return e.data as T;
}

function setCached<T>(key: string, data: T) {
  cache.set(key, { data, ts: Date.now() });
}

// Helper générique de fetch avec cache + déduplication
async function api<T>(path: string, useCache = false): Promise<T> {
  const url = `${BASE}/api${path}`;
  if (useCache) {
    const cached = getCached<T>(url);
    if (cached !== null) return cached;
    // Si une requête identique est en cours, on attend son résultat
    const pending = inflight.get(url);
    if (pending) return pending as Promise<T>;
  }
  const p = (async () => {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Erreur API ${res.status}`);
    }
    const json = (await res.json()) as T;
    if (useCache) setCached(url, json);
    return json;
  })();
  if (useCache) {
    inflight.set(url, p);
    p.finally(() => inflight.delete(url));
  }
  return p;
}

export const DeezerAPI = {
  async chart(): Promise<ChartResponse> {
    return api<ChartResponse>("/deezer/chart", true);
  },

  async searchTracks(q: string, limit = 25): Promise<{ data: Track[] }> {
    return api(`/deezer/search?q=${encodeURIComponent(q)}&limit=${limit}`);
  },

  async searchAlbums(q: string, limit = 20): Promise<{ data: Album[] }> {
    return api(`/deezer/search/album?q=${encodeURIComponent(q)}&limit=${limit}`);
  },

  async searchArtists(q: string, limit = 20): Promise<{ data: Artist[] }> {
    return api(`/deezer/search/artist?q=${encodeURIComponent(q)}&limit=${limit}`);
  },

  async genres(): Promise<{ data: Genre[] }> {
    return api("/deezer/genres", true);
  },

  // Détails d'un album (avec tracks) — mis en cache
  async album(id: number): Promise<Album> {
    return api(`/deezer/album/${id}`, true);
  },

  // Top titres d'un artiste — mis en cache
  async artistTop(id: number, limit = 10): Promise<{ data: Track[] }> {
    return api(`/deezer/artist/${id}/top?limit=${limit}`, true);
  },

  // Albums d'un artiste — mis en cache (peut renvoyer 404 sur certaines routes backend, fallback safe)
  async artistAlbums(id: number, limit = 25): Promise<{ data: Album[] }> {
    try {
      return await api<{ data: Album[] }>(`/deezer/artist/${id}/albums?limit=${limit}`, true);
    } catch {
      return { data: [] };
    }
  },

  async newReleases(): Promise<{ data: Album[] }> {
    return api("/deezer/editorial/releases", true);
  },

  // === Prefetch helpers — chauffe le cache, sans bloquer l'UI ===
  // Appelé depuis Home/Search après avoir reçu les listes — silencieux en cas d'erreur.
  prefetchAlbum(id: number) {
    if (!id) return;
    this.album(id).catch(() => {});
  },
  prefetchArtist(id: number, withAlbums = true) {
    if (!id) return;
    this.artistTop(id, 10).catch(() => {});
    if (withAlbums) this.artistAlbums(id, 25).catch(() => {});
  },
  // Lance les prefetch en série (avec un petit délai) pour ne pas saturer le réseau
  prefetchAlbums(ids: number[], delayMs = 150) {
    ids.forEach((id, i) => {
      setTimeout(() => this.prefetchAlbum(id), i * delayMs);
    });
  },
  prefetchArtists(ids: number[], delayMs = 200) {
    ids.forEach((id, i) => {
      setTimeout(() => this.prefetchArtist(id, true), i * delayMs);
    });
  },
};
