// IntelliRadioView — Programme courant + planning + lecture (musique ou stream RMC)
// Avec horloge virtuelle et mode Classic (<2016)
import React, { useEffect, useState, useCallback, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image, RefreshControl, Alert, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../src/api/client";
import { usePlayer } from "../../src/context/PlayerContext";
import { useContextMenu } from "../../src/context/ContextMenuContext";
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

interface DailyResponse {
  program: Program;
  live: boolean;
  tracks: Track[];
  current_index: number;
  offset_in_track_sec: number;
  virtual_position_sec: number;
  total_duration_sec: number;
  stream_url?: string;
}

const slotIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  "06-10": "sunny", "10-14": "compass", "14-16": "albums", "16-20": "musical-notes", "20-0130": "mic", "0130-06": "moon", "classic-mode": "time",
};

function formatSlotLabel(slot: string): string {
  const map: Record<string, string> = {
    "06-10": "06h-10h", "10-14": "10h-14h", "14-16": "14h-16h", "16-20": "16h-20h",
    "20-0130": "20h-01h30", "0130-06": "01h30-06h", "classic-mode": "Toute la journée",
  };
  return map[slot] || slot;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function IntelliRadioView() {
  const { playQueue, playStream, addToQueue, mode, stream, isLoading, isPlaying, seekTo } = usePlayer();
  const { openTrackMenu } = useContextMenu();
  const [data, setData] = useState<RadioResponse | null>(null);
  const [dailyData, setDailyData] = useState<DailyResponse | null>(null);
  const [schedule, setSchedule] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Mode switches
  const [classicMode, setClassicMode] = useState(false);
  const [virtualClockMode, setVirtualClockMode] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const modeParam = classicMode ? "?mode=classic" : "";
      const [radio, sched, daily] = await Promise.all([
        api<RadioResponse>(`/intelliradio${modeParam}`),
        api<{ programs: Program[] }>("/intelliradio/schedule"),
        api<DailyResponse>("/intelliradio/daily"),
      ]);
      setData(radio);
      setSchedule(sched.programs);
      setDailyData(daily);
    } catch (e) {
      setError("Impossible de charger IntelliRadio");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [classicMode]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  // Reload quand le mode change
  useEffect(() => { 
    setLoading(true);
    load(); 
  }, [classicMode]);

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
        // Mode horloge virtuelle : commencer au track "live" avec le bon timecode
        if (virtualClockMode && dailyData && dailyData.tracks.length > 0) {
          const idx = dailyData.current_index;
          const offsetMs = Math.floor(dailyData.offset_in_track_sec * 1000);
          await playQueue(dailyData.tracks, idx);
          // Attendre un peu que le player charge, puis seek au bon timecode
          setTimeout(() => {
            if (offsetMs > 1000) {
              seekTo(offsetMs).catch(() => {});
            }
          }, 500);
        } else {
          await playQueue(data.tracks, 0);
        }
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

        {/* Mode toggles */}
        <View style={styles.modesContainer}>
          <View style={styles.modeRow}>
            <View style={styles.modeInfo}>
              <Ionicons name="time" size={20} color={classicMode ? colors.textTertiary : colors.accent} />
              <Text style={[styles.modeLabel, classicMode && styles.modeLabelInactive]}>Mode Classic</Text>
            </View>
            <Text style={styles.modeDesc}>Titres avant 2016</Text>
            <Switch
              value={classicMode}
              onValueChange={setClassicMode}
              trackColor={{ false: colors.surface, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
          
          {!isRmc && (
            <View style={styles.modeRow}>
              <View style={styles.modeInfo}>
                <Ionicons name="radio" size={20} color={virtualClockMode ? colors.accent : colors.textTertiary} />
                <Text style={[styles.modeLabel, !virtualClockMode && styles.modeLabelInactive]}>Horloge virtuelle</Text>
              </View>
              <Text style={styles.modeDesc}>Rejoindre le "live"</Text>
              <Switch
                value={virtualClockMode}
                onValueChange={setVirtualClockMode}
                trackColor={{ false: colors.surface, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          )}
        </View>

        {/* Info horloge virtuelle */}
        {virtualClockMode && dailyData && dailyData.tracks.length > 0 && !isRmc && (
          <View style={styles.virtualClockInfo}>
            <Ionicons name="pulse" size={16} color={colors.accent} />
            <Text style={styles.virtualClockText}>
              En cours : {dailyData.tracks[dailyData.current_index]?.title || "..."} 
              {dailyData.offset_in_track_sec > 0 ? ` (à ${formatTime(dailyData.offset_in_track_sec)})` : ""}
            </Text>
          </View>
        )}

        {/* Hero programme courant — entièrement cliquable */}
        {prog ? (
          <TouchableOpacity
            testID="radio-hero"
            activeOpacity={0.85}
            onPress={handlePlay}
            style={[styles.hero, isRmc && { backgroundColor: "#1a0a0c" }, classicMode && styles.heroClassic]}
          >
            <LinearGradient
              colors={
                classicMode 
                  ? ["#2a1a00", "#1a1200", "#0a0800"]
                  : isRmc 
                    ? ["#3a0c10", colors.primaryHover, "#1a0a0c"] 
                    : ["#1A0506", colors.surfaceElevated, colors.surface]
              }
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <View style={styles.heroTop}>
              <View style={[styles.liveDot, isRmc && { backgroundColor: "#fff" }, classicMode && { backgroundColor: "#d4a017" }]} />
              <Text style={[styles.liveText, classicMode && { color: "#d4a017" }]}>
                {classicMode ? "CLASSIC MODE" : isRmc ? "EN DIRECT" : virtualClockMode ? "LIVE VIRTUEL" : "À L'ANTENNE"}
              </Text>
              <Text style={styles.slot}>{formatSlotLabel(prog.slot)}</Text>
            </View>
            <Ionicons
              name={classicMode ? "time" : slotIcons[prog.slot] || "radio"}
              size={48}
              color={classicMode ? "#d4a017" : colors.accent}
              style={{ marginTop: spacing.md }}
            />
            <Text style={styles.heroName}>{prog.name}</Text>
            <Text style={styles.heroTag}>{prog.tagline}</Text>

            <View style={[styles.playBtn, classicMode && { backgroundColor: "#b8860b" }]} testID="radio-play-btn">
              {isLoading && (mode === "stream" || isPlayingThisStream) ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name={isPlayingThisStream ? "pause" : "play"} size={20} color="#fff" />
              )}
              <Text style={styles.playText}>
                {isRmc 
                  ? (isPlayingThisStream ? "En écoute" : "Écouter en direct") 
                  : virtualClockMode 
                    ? "Rejoindre le live" 
                    : "Lancer la radio"}
              </Text>
            </View>

            {data && data.user.name ? (
              <Text style={styles.heroFooter}>Pour {data.user.name} • {data.user.country || "FR"}</Text>
            ) : null}
          </TouchableOpacity>
        ) : null}

        {/* Tracks de la programmation (si pas RMC) */}
        {!isRmc && data && data.tracks.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>
              {virtualClockMode ? "Programme du jour" : "Ta playlist"}
              {classicMode ? " (avant 2016)" : ""}
            </Text>
            {(virtualClockMode && dailyData ? dailyData.tracks : data.tracks).slice(0, 15).map((t, i) => {
              const isCurrent = virtualClockMode && dailyData && i === dailyData.current_index;
              return (
                <View key={t.id} style={isCurrent ? styles.currentTrackRow : undefined}>
                  {isCurrent && (
                    <View style={styles.currentIndicator}>
                      <Ionicons name="radio" size={12} color={colors.accent} />
                      <Text style={styles.currentText}>En cours</Text>
                    </View>
                  )}
                  <TrackRow
                    track={t}
                    index={i}
                    onPress={() => playQueue(virtualClockMode && dailyData ? dailyData.tracks : data.tracks, i)}
                    onLongPress={() => openTrackMenu(t)}
                  />
                </View>
              );
            })}
          </>
        ) : null}

        {/* Planning du jour */}
        <Text style={styles.sectionTitle}>Programme de la journée</Text>
        {schedule.map((p) => {
          const active = prog && p.slot === prog.slot && !classicMode;
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
  
  // Mode toggles
  modesContainer: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  modeInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  modeLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.bodyMed,
    fontSize: 14,
    marginLeft: spacing.sm,
  },
  modeLabelInactive: {
    color: colors.textTertiary,
  },
  modeDesc: {
    color: colors.textTertiary,
    fontFamily: fonts.body,
    fontSize: 11,
    marginRight: spacing.md,
  },
  
  // Virtual clock info
  virtualClockInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(229,56,59,0.1)",
    padding: spacing.sm,
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  virtualClockText: {
    color: colors.accent,
    fontFamily: fonts.bodyMed,
    fontSize: 12,
    marginLeft: spacing.xs,
    flex: 1,
  },
  
  // Hero
  hero: { borderRadius: radii.lg, padding: spacing.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.border, minHeight: 240 },
  heroClassic: { borderColor: "#d4a017" },
  heroTop: { flexDirection: "row", alignItems: "center" },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginRight: 6 },
  liveText: { color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.5 },
  slot: { color: colors.textSecondary, fontFamily: fonts.bodyMed, fontSize: 12, marginLeft: "auto" },
  heroName: { color: "#fff", fontFamily: fonts.heading, fontSize: 28, marginTop: spacing.sm, letterSpacing: -1 },
  heroTag: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 14, marginTop: 4 },
  playBtn: { flexDirection: "row", alignItems: "center", backgroundColor: colors.primary, alignSelf: "flex-start", paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radii.pill, marginTop: spacing.lg },
  playText: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 13, marginLeft: 6 },
  heroFooter: { color: colors.textTertiary, fontFamily: fonts.body, fontSize: 11, marginTop: spacing.md },
  
  // Current track indicator
  currentTrackRow: {
    backgroundColor: "rgba(229,56,59,0.08)",
    borderRadius: radii.md,
    marginHorizontal: -spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  currentIndicator: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: spacing.xs,
    paddingLeft: spacing.xs,
  },
  currentText: {
    color: colors.accent,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    marginLeft: 4,
    textTransform: "uppercase",
  },
  
  sectionTitle: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 20, marginTop: spacing.xl, marginBottom: spacing.sm },
  scheduleRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radii.md, marginBottom: 6 },
  scheduleActive: { backgroundColor: "rgba(229,56,59,0.10)", borderWidth: 1, borderColor: "rgba(229,56,59,0.3)" },
  scheduleIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  scheduleName: { color: colors.textPrimary, fontFamily: fonts.bodyMed, fontSize: 14 },
  scheduleTag: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  scheduleSlot: { color: colors.textTertiary, fontFamily: fonts.bodyMed, fontSize: 12 },
});
