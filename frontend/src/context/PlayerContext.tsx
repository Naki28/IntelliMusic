// AudioPlayerViewModel — Lecture audio avec queue unifiée (tracks + épisodes podcast)
// Features: shuffle, repeat (off/all/one), volume, sleep timer, add-to-queue, play-next
// Suivi de progression des podcasts (reprise + marquage "écouté")
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { Audio, AVPlaybackStatus } from "expo-av";
import type { Track } from "../types/music";
import { resolveFullStream, FullStreamPref } from "../api/client";
import { usePodcastProgress } from "./PodcastProgressContext";
import { useHistory } from "./HistoryContext";

// ========== Types ==========
export interface StreamInfo {
  name: string;
  subtitle?: string;
  artwork?: string;
  url: string;
  kind?: "radio" | "podcast";
  // Pour les podcasts uniquement :
  episodeId?: string;
  podcastId?: number;
  podcastName?: string;
  podcastArtist?: string;
  durationSec?: number;
  resumePositionMs?: number;
}

export type QueueItemKind = "track" | "podcast";

export interface QueueItem {
  uid: string; // identifiant unique dans la queue
  kind: QueueItemKind;
  track?: Track; // si kind === "track"
  stream?: StreamInfo; // si kind === "podcast"
}

export type RepeatMode = "off" | "all" | "one";
export type PlayerMode = "track" | "stream" | "idle";

interface PlayerState {
  mode: PlayerMode;
  currentTrack: Track | null;
  stream: StreamInfo | null;
  queue: QueueItem[];
  index: number;
  isPlaying: boolean;
  isLoading: boolean;
  isFullStreamMode: boolean;
  positionMs: number;
  durationMs: number;
  bufferedMs: number;

  // Nouveaux states
  volume: number; // 0..1
  isShuffled: boolean;
  repeatMode: RepeatMode;
  sleepTimerEndAt: number | null; // timestamp ms

  setFullStreamMode: (v: boolean) => Promise<void>;
  playQueue: (tracks: Track[], startIndex?: number) => Promise<void>;
  playStream: (s: StreamInfo) => Promise<void>;
  togglePlay: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  seekTo: (ms: number) => Promise<void>;
  stop: () => Promise<void>;

  // Queue management
  addToQueue: (items: Array<Track | StreamInfo>) => void;
  playNext: (items: Array<Track | StreamInfo>) => void;
  removeFromQueue: (idx: number) => void;
  jumpTo: (idx: number) => Promise<void>;
  clearQueue: () => void;

  // Controls
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setVolume: (v: number) => Promise<void>;
  setSleepTimer: (minutes: number | null) => void;
}

const PlayerContext = createContext<PlayerState | undefined>(undefined);

// ========== Helpers ==========
let _uidSeq = 0;
const makeUid = () => `q_${Date.now()}_${++_uidSeq}`;

function toQueueItem(item: Track | StreamInfo): QueueItem {
  // Track -> id numérique, StreamInfo -> url + kind
  if ((item as Track).preview !== undefined || (item as Track).album !== undefined) {
    return { uid: makeUid(), kind: "track", track: item as Track };
  }
  const s = item as StreamInfo;
  return { uid: makeUid(), kind: "podcast", stream: { ...s, kind: "podcast" } };
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ========== Provider ==========
export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { getProgress, saveProgress, markCompleted } = usePodcastProgress();
  const { record: recordHistory } = useHistory();

  const soundRef = useRef<Audio.Sound | null>(null);
  const [mode, setMode] = useState<PlayerMode>("idle");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [index, setIndex] = useState<number>(-1);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [stream, setStream] = useState<StreamInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [bufferedMs, setBufferedMs] = useState(0);
  const [isFullStreamMode, setIsFullStreamMode] = useState(false);

  // Nouveaux states
  const [volume, setVolumeState] = useState(1);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [sleepTimerEndAt, setSleepTimerEndAt] = useState<number | null>(null);

  // Préférence full stream
  useEffect(() => { FullStreamPref.get().then(setIsFullStreamMode); }, []);

  const setFullStreamMode = useCallback(async (v: boolean) => {
    await FullStreamPref.set(v);
    setIsFullStreamMode(v);
  }, []);

  // Config audio background
  useEffect(() => {
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
      interruptionModeIOS: 1,
      interruptionModeAndroid: 1,
    }).catch(() => {});
  }, []);

  // Refs pour accès dans onStatus/next sans re-render
  const queueRef = useRef<QueueItem[]>([]);
  const indexRef = useRef<number>(-1);
  const modeRef = useRef<PlayerMode>("idle");
  const streamRef = useRef<StreamInfo | null>(null);
  const currentTrackRef = useRef<Track | null>(null);
  const repeatRef = useRef<RepeatMode>("off");
  const sleepEndRef = useRef<number | null>(null);
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { indexRef.current = index; }, [index]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { streamRef.current = stream; }, [stream]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { repeatRef.current = repeatMode; }, [repeatMode]);
  useEffect(() => { sleepEndRef.current = sleepTimerEndAt; }, [sleepTimerEndAt]);

  // Throttle sauvegarde progression podcast
  const lastSaveRef = useRef<number>(0);

  // Status callback
  const onStatus = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      const err = (status as any).error;
      if (err && currentTrackRef.current && isFullStreamMode) {
        const t = currentTrackRef.current;
        if (t.preview && soundRef.current) {
          (async () => {
            try {
              await soundRef.current?.unloadAsync();
              const { sound } = await Audio.Sound.createAsync({ uri: t.preview }, { shouldPlay: true, volume }, onStatus);
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

    // Sleep timer — coupe la lecture quand échéance atteinte
    if (sleepEndRef.current && Date.now() >= sleepEndRef.current) {
      sleepEndRef.current = null;
      setSleepTimerEndAt(null);
      soundRef.current?.pauseAsync().catch(() => {});
      return;
    }

    // Sauvegarde progression pour podcasts (toutes les 5s)
    if (modeRef.current === "stream" && streamRef.current?.kind === "podcast" && streamRef.current.episodeId) {
      const now = Date.now();
      if (now - lastSaveRef.current > 5000 && status.positionMillis) {
        lastSaveRef.current = now;
        saveProgress(streamRef.current.episodeId, status.positionMillis, status.durationMillis ?? 0);
      }
    }

    // Coupure auto à la durée Deezer officielle (évite outro YouTube)
    const t = currentTrackRef.current;
    const officialDurMs = t?.duration ? t.duration * 1000 : 0;
    if (t && officialDurMs > 0 && status.positionMillis && status.positionMillis >= officialDurMs - 250) {
      if (nextRef.current) nextRef.current(true);
      return;
    }

    // Anticipation : précharge track suivant à 75%
    if (status.durationMillis && status.positionMillis && queueRef.current.length > 0) {
      const ratio = status.positionMillis / status.durationMillis;
      if (ratio > 0.75 && !preloadedRef.current[indexRef.current + 1]) {
        const nextItem = queueRef.current[indexRef.current + 1];
        if (nextItem?.kind === "track" && nextItem.track?.preview) {
          preloadedRef.current[indexRef.current + 1] = true;
          fetch(nextItem.track.preview, { method: "HEAD" }).catch(() => {});
        }
      }
    }

    if (status.didJustFinish && nextRef.current) nextRef.current(true);
  }, [isFullStreamMode, saveProgress, volume]);

  const preloadedRef = useRef<Record<number, boolean>>({});
  useEffect(() => { preloadedRef.current = {}; }, [index]);

  const unload = async () => {
    if (soundRef.current) {
      try { await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
  };

  // Charge et joue un item de la queue
  const loadAndPlayItem = useCallback(async (items: QueueItem[], idx: number) => {
    const item = items[idx];
    if (!item) return;
    try {
      setIsLoading(true);
      await unload();

      if (item.kind === "track" && item.track) {
        // Optimiste : mise à jour UI immédiate
        setCurrentTrack(item.track);
        setStream(null);
        setMode("track");
        setIndex(idx);

        // Enregistrer dans l'historique
        recordHistory(item.track);

        let uri = item.track.preview;
        if (isFullStreamMode) {
          const query = `${item.track.artist?.name || ""} ${item.track.title}`.trim();
          const full = await resolveFullStream(query, item.track.duration);
          if (full?.url) uri = full.url;
        }
        if (!uri) throw new Error("Pas d'URL audio");
        const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true, volume }, onStatus);
        soundRef.current = sound;
      } else if (item.kind === "podcast" && item.stream) {
        const s = item.stream;
        // Reprise automatique si progression existante (et non terminé)
        let resumeMs = s.resumePositionMs;
        if (!resumeMs && s.episodeId) {
          const p = getProgress(s.episodeId);
          if (p && !p.completed && p.positionMs > 10000 && (!p.durationMs || p.positionMs < p.durationMs - 10000)) {
            resumeMs = p.positionMs;
          }
        }
        setCurrentTrack(null);
        setStream(s);
        setMode("stream");
        setIndex(idx);
        const { sound } = await Audio.Sound.createAsync(
          { uri: s.url },
          { shouldPlay: true, positionMillis: resumeMs || 0, volume },
          onStatus
        );
        soundRef.current = sound;
      }
    } catch (e) {
      console.warn("Erreur lecture:", e);
    } finally {
      setIsLoading(false);
    }
  }, [onStatus, isFullStreamMode, getProgress, volume]);

  // ========== API publique ==========
  const playQueue = useCallback(async (tracks: Track[], startIndex = 0) => {
    const valid = isFullStreamMode ? tracks : tracks.filter((t) => !!t.preview);
    if (valid.length === 0) return;
    const items = valid.map<QueueItem>((t) => ({ uid: makeUid(), kind: "track", track: t }));
    setQueue(items);
    setIsShuffled(false);
    const idx = Math.max(0, Math.min(startIndex, items.length - 1));
    await loadAndPlayItem(items, idx);

    // Préchargement HTTP des 10 prochains
    if (!isFullStreamMode) {
      setTimeout(() => {
        items.slice(idx + 1, idx + 11).forEach((it) => {
          if (it.track?.preview) fetch(it.track.preview, { method: "HEAD" }).catch(() => {});
        });
      }, 1500);
    }
  }, [loadAndPlayItem, isFullStreamMode]);

  const playStream = useCallback(async (s: StreamInfo) => {
    try {
      setIsLoading(true);
      await unload();

      if (s.kind === "podcast") {
        // Podcast → on crée une queue d'un seul item pour homogénéité
        const item: QueueItem = { uid: makeUid(), kind: "podcast", stream: { ...s, kind: "podcast" } };
        setQueue([item]);
        setIsShuffled(false);

        // Reprise auto si progression
        let resumeMs = s.resumePositionMs;
        if (!resumeMs && s.episodeId) {
          const p = getProgress(s.episodeId);
          if (p && !p.completed && p.positionMs > 10000 && (!p.durationMs || p.positionMs < p.durationMs - 10000)) {
            resumeMs = p.positionMs;
          }
        }
        setCurrentTrack(null);
        setStream(item.stream!);
        setMode("stream");
        setIndex(0);
        const { sound } = await Audio.Sound.createAsync(
          { uri: s.url },
          { shouldPlay: true, positionMillis: resumeMs || 0, volume },
          onStatus
        );
        soundRef.current = sound;
      } else {
        // Radio live — hors queue
        setStream(s);
        setMode("stream");
        setCurrentTrack(null);
        setQueue([]);
        setIndex(-1);
        const { sound } = await Audio.Sound.createAsync({ uri: s.url }, { shouldPlay: true, volume }, onStatus);
        soundRef.current = sound;
      }
    } catch (e: any) {
      console.warn("Erreur stream:", e?.message || e);
      await unload();
      setStream(null);
      setMode("idle");
      setIsPlaying(false);
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [onStatus, getProgress, volume]);

  const togglePlay = useCallback(async () => {
    if (!soundRef.current) return;
    const st = await soundRef.current.getStatusAsync();
    if (!st.isLoaded) return;
    if (st.isPlaying) await soundRef.current.pauseAsync();
    else await soundRef.current.playAsync();
  }, []);

  // next/previous — gèrent tracks ET podcasts (queue unifiée)
  // autoAdvance=true → appelé par "didJustFinish" → applique repeat rules
  const next = useCallback(async (autoAdvance = false) => {
    const q = queueRef.current;
    const i = indexRef.current;
    if (q.length === 0) return;

    // Marquer complet si podcast et avance auto
    if (autoAdvance && modeRef.current === "stream" && streamRef.current?.kind === "podcast" && streamRef.current.episodeId) {
      markCompleted(streamRef.current.episodeId);
    }

    // Repeat one → rejoue le même
    if (autoAdvance && repeatRef.current === "one") {
      if (soundRef.current) await soundRef.current.setPositionAsync(0);
      return;
    }

    let ni = i + 1;
    if (ni >= q.length) {
      if (repeatRef.current === "all") ni = 0;
      else {
        // Fin de queue → stop
        if (autoAdvance) {
          await unload();
          setIsPlaying(false);
        }
        return;
      }
    }
    await loadAndPlayItem(q, ni);
  }, [loadAndPlayItem, markCompleted]);

  const nextRef = useRef(next);
  useEffect(() => { nextRef.current = next; }, [next]);

  const previous = useCallback(async () => {
    const q = queueRef.current;
    const i = indexRef.current;
    if (q.length === 0) return;
    if (positionMs > 3000 && soundRef.current) {
      await soundRef.current.setPositionAsync(0);
      return;
    }
    let pi = i - 1;
    if (pi < 0) {
      if (repeatRef.current === "all") pi = q.length - 1;
      else pi = 0;
    }
    await loadAndPlayItem(q, pi);
  }, [positionMs, loadAndPlayItem]);

  const seekTo = useCallback(async (ms: number) => {
    // Radio live = pas de seek; podcast autorisé
    if (mode === "stream" && stream?.kind !== "podcast" && stream?.kind !== undefined) return;
    if (!soundRef.current) return;
    await soundRef.current.setPositionAsync(Math.max(0, ms));
  }, [mode, stream]);

  const stop = useCallback(async () => {
    await unload();
    setIsPlaying(false);
    setCurrentTrack(null);
    setStream(null);
    setQueue([]);
    setIndex(-1);
    setMode("idle");
  }, []);

  // ========== Queue management ==========
  const addToQueue = useCallback((items: Array<Track | StreamInfo>) => {
    if (!items || items.length === 0) return;
    const newItems = items.map(toQueueItem);
    setQueue((prev) => {
      const merged = [...prev, ...newItems];
      queueRef.current = merged;
      return merged;
    });
  }, []);

  const playNext = useCallback((items: Array<Track | StreamInfo>) => {
    if (!items || items.length === 0) return;
    const newItems = items.map(toQueueItem);
    setQueue((prev) => {
      const i = indexRef.current;
      const before = prev.slice(0, i + 1);
      const after = prev.slice(i + 1);
      const merged = [...before, ...newItems, ...after];
      queueRef.current = merged;
      return merged;
    });
  }, []);

  const removeFromQueue = useCallback((idx: number) => {
    setQueue((prev) => {
      if (idx < 0 || idx >= prev.length) return prev;
      if (idx === indexRef.current) return prev; // on ne supprime pas l'item en cours
      const merged = prev.filter((_, i) => i !== idx);
      // Ajuster l'index courant si on supprime avant
      if (idx < indexRef.current) {
        const newIdx = indexRef.current - 1;
        indexRef.current = newIdx;
        setIndex(newIdx);
      }
      queueRef.current = merged;
      return merged;
    });
  }, []);

  const jumpTo = useCallback(async (idx: number) => {
    const q = queueRef.current;
    if (idx < 0 || idx >= q.length) return;
    await loadAndPlayItem(q, idx);
  }, [loadAndPlayItem]);

  const clearQueue = useCallback(() => {
    setQueue((prev) => {
      const i = indexRef.current;
      if (i < 0 || i >= prev.length) { queueRef.current = []; return []; }
      const only = [prev[i]];
      indexRef.current = 0;
      setIndex(0);
      queueRef.current = only;
      return only;
    });
  }, []);

  // ========== Shuffle / Repeat / Volume / Sleep ==========
  const originalOrderRef = useRef<QueueItem[] | null>(null);

  const toggleShuffle = useCallback(() => {
    setQueue((prev) => {
      if (prev.length <= 1) return prev;
      const curIdx = indexRef.current;
      const curItem = prev[curIdx];
      if (!curItem) return prev;
      if (!isShuffled) {
        // Activer : mémoriser ordre original et mélanger le reste
        originalOrderRef.current = prev.slice();
        const rest = prev.filter((_, i) => i !== curIdx);
        const shuffled = shuffleArray(rest);
        const merged = [curItem, ...shuffled];
        indexRef.current = 0;
        setIndex(0);
        queueRef.current = merged;
        return merged;
      } else {
        // Désactiver : restaurer ordre original
        const original = originalOrderRef.current || prev;
        originalOrderRef.current = null;
        const newIdx = original.findIndex((it) => it.uid === curItem.uid);
        indexRef.current = Math.max(0, newIdx);
        setIndex(Math.max(0, newIdx));
        queueRef.current = original;
        return original;
      }
    });
    setIsShuffled((v) => !v);
  }, [isShuffled]);

  const cycleRepeat = useCallback(() => {
    setRepeatMode((m) => (m === "off" ? "all" : m === "all" ? "one" : "off"));
  }, []);

  const setVolume = useCallback(async (v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    if (soundRef.current) {
      try { await soundRef.current.setVolumeAsync(clamped); } catch {}
    }
  }, []);

  const setSleepTimer = useCallback((minutes: number | null) => {
    if (!minutes || minutes <= 0) {
      setSleepTimerEndAt(null);
      return;
    }
    setSleepTimerEndAt(Date.now() + minutes * 60 * 1000);
  }, []);

  // Auto-clean à la destruction
  useEffect(() => {
    return () => { soundRef.current?.unloadAsync().catch(() => {}); };
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        mode, currentTrack, stream, queue, index, isPlaying, isLoading, isFullStreamMode,
        positionMs, durationMs, volume, isShuffled, repeatMode, sleepTimerEndAt,
        setFullStreamMode, playQueue, playStream, togglePlay,
        next: () => next(false), previous, seekTo, stop,
        addToQueue, playNext, removeFromQueue, jumpTo, clearQueue,
        toggleShuffle, cycleRepeat, setVolume, setSleepTimer,
      }}
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
