// PodcastProgressContext — Suivi local de la progression d'écoute des épisodes
// Persistence AsyncStorage → reprise automatique + badge "Écouté" + "X min restantes"
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface EpisodeProgress {
  positionMs: number;
  durationMs: number;
  updatedAt: number;
  completed: boolean;
}

interface State {
  ready: boolean;
  getProgress: (episodeId: string) => EpisodeProgress | undefined;
  saveProgress: (episodeId: string, positionMs: number, durationMs: number) => void;
  markCompleted: (episodeId: string) => void;
  clearProgress: (episodeId: string) => void;
}

const STORAGE_KEY = "@podcast_progress_v1";
// Seuil pour considérer un épisode "terminé" (95%)
const COMPLETE_RATIO = 0.95;

const Ctx = createContext<State | undefined>(undefined);

export function PodcastProgressProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<Record<string, EpisodeProgress>>({});
  const [ready, setReady] = useState(false);
  const progressRef = useRef(progress);
  useEffect(() => { progressRef.current = progress; }, [progress]);

  // Charge depuis AsyncStorage au démarrage
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setProgress(JSON.parse(raw));
      } catch (e) { console.warn("Progress load error:", e); }
      finally { setReady(true); }
    })();
  }, []);

  // Throttled persist — on sauvegarde au max toutes les 3s
  const persistTimer = useRef<any>(null);
  const schedulePersist = useCallback(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progressRef.current));
      } catch (e) { console.warn("Progress save error:", e); }
    }, 3000);
  }, []);

  const getProgress = useCallback((episodeId: string) => {
    return progressRef.current[episodeId];
  }, []);

  const saveProgress = useCallback((episodeId: string, positionMs: number, durationMs: number) => {
    if (!episodeId || positionMs < 0) return;
    setProgress((prev) => {
      const existing = prev[episodeId];
      // Ne marque pas "completed" automatiquement ici, seul markCompleted le fait
      const already = !!existing?.completed;
      const completed = already || (durationMs > 0 && positionMs / durationMs >= COMPLETE_RATIO);
      return {
        ...prev,
        [episodeId]: {
          positionMs: Math.floor(positionMs),
          durationMs: Math.floor(durationMs),
          updatedAt: Date.now(),
          completed,
        },
      };
    });
    schedulePersist();
  }, [schedulePersist]);

  const markCompleted = useCallback((episodeId: string) => {
    if (!episodeId) return;
    setProgress((prev) => ({
      ...prev,
      [episodeId]: {
        positionMs: prev[episodeId]?.durationMs || 0,
        durationMs: prev[episodeId]?.durationMs || 0,
        updatedAt: Date.now(),
        completed: true,
      },
    }));
    schedulePersist();
  }, [schedulePersist]);

  const clearProgress = useCallback((episodeId: string) => {
    if (!episodeId) return;
    setProgress((prev) => {
      const next = { ...prev };
      delete next[episodeId];
      return next;
    });
    schedulePersist();
  }, [schedulePersist]);

  return (
    <Ctx.Provider value={{ ready, getProgress, saveProgress, markCompleted, clearProgress }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePodcastProgress() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePodcastProgress must be used within PodcastProgressProvider");
  return c;
}
