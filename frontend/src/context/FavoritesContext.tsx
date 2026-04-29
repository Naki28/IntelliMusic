// FavoritesContext — Sync backend (server-authoritative) avec fallback local si non connecté
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Track } from "../types/music";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";

const STORAGE_KEY = "@intellimusic/favorites";

interface FavoritesState {
  favorites: Track[];
  isFavorite: (id: number) => boolean;
  toggleFavorite: (track: Track) => Promise<void>;
  reload: () => Promise<void>;
}

const FavoritesContext = createContext<FavoritesState | undefined>(undefined);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Track[]>([]);

  const reload = useCallback(async () => {
    if (user) {
      try {
        const res = await api<{ data: Track[] }>("/favorites");
        setFavorites(res.data || []);
      } catch (e) {
        console.warn("Erreur favoris:", e);
      }
    } else {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setFavorites(JSON.parse(raw));
        else setFavorites([]);
      } catch {}
    }
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  const isFavorite = useCallback((id: number) => favorites.some((t) => t.id === id), [favorites]);

  const toggleFavorite = useCallback(async (track: Track) => {
    const exists = favorites.some((t) => t.id === track.id);
    const next = exists ? favorites.filter((t) => t.id !== track.id) : [track, ...favorites];
    setFavorites(next);

    if (user) {
      try {
        if (exists) await api(`/favorites/${track.id}`, { method: "DELETE" });
        else await api("/favorites", { method: "POST", body: JSON.stringify({ track }) });
      } catch (e) {
        console.warn("Erreur sync favori:", e);
      }
    } else {
      try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    }
  }, [favorites, user]);

  return (
    <FavoritesContext.Provider value={{ favorites, isFavorite, toggleFavorite, reload }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
