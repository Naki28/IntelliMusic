// PodcastDetail — Page d'un podcast avec liste d'épisodes (full audio)
// Features : badge NOUVEAU (top 4 + non écoutés), badge "Écouté", "X min restantes",
// reprise automatique, long-press → ajout à la file d'attente.
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, ToastAndroid, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../../src/api/client";
import { usePlayer, StreamInfo } from "../../../src/context/PlayerContext";
import { useLibrary } from "../../../src/context/LibraryContext";
import { usePodcastProgress } from "../../../src/context/PodcastProgressContext";
import NewBadge from "../../../src/components/NewBadge";
import { colors, fonts, radii, spacing } from "../../../src/theme";

interface Episode {
  id: string;
  title: string;
  audio_url: string;
  duration?: number;
  pub_date?: string;
  description?: string;
}
interface PodcastMeta {
  id: number;
  name: string;
  artist: string;
  artwork: string;
  summary: string;
}

function fmtDur(s?: number): string {
  if (!s) return "";
  const m = Math.floor(s / 60);
  if (m >= 60) return `${Math.floor(m/60)}h${(m%60).toString().padStart(2,"0")}`;
  return `${m}min`;
}
function fmtRemaining(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m >= 60) return `${Math.floor(m/60)}h${(m%60).toString().padStart(2,"0")} restantes`;
  if (m > 0) return `${m}min restantes`;
  return `${s}s restantes`;
}

function showToast(msg: string) {
  if (Platform.OS === "android") {
    try { ToastAndroid.show(msg, ToastAndroid.SHORT); return; } catch {}
  }
  // iOS / web fallback : alert discrète
  try { Alert.alert("", msg); } catch {}
}

// Construit un StreamInfo podcast pour un épisode
function toStream(ep: Episode, podcast: PodcastMeta): StreamInfo {
  return {
    name: ep.title,
    subtitle: podcast.name,
    artwork: podcast.artwork,
    url: ep.audio_url,
    kind: "podcast",
    episodeId: ep.id,
    podcastId: podcast.id,
    podcastName: podcast.name,
    podcastArtist: podcast.artist,
    durationSec: ep.duration,
  };
}

export default function PodcastDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { playStream, addToQueue, mode, stream, isPlaying } = usePlayer();
  const { isPodcastSaved, togglePodcast } = useLibrary();
  const { getProgress } = usePodcastProgress();
  const [data, setData] = useState<{ podcast: PodcastMeta; episodes: Episode[] } | null>(null);
  const [loading, setLoading] = useState(true);
  // Force re-render quand la progression change (useState ne se rafraîchit pas pour les refs)
  const [, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const r = await api<{ podcast: PodcastMeta; episodes: Episode[] }>(`/podcasts/${id}/episodes`);
        setData(r);
      } catch (e) { console.warn(e); }
      finally { setLoading(false); }
    })();
  }, [id]);

  // Tick périodique pour actualiser l'affichage "X min restantes" pendant la lecture
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 3000);
    return () => clearInterval(t);
  }, []);

  // Fix navigation : bouton retour → toujours vers la liste des podcasts
  // On utilise navigate (pas back qui remontait à l'accueil) et on force window.location sur web si besoin
  const handleBack = () => {
    if (Platform.OS === "web") {
      // @ts-ignore
      if (typeof window !== "undefined" && window.location) {
        window.location.assign("/podcasts");
        return;
      }
    }
    try { router.replace("/podcasts" as any); }
    catch { router.push("/podcasts" as any); }
  };

  // Calcul des IDs "top 4 récents non écoutés"
  const topRecentIds = useMemo(() => {
    if (!data) return new Set<string>();
    const sorted = [...data.episodes].sort((a, b) => {
      const da = a.pub_date ? Date.parse(a.pub_date) : 0;
      const db = b.pub_date ? Date.parse(b.pub_date) : 0;
      return db - da;
    });
    const ids = new Set<string>();
    for (const ep of sorted) {
      if (ids.size >= 4) break;
      const p = getProgress(ep.id);
      if (!p?.completed) ids.add(ep.id);
    }
    return ids;
  }, [data, getProgress]);

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.primary} /></SafeAreaView>;
  if (!data) return <SafeAreaView style={styles.center}><Text style={{color:colors.textPrimary, fontFamily: fonts.body}}>Podcast introuvable</Text></SafeAreaView>;

  const { podcast, episodes } = data;
  const saved = isPodcastSaved(podcast.id);

  const playEpisode = (ep: Episode) => {
    playStream(toStream(ep, podcast));
  };
  const handleLongPress = (ep: Episode) => {
    addToQueue([toStream(ep, podcast)]);
    showToast("Ajouté à la file d'attente");
  };

  return (
    <View style={styles.container}>
      <Image source={{ uri: podcast.artwork }} style={styles.bg} blurRadius={50} />
      <LinearGradient colors={["rgba(5,5,8,0.5)", colors.background]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={styles.headerNav}>
          <TouchableOpacity testID="podcast-back" onPress={handleBack} hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}>
            <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 220 }} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Image source={{ uri: podcast.artwork }} style={styles.cover} />
            <Text style={styles.title} numberOfLines={2}>{podcast.name}</Text>
            <Text style={styles.artist}>{podcast.artist}</Text>
            <TouchableOpacity testID="podcast-save" onPress={() => togglePodcast({ id: podcast.id, name: podcast.name, artist: podcast.artist, image: podcast.artwork } as any)} style={[styles.saveBtn, saved && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
              <Ionicons name={saved ? "checkmark" : "add"} size={18} color={saved ? "#fff" : colors.textPrimary} />
              <Text style={[styles.saveText, saved && { color: "#fff" }]}>{saved ? "Suivi" : "S'abonner"}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.section}>{episodes.length} épisode{episodes.length > 1 ? "s" : ""}</Text>
          <View style={{ paddingHorizontal: spacing.lg }}>
            {episodes.map((ep) => {
              const isCurrent = mode === "stream" && stream?.url === ep.audio_url;
              const playing = isCurrent && isPlaying;
              const p = getProgress(ep.id);
              const isCompleted = !!p?.completed;
              // "in progress" : a une position enregistrée, non terminé, et suffisamment loin du début
              const inProgress = p && !isCompleted && p.positionMs > 10000 && (!p.durationMs || p.positionMs < p.durationMs - 10000);
              const showNewBadge = topRecentIds.has(ep.id) && !isCompleted;

              // Calcul du temps restant à afficher
              let remainingText = "";
              if (inProgress) {
                const totalMs = p!.durationMs > 0 ? p!.durationMs : (ep.duration ? ep.duration * 1000 : 0);
                const remMs = Math.max(0, totalMs - p!.positionMs);
                if (remMs > 0) remainingText = fmtRemaining(remMs);
              }

              return (
                <TouchableOpacity
                  key={ep.id}
                  testID={`episode-${ep.id}`}
                  onPress={() => playEpisode(ep)}
                  onLongPress={() => handleLongPress(ep)}
                  delayLongPress={400}
                  style={[styles.epRow, isCurrent && styles.epRowCurrent]}
                >
                  <View style={[styles.playIcon, isCompleted && styles.playIconCompleted]}>
                    {isCompleted ? (
                      <Ionicons name="checkmark" size={18} color={colors.textPrimary} />
                    ) : (
                      <Ionicons name={playing ? "pause" : "play"} size={18} color={colors.primary} />
                    )}
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <View style={styles.epTitleRow}>
                      <Text
                        style={[styles.epTitle, isCompleted && styles.epTitleDim, isCurrent && { color: colors.primary }]}
                        numberOfLines={2}
                      >
                        {ep.title}
                      </Text>
                      {showNewBadge ? <View style={styles.epBadge}><NewBadge small /></View> : null}
                    </View>
                    <View style={styles.epMetaRow}>
                      <Text style={styles.epMeta}>{ep.pub_date?.slice(5, 16)} · {fmtDur(ep.duration)}</Text>
                      {isCompleted ? (
                        <View style={styles.doneChip}>
                          <Ionicons name="checkmark-circle" size={12} color={colors.textSecondary} />
                          <Text style={styles.doneChipText}>Écouté</Text>
                        </View>
                      ) : null}
                      {inProgress && remainingText ? (
                        <View style={styles.remChip}>
                          <Ionicons name="time-outline" size={12} color={colors.primary} />
                          <Text style={styles.remChipText}>{remainingText}</Text>
                        </View>
                      ) : null}
                    </View>
                    {/* Mini barre de progression si en cours */}
                    {inProgress ? (
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.min(100, Math.max(4, (p!.positionMs / Math.max(1, p!.durationMs || (ep.duration ? ep.duration * 1000 : 1))) * 100))}%`,
                            },
                          ]}
                        />
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  bg: { ...StyleSheet.absoluteFillObject, opacity: 0.4 },
  headerNav: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  hero: { alignItems: "center", padding: spacing.lg },
  cover: { width: 200, height: 200, borderRadius: radii.lg, backgroundColor: colors.surface, marginBottom: spacing.md },
  title: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 24, textAlign: "center", letterSpacing: -1, paddingHorizontal: spacing.md },
  artist: { color: colors.textSecondary, fontFamily: fonts.bodyMed, fontSize: 13, marginTop: 4 },
  saveBtn: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radii.pill, marginTop: spacing.md },
  saveText: { color: colors.textPrimary, fontFamily: fonts.bodyMed, fontSize: 13, marginLeft: 6 },
  section: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 18, paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm },
  epRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  epRowCurrent: { backgroundColor: "rgba(229,56,59,0.05)" },
  playIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  playIconCompleted: { backgroundColor: "rgba(255,255,255,0.05)", borderColor: colors.border },
  epTitleRow: { flexDirection: "row", alignItems: "flex-start" },
  epBadge: { marginLeft: 6, marginTop: 2 },
  epTitle: { color: colors.textPrimary, fontFamily: fonts.bodyMed, fontSize: 14, flexShrink: 1 },
  epTitleDim: { color: colors.textSecondary },
  epMetaRow: { flexDirection: "row", alignItems: "center", marginTop: 4, flexWrap: "wrap" },
  epMeta: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12 },
  doneChip: { flexDirection: "row", alignItems: "center", marginLeft: 8, backgroundColor: "rgba(255,255,255,0.05)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.pill },
  doneChipText: { color: colors.textSecondary, fontFamily: fonts.bodyMed, fontSize: 10, marginLeft: 3 },
  remChip: { flexDirection: "row", alignItems: "center", marginLeft: 8, backgroundColor: "rgba(229,56,59,0.12)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.pill },
  remChipText: { color: colors.primary, fontFamily: fonts.bodyMed, fontSize: 10, marginLeft: 3 },
  progressTrack: { height: 3, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 2, marginTop: 6, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: colors.primary },
});
