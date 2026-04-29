// LibraryContext — Saved albums / artists / podcasts (sync backend)
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";
import type { Album, Artist } from "../types/music";

export interface PodcastMeta {
  id: number;
  collectionName?: string;
  artistName?: string;
  artworkUrl600?: string;
  artworkUrl100?: string;
  // top format
  name?: string;
  artist?: string;
  image?: string;
  summary?: string;
}

interface State {
  albums: Album[];
  artists: Artist[];
  podcasts: PodcastMeta[];
  isAlbumSaved: (id: number) => boolean;
  isArtistSaved: (id: number) => boolean;
  isPodcastSaved: (id: number) => boolean;
  toggleAlbum: (a: Album) => Promise<void>;
  toggleArtist: (a: Artist) => Promise<void>;
  togglePodcast: (p: PodcastMeta) => Promise<void>;
  reload: () => Promise<void>;
}

const Ctx = createContext<State | undefined>(undefined);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [podcasts, setPodcasts] = useState<PodcastMeta[]>([]);

  const reload = useCallback(async () => {
    if (!user) { setAlbums([]); setArtists([]); setPodcasts([]); return; }
    try {
      const [al, ar, pd] = await Promise.all([
        api<{ data: Album[] }>("/saved-albums").catch(() => ({ data: [] })),
        api<{ data: Artist[] }>("/saved-artists").catch(() => ({ data: [] })),
        api<{ data: PodcastMeta[] }>("/saved-podcasts").catch(() => ({ data: [] })),
      ]);
      setAlbums(al.data || []);
      setArtists(ar.data || []);
      setPodcasts(pd.data || []);
    } catch (e) { console.warn(e); }
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  const isAlbumSaved = useCallback((id: number) => albums.some((a) => a.id === id), [albums]);
  const isArtistSaved = useCallback((id: number) => artists.some((a) => a.id === id), [artists]);
  const isPodcastSaved = useCallback((id: number) => podcasts.some((p) => p.id === id), [podcasts]);

  const toggleAlbum = useCallback(async (album: Album) => {
    const exists = albums.some((a) => a.id === album.id);
    setAlbums((prev) => exists ? prev.filter((a) => a.id !== album.id) : [album, ...prev]);
    try {
      if (exists) await api(`/saved-albums/${album.id}`, { method: "DELETE" });
      else await api("/saved-albums", { method: "POST", body: JSON.stringify({ album }) });
    } catch (e) { console.warn(e); }
  }, [albums]);

  const toggleArtist = useCallback(async (artist: Artist) => {
    const exists = artists.some((a) => a.id === artist.id);
    setArtists((prev) => exists ? prev.filter((a) => a.id !== artist.id) : [artist, ...prev]);
    try {
      if (exists) await api(`/saved-artists/${artist.id}`, { method: "DELETE" });
      else await api("/saved-artists", { method: "POST", body: JSON.stringify({ artist }) });
    } catch (e) { console.warn(e); }
  }, [artists]);

  const togglePodcast = useCallback(async (podcast: PodcastMeta) => {
    const exists = podcasts.some((p) => p.id === podcast.id);
    setPodcasts((prev) => exists ? prev.filter((p) => p.id !== podcast.id) : [podcast, ...prev]);
    try {
      if (exists) await api(`/saved-podcasts/${podcast.id}`, { method: "DELETE" });
      else await api("/saved-podcasts", { method: "POST", body: JSON.stringify({ podcast }) });
    } catch (e) { console.warn(e); }
  }, [podcasts]);

  return <Ctx.Provider value={{ albums, artists, podcasts, isAlbumSaved, isArtistSaved, isPodcastSaved, toggleAlbum, toggleArtist, togglePodcast, reload }}>{children}</Ctx.Provider>;
}

export function useLibrary() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useLibrary must be used within LibraryProvider");
  return c;
}
