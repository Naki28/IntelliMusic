// AudioPlayerViewModel — Lecture audio (queue de tracks ou stream radio)
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { Audio, AVPlaybackStatus } from "expo-av";
import type { Track } from "../types/music";
import { resolveFullStream, FullStreamPref } from "../api/client";

type Mode = "track" | "stream";

interface StreamInfo {
  name: string;
  subtitle?: string;
  artwork?: string;
  url: string;
  kind?: "radio" | "podcast"; // par défaut "radio" pour compat
}

interface PlayerState {
  mode: Mode;
  currentTrack: Track | null;
  stream: StreamInfo | null;
  queue: Track[];
  index: number;
  isPlaying: boolean;
  isLoading: boolean;
  isFullStreamMode: boolean;
  positionMs: number;
  durationMs: number;

  setFullStreamMode: (v: boolean) => Promise<void>;
  playQueue: (tracks: Track[], startIndex?: number) => Promise<void>;
  playStream: (s: StreamInfo) => Promise<void>;
  togglePlay: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  seekTo: (ms: number) => Promise<void>;
  stop: () => Promise<void>;
}

const PlayerContext = createContext<PlayerState | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [mode, setMode] = useState<Mode>("track");
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState<number>(-1);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [stream, setStream] = useState<StreamInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [isFullStreamMode, setIsFullStreamMode] = useState(false);

  // Charge la préférence "lecture complète" au démarrage
  useEffect(() => {
    FullStreamPref.get().then(setIsFullStreamMode);
  }, []);

  const setFullStreamMode = useCallback(async (v: boolean) => {
    await FullStreamPref.set(v);
    setIsFullStreamMode(v);
  }, []);

  useEffect(() => {
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
      // Empêche les autres apps audio d'interrompre — vraie lecture en arrière-plan
      interruptionModeIOS: 1, // DO_NOT_MIX
      interruptionModeAndroid: 1, // DO_NOT_MIX
    }).catch(() => {});
  }, []);

  // Callback de status — si erreur de format → fallback automatique
  const onStatus = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      const err = (status as any).error;
      if (err && currentTrack && isFullStreamMode) {
        console.warn("Stream KO, fallback preview:", err);
        if (currentTrack.preview && soundRef.current) {
          (async () => {
            try {
              await soundRef.current?.unloadAsync();
              const { sound } = await Audio.Sound.createAsync({ uri: currentTrack.preview }, { shouldPlay: true }, onStatus);
              soundRef.current = sound;
            } catch {}
          })();
        }
      }
      return;
    }
    setIsPlaying(status.isPlaying);
    setPositionMs(status.positionMillis ?? 0);
    setDurationMs(status.durationMillis ?? 0);

    // Si on dépasse la durée officielle Deezer (yt-dlp peut fournir un audio + long),
    // on coupe et on passe au suivant — UX propre, pas d'intro/outro indésirable
    const officialDurMs = currentTrack?.duration ? currentTrack.duration * 1000 : 0;
    if (currentTrack && officialDurMs > 0 && status.positionMillis && status.positionMillis >= officialDurMs - 250) {
      if (nextRef.current) nextRef.current();
      return;
    }

    // Anticipation : à 75% du track actuel, on précharge le suivant
    if (status.durationMillis && status.positionMillis && queueRef.current.length > 0) {
      const ratio = status.positionMillis / status.durationMillis;
      if (ratio > 0.75 && !preloadedRef.current[indexRef.current + 1]) {
        const nextT = queueRef.current[indexRef.current + 1];
        if (nextT?.preview) {
          preloadedRef.current[indexRef.current + 1] = true;
          fetch(nextT.preview, { method: "HEAD" }).catch(() => {});
        }
      }
    }

    if (status.didJustFinish && nextRef.current) nextRef.current();
  }, [currentTrack, isFullStreamMode]);

  // Refs pour l'anticipation (évite re-render)
  const queueRef = useRef<Track[]>([]);
  const indexRef = useRef<number>(-1);
  const preloadedRef = useRef<Record<number, boolean>>({});
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { indexRef.current = index; preloadedRef.current = {}; }, [index]);

  const unload = async () => {
    if (soundRef.current) {
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
  };

  const loadAndPlay = useCallback(async (tracks: Track[], idx: number) => {
    const track = tracks[idx];
    if (!track) return;
    try {
      setIsLoading(true);
      await unload();
      // Optimiste : mise à jour UI immédiate
      setCurrentTrack(track);
      setIndex(idx);
      setMode("track");
      setStream(null);

      // Détermine l'URL : full stream (yt-dlp) si activé, sinon preview Deezer 30s
      let uri = track.preview;
      if (isFullStreamMode) {
        const query = `${track.artist?.name || ""} ${track.title}`.trim();
        // On envoie la durée Deezer (en secondes) pour que le backend filtre
        // les vidéos YouTube extended/intro+outro qui ajoutent 3-4 min faussement
        const full = await resolveFullStream(query, track.duration);
        if (full?.url) uri = full.url;
      }
      if (!uri) throw new Error("Pas d'URL audio disponible");

      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true }, onStatus);
      soundRef.current = sound;
    } catch (e) {
      console.warn("Erreur lecture:", e);
    } finally {
      setIsLoading(false);
    }
  }, [onStatus, isFullStreamMode]);

  const playQueue = useCallback(async (tracks: Track[], startIndex = 0) => {
    // En mode FullStream, on n'exige plus le preview (yt-dlp résoudra une URL)
    const valid = isFullStreamMode ? tracks : tracks.filter((t) => !!t.preview);
    if (valid.length === 0) return;
    setQueue(valid);
    await loadAndPlay(valid, Math.max(0, Math.min(startIndex, valid.length - 1)));

    // Préchargement HTTP des 10 prochains tracks (mode preview) pour fluidifier la lecture
    if (!isFullStreamMode) {
      setTimeout(() => {
        valid.slice(startIndex + 1, startIndex + 11).forEach((t) => {
          if (t.preview) fetch(t.preview, { method: "HEAD" }).catch(() => {});
        });
      }, 1500);
    }
  }, [loadAndPlay, isFullStreamMode]);

  const playStream = useCallback(async (s: StreamInfo) => {
    try {
      setIsLoading(true);
      await unload();
      // Met à jour l'UI immédiatement (l'utilisateur voit que la radio démarre)
      setStream(s);
      setMode("stream");
      setCurrentTrack(null);
      setQueue([]);
      setIndex(-1);
      const { sound } = await Audio.Sound.createAsync({ uri: s.url }, { shouldPlay: true }, onStatus);
      soundRef.current = sound;
    } catch (e: any) {
      console.warn("Erreur stream:", e?.message || e);
      // Réinitialise l'état si la lecture a échoué
      await unload();
      setStream(null);
      setMode("track");
      setIsPlaying(false);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [onStatus]);

  const togglePlay = useCallback(async () => {
    if (!soundRef.current) return;
    const st = await soundRef.current.getStatusAsync();
    if (!st.isLoaded) return;
    if (st.isPlaying) await soundRef.current.pauseAsync();
    else await soundRef.current.playAsync();
  }, []);

  const next = useCallback(async () => {
    if (mode === "stream" || queue.length === 0) return;
    const ni = (index + 1) % queue.length;
    await loadAndPlay(queue, ni);
  }, [queue, index, loadAndPlay, mode]);

  const previous = useCallback(async () => {
    if (mode === "stream" || queue.length === 0) return;
    if (positionMs > 3000 && soundRef.current) {
      await soundRef.current.setPositionAsync(0);
      return;
    }
    const pi = (index - 1 + queue.length) % queue.length;
    await loadAndPlay(queue, pi);
  }, [queue, index, positionMs, loadAndPlay, mode]);

  const nextRef = useRef(next);
  useEffect(() => { nextRef.current = next; }, [next]);

  const seekTo = useCallback(async (ms: number) => {
    // Pour les radios "live", pas de seek possible — mais autorisé pour podcasts
    if (mode === "stream" && stream?.kind !== "podcast") return;
    if (!soundRef.current) return;
    await soundRef.current.setPositionAsync(ms);
  }, [mode, stream]);

  const stop = useCallback(async () => {
    await unload();
    setIsPlaying(false);
    setCurrentTrack(null);
    setStream(null);
    setQueue([]);
    setIndex(-1);
  }, []);

  useEffect(() => {
    return () => { soundRef.current?.unloadAsync().catch(() => {}); };
  }, []);

  return (
    <PlayerContext.Provider
      value={{ mode, currentTrack, stream, queue, index, isPlaying, isLoading, isFullStreamMode, positionMs, durationMs, setFullStreamMode, playQueue, playStream, togglePlay, next, previous, seekTo, stop }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
