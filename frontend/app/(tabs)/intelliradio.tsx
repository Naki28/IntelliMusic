// IntelliRadioView — Programme courant + planning + lecture (musique ou stream RMC)
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, RefreshControl, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api/client";
import { usePlayer } from "../../src/context/PlayerContext";
import { colors, fonts, radii, spacing } from "../../src/theme";
import type { Track } from "../../src/types/music";
import TrackRow from "../../src/components/TrackRow";

interface Program {
  slot: string;
  start: number;
  end: number;
  name: string;
  tagline: string;
  kind: "music" | "rmc";
  stream_url?: string;
}

interface RadioResponse {
  program: Program;
  user: { name: string; country?: string };
  tracks: Track[];
  stream_url: string | null;
}

const slotIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  "06-10": "sunny", "10-14": "compass", "14-16": "albums", "16-20": "musical-notes", "20-0130": "mic", "0130-06": "moon",
};

function formatSlotLabel(slot: string): string {
  // 20-0130 → "20h-01h30", 0130-06 → "01h30-06h", 06-10 → "06h-10h"
  const map: Record<string, string> = {
    "06-10": "06h-10h",
    "10-14": "10h-14h",
    "14-16": "14h-16h",
    "16-20": "16h-20h",
    "20-0130": "20h-01h30",
    "0130-06": "01h30-06h",
  };
  return map[slot] || slot;
}

export default function IntelliRadioView() {
  const { playQueue, playStream, mode, stream, isLoading, isPlaying } = usePlayer();
  const [data, setData] = useState<RadioResponse | null>(null);
  const [schedule, setSchedule] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [radio, sched] = await Promise.all([
        api<RadioResponse>("/intelliradio"),
        api<{ programs: Program[] }>("/intelliradio/schedule"),
      ]);
      setData(radio);
      setSchedule(sched.programs);
    } catch (e) {
      setError("Impossible de charger IntelliRadio");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></SafeAreaView>;
  }

  const prog = data?.program;
  const isRmc = prog?.kind === "rmc";
  const isPlayingThisStream = mode === "stream" && stream?.url && data?.stream_url && stream.url === data.stream_url && isPlaying;

  const handlePlay = async () => {
    if (!data) return;
    try {
      if (isRmc && data.stream_url) {
        await playStream({
          name: prog!.name,
          subtitle: prog!.tagline,
          artwork: "https://images.pexels.com/photos/144429/pexels-photo-144429.jpeg?auto=compress&cs=tinysrgb&w=640",
          url: data.stream_url,
        });
      } else if (data.tracks.length > 0) {
        await playQueue(data.tracks, 0);
      }
    } catch (e: any) {
      Alert.alert(
        "Lecture impossible",
        isRmc
          ? "Le flux RMC n'a pas pu être lu (le navigateur web a souvent des restrictions sur les streams MP3 cross-origin). Essaie sur Expo Go (mobile) où ça fonctionne nativement."
          : "Impossible de démarrer la lecture."
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>IntelliRadio</Text>
          <Text style={styles.subtitle}>Ta radio personnalisée</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Hero programme courant — entièrement cliquable */}
        {prog ? (
          <TouchableOpacity
            testID="radio-hero"
            activeOpacity={0.85}
            onPress={handlePlay}
            style={[styles.hero, isRmc && { backgroundColor: "#1a0a0c" }]}
          >
            <LinearGradient
              colors={isRmc ? ["#3a0c10", colors.primaryHover, "#1a0a0c"] : ["#1A0506", colors.surfaceElevated, colors.surface]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.heroTop}>
              <View style={[styles.liveDot, isRmc && { backgroundColor: "#fff" }]} />
              <Text style={styles.liveText}>{isRmc ? "EN DIRECT" : "À L'ANTENNE"}</Text>
              <Text style={styles.slot}>{formatSlotLabel(prog.slot)}</Text>
            </View>
            <Ionicons
              name={slotIcons[prog.slot] || "radio"}
              size={48}
              color={colors.accent}
              style={{ marginTop: spacing.md }}
            />
            <Text style={styles.heroName}>{prog.name}</Text>
            <Text style={styles.heroTag}>{prog.tagline}</Text>

            <View style={styles.playBtn} testID="radio-play-btn">
              {isLoading && (mode === "stream" || isPlayingThisStream) ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name={isPlayingThisStream ? "pause" : "play"} size={20} color="#fff" />
              )}
              <Text style={styles.playText}>{isRmc ? (isPlayingThisStream ? "En écoute" : "Écouter en direct") : "Lancer la radio"}</Text>
            </View>

            {data && data.user.name ? (
              <Text style={styles.heroFooter}>Pour {data.user.name} • {data.user.country || "FR"}</Text>
            ) : null}
          </TouchableOpacity>
        ) : null}

        {/* Tracks de la programmation (si pas RMC) */}
        {!isRmc && data && data.tracks.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Ta playlist</Text>
            {data.tracks.slice(0, 12).map((t, i) => (
              <TrackRow key={t.id} track={t} index={i} onPress={() => playQueue(data.tracks, i)} />
            ))}
          </>
        ) : null}

        {/* Planning du jour */}
        <Text style={styles.sectionTitle}>Programme de la journée</Text>
        {schedule.map((p) => {
          const active = prog && p.slot === prog.slot;
          return (
            <View key={p.slot} style={[styles.scheduleRow, active && styles.scheduleActive]}>
              <View style={[styles.scheduleIcon, active && { backgroundColor: colors.primary }]}>
                <Ionicons name={slotIcons[p.slot] || "radio"} size={18} color={active ? "#fff" : colors.textSecondary} />
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.scheduleName}>{p.name}</Text>
                <Text style={styles.scheduleTag}>{p.tagline}</Text>
              </View>
              <Text style={styles.scheduleSlot}>{formatSlotLabel(p.slot)}</Text>
            </View>
          );
        })}

        <View style={{ height: 200 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  header: { paddingTop: spacing.md, marginBottom: spacing.md },
  title: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 28, letterSpacing: -1 },
  subtitle: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
  error: { color: colors.primary, fontFamily: fonts.body, marginVertical: spacing.md },
  hero: { borderRadius: radii.lg, padding: spacing.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border, minHeight: 240 },
  heroTop: { flexDirection: "row", alignItems: "center" },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginRight: 6 },
  liveText: { color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.5 },
  slot: { color: colors.textSecondary, fontFamily: fonts.bodyMed, fontSize: 12, marginLeft: "auto" },
  heroName: { color: "#fff", fontFamily: fonts.heading, fontSize: 28, marginTop: spacing.sm, letterSpacing: -1 },
  heroTag: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 14, marginTop: 4 },
  playBtn: { flexDirection: "row", alignItems: "center", backgroundColor: colors.primary, alignSelf: "flex-start", paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radii.pill, marginTop: spacing.lg },
  playText: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 13, marginLeft: 6 },
  heroFooter: { color: colors.textTertiary, fontFamily: fonts.body, fontSize: 11, marginTop: spacing.md },
  sectionTitle: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 20, marginTop: spacing.xl, marginBottom: spacing.sm },
  scheduleRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radii.md, marginBottom: 6 },
  scheduleActive: { backgroundColor: "rgba(229,56,59,0.10)", borderWidth: 1, borderColor: "rgba(229,56,59,0.3)" },
  scheduleIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  scheduleName: { color: colors.textPrimary, fontFamily: fonts.bodyMed, fontSize: 14 },
  scheduleTag: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  scheduleSlot: { color: colors.textTertiary, fontFamily: fonts.bodyMed, fontSize: 12 },
});
