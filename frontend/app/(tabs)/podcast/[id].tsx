// PodcastDetail — Page d'un podcast avec liste d'épisodes (full audio)
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "../../../src/api/client";
import { usePlayer } from "../../../src/context/PlayerContext";
import { useLibrary } from "../../../src/context/LibraryContext";
import NewBadge, { isRecent } from "../../../src/components/NewBadge";
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
  const m = Math.floor(s / 60); const sec = s % 60;
  if (m >= 60) return `${Math.floor(m/60)}h${(m%60).toString().padStart(2,"0")}`;
  return `${m}min`;
}

export default function PodcastDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { playStream, mode, stream, isPlaying } = usePlayer();
  const { isPodcastSaved, togglePodcast } = useLibrary();
  const [data, setData] = useState<{ podcast: PodcastMeta; episodes: Episode[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await api<{ podcast: PodcastMeta; episodes: Episode[] }>(`/podcasts/${id}/episodes`);
        setData(r);
      } catch (e) { console.warn(e); }
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.primary} /></SafeAreaView>;
  if (!data) return <SafeAreaView style={styles.center}><Text style={{color:colors.textPrimary, fontFamily: fonts.body}}>Podcast introuvable</Text></SafeAreaView>;

  const { podcast, episodes } = data;
  const saved = isPodcastSaved(podcast.id);

  const playEpisode = (ep: Episode) => {
    playStream({ name: ep.title, subtitle: podcast.name, artwork: podcast.artwork, url: ep.audio_url, kind: "podcast" });
  };

  return (
    <View style={styles.container}>
      <Image source={{ uri: podcast.artwork }} style={styles.bg} blurRadius={50} />
      <LinearGradient colors={["rgba(5,5,8,0.5)", colors.background]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={styles.headerNav}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}>
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
              const playing = mode === "stream" && stream?.url === ep.audio_url && isPlaying;
              return (
                <TouchableOpacity key={ep.id} testID={`episode-${ep.id}`} onPress={() => playEpisode(ep)} style={styles.epRow}>
                  <View style={styles.playIcon}>
                    <Ionicons name={playing ? "pause" : "play"} size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <View style={styles.epTitleRow}>
                      <Text style={styles.epTitle} numberOfLines={2}>{ep.title}</Text>
                      {isRecent(ep.pub_date, 14) ? <View style={styles.epBadge}><NewBadge small /></View> : null}
                    </View>
                    <Text style={styles.epMeta}>{ep.pub_date?.slice(5, 16)} · {fmtDur(ep.duration)}</Text>
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
  epRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  playIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  epTitleRow: { flexDirection: "row", alignItems: "flex-start" },
  epBadge: { marginLeft: 6, marginTop: 2 },
  epTitle: { color: colors.textPrimary, fontFamily: fonts.bodyMed, fontSize: 14, flexShrink: 1 },
  epMeta: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12, marginTop: 4 },
});
