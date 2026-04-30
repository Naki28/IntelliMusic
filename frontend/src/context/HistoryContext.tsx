// HistoryContext — Historique d'écoute (local + synchro backend)
// Stocke les 50 derniers titres joués + sync avec /api/history backend
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Track } from "../types/music";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";

const STORAGE_KEY = "@history_v1";
const MAX_LOCAL = 50;

interface State {
  recent: Track[];
  record: (track: Track) => void;
  refresh: () => Promise<void>;
  clear: () => void;
}

const Ctx = createContext<State | undefined>(undefined);

export function HistoryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [recent, setRecent] = useState<Track[]>([]);
  const recentRef = useRef(recent);
  useEffect(() => { recentRef.current = recent; }, [recent]);

  // Chargement initial local + refresh backend
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setRecent(JSON.parse(raw));
      } catch {}
    })();
  }, []);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const r = await api<{ data: Track[] }>("/history/recent?limit=30");
      setRecent(r.data || []);
      try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(r.data || [])); } catch {}
    } catch {}
  }, [user]);

  useEffect(() => { if (user) refresh(); }, [user, refresh]);

  // Throttle pour éviter le flood (1 enregistrement max / 20s pour un même track)
  const lastRecordRef = useRef<Record<number, number>>({});

  const record = useCallback((track: Track) => {
    if (!track || !track.id) return;
    const now = Date.now();
    const last = lastRecordRef.current[track.id] || 0;
    if (now - last < 20000) return;
    lastRecordRef.current[track.id] = now;

    // MAJ locale immédiate (déduplication)
    setRecent((prev) => {
      const filtered = prev.filter((t) => t.id !== track.id);
      const next = [track, ...filtered].slice(0, MAX_LOCAL);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });

    // Sync backend (fire & forget)
    if (user) {
      api("/history", { method: "POST", body: JSON.stringify({ track }) }).catch(() => {});
    }
  }, [user]);

  const clear = useCallback(() => {
    setRecent([]);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  return (
    <Ctx.Provider value={{ recent, record, refresh, clear }}>{children}</Ctx.Provider>
  );
}

export function useHistory() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useHistory must be used within HistoryProvider");
  return c;
}
