// PlaylistsContext — CRUD playlists côté backend
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Track } from "../types/music";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";

export interface Playlist {
  id: string;
  user_id: string;
  name: string;
  track_ids: number[];
  tracks: Track[];
  created_at: string;
}

interface PlaylistsState {
  playlists: Playlist[];
  reload: () => Promise<void>;
  create: (name: string) => Promise<Playlist | null>;
  remove: (id: string) => Promise<void>;
  addTrack: (playlistId: string, track: Track) => Promise<void>;
  removeTrack: (playlistId: string, trackId: number) => Promise<void>;
}

const Ctx = createContext<PlaylistsState | undefined>(undefined);

export function PlaylistsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  const reload = useCallback(async () => {
    if (!user) { setPlaylists([]); return; }
    try {
      const res = await api<{ data: Playlist[] }>("/playlists");
      setPlaylists(res.data || []);
    } catch (e) { console.warn("Erreur playlists:", e); }
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  const create = useCallback(async (name: string) => {
    if (!user) return null;
    try {
      const pl = await api<Playlist>("/playlists", { method: "POST", body: JSON.stringify({ name }) });
      await reload();
      return pl;
    } catch (e) { console.warn(e); return null; }
  }, [user, reload]);

  const remove = useCallback(async (id: string) => {
    await api(`/playlists/${id}`, { method: "DELETE" });
    await reload();
  }, [reload]);

  const addTrack = useCallback(async (playlistId: string, track: Track) => {
    await api(`/playlists/${playlistId}/tracks`, { method: "POST", body: JSON.stringify({ track }) });
    await reload();
  }, [reload]);

  const removeTrack = useCallback(async (playlistId: string, trackId: number) => {
    await api(`/playlists/${playlistId}/tracks/${trackId}`, { method: "DELETE" });
    await reload();
  }, [reload]);

  return <Ctx.Provider value={{ playlists, reload, create, remove, addTrack, removeTrack }}>{children}</Ctx.Provider>;
}

export function usePlaylists() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePlaylists must be used within PlaylistsProvider");
  return c;
}
