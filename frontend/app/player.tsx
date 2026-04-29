// PlayerView — Lecteur plein écran (titre ou stream radio)
import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { usePlayer } from "../src/context/PlayerContext";
import { useFavorites } from "../src/context/FavoritesContext";
import { colors, fonts, radii, spacing } from "../src/theme";

function fmt(ms: number) {
  if (!ms || isNaN(ms)) return "0:00";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

export default function PlayerView() {
  const router = useRouter();
  const { mode, currentTrack, stream, isPlaying, isLoading, positionMs, durationMs, togglePlay, next, previous, seekTo } = usePlayer();
  const { isFavorite, toggleFavorite } = useFavorites();

  const isStream = mode === "stream" && stream;
  const isPodcast = isStream && stream?.kind === "podcast";
  const isLive = isStream && stream?.kind !== "podcast"; // radio en direct
  const cover = isStream ? stream.artwork : currentTrack?.album.cover_xl || currentTrack?.album.cover_big;
  const title = isStream ? stream.name : currentTrack?.title;
  const subtitle = isStream ? (stream.subtitle || "En direct") : currentTrack?.artist.name;

  // Pour les tracks Deezer, on utilise la durée officielle (track.duration en s)
  // comme référence si elle est présente, pour éviter les écarts yt-dlp (intros/outros).
  const officialDurMs = currentTrack?.duration ? currentTrack.duration * 1000 : 0;
  const effectiveDurationMs = !isStream && officialDurMs > 0
    ? officialDurMs
    : durationMs;
  const effectivePositionMs = Math.min(positionMs, effectiveDurationMs || positionMs);

  if (!isStream && !currentTrack) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Aucune lecture en cours</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={styles.closeText}>Fermer</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const fav = currentTrack ? isFavorite(currentTrack.id) : false;

  return (
    <View style={styles.container} testID="player-view">
      {cover ? <Image source={{ uri: cover }} style={styles.bgImage} blurRadius={50} /> : null}
      <LinearGradient colors={["rgba(5,5,8,0.6)", "rgba(5,5,8,0.95)", colors.background]} style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <TouchableOpacity testID="player-close" onPress={() => router.back()} hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}>
            <Ionicons name="chevron-down" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerOverline}>{isLive ? "EN DIRECT" : isPodcast ? "PODCAST" : "EN LECTURE"}</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>{isPodcast ? stream?.subtitle : isLive ? "IntelliRadio" : currentTrack?.album.title}</Text>
          </View>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.coverWrap}>
          {cover ? <Image source={{ uri: cover }} style={styles.cover} /> : (
            <View style={[styles.cover, { alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }]}>
              <Ionicons name="radio" size={64} color={colors.primary} />
            </View>
          )}
        </View>

        <View style={styles.info}>
          <View style={{ flex: 1 }}>
            <Text style={styles.trackTitle} numberOfLines={2}>{title}</Text>
            <Text style={styles.trackArtist}>{subtitle}</Text>
          </View>
          {!isStream && currentTrack ? (
            <TouchableOpacity testID="player-fav" onPress={() => toggleFavorite(currentTrack)} hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}>
              <Ionicons name={fav ? "heart" : "heart-outline"} size={28} color={fav ? colors.primary : colors.textPrimary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {!isLive ? (
          <View style={styles.sliderWrap}>
            <Slider
              testID="player-slider"
              style={styles.slider}
              minimumValue={0}
              maximumValue={Math.max(effectiveDurationMs, 1000)}
              value={Math.min(effectivePositionMs, Math.max(effectiveDurationMs, 1000))}
              onSlidingComplete={(v) => seekTo(v)}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor="rgba(255,255,255,0.2)"
              thumbTintColor={colors.primary}
            />
            <View style={styles.timeRow}>
              <Text style={styles.time}>{fmt(effectivePositionMs)}</Text>
              <Text style={styles.time}>{effectiveDurationMs > 0 ? fmt(effectiveDurationMs) : "--:--"}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>FLUX EN DIRECT</Text>
          </View>
        )}

        <View style={styles.controls}>
          <TouchableOpacity hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }} disabled={isStream}>
            <Ionicons name="shuffle" size={24} color={isStream ? colors.textTertiary : colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity testID="player-prev" onPress={isPodcast ? () => seekTo(Math.max(0, positionMs - 15000)) : previous} disabled={isLive}>
            <Ionicons name={isPodcast ? "play-back" : "play-skip-back"} size={36} color={isLive ? colors.textTertiary : colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity testID="player-play-pause" onPress={togglePlay} style={styles.playMain}>
            {isLoading ? <ActivityIndicator color="#fff" size="large" /> : <Ionicons name={isPlaying ? "pause" : "play"} size={36} color="#fff" />}
          </TouchableOpacity>
          <TouchableOpacity testID="player-next" onPress={isPodcast ? () => seekTo(positionMs + 30000) : next} disabled={isLive}>
            <Ionicons name={isPodcast ? "play-forward" : "play-skip-forward"} size={36} color={isLive ? colors.textTertiary : colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }} disabled={isStream}>
            <Ionicons name="repeat" size={24} color={isStream ? colors.textTertiary : colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>{isLive ? "Flux radio en direct" : isPodcast ? `Podcast · ${stream?.subtitle || ""}` : "Aperçu 30s · Deezer"}</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1, paddingHorizontal: spacing.lg },
  bgImage: { ...StyleSheet.absoluteFillObject, opacity: 0.6 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 22, marginBottom: spacing.md },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
  headerCenter: { flex: 1, alignItems: "center", paddingHorizontal: spacing.md },
  headerOverline: { color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 2 },
  headerTitle: { color: colors.textPrimary, fontFamily: fonts.bodyMed, fontSize: 13, marginTop: 2 },
  coverWrap: { flex: 1, alignItems: "center", justifyContent: "center", marginVertical: spacing.lg },
  cover: { width: 320, height: 320, borderRadius: radii.lg, backgroundColor: colors.surface },
  info: { flexDirection: "row", alignItems: "center", paddingTop: spacing.md },
  trackTitle: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 24, letterSpacing: -0.5 },
  trackArtist: { color: colors.textSecondary, fontFamily: fonts.bodyMed, fontSize: 15, marginTop: 4 },
  sliderWrap: { marginTop: spacing.lg },
  slider: { width: "100%", height: 36 },
  timeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: -4 },
  time: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12 },
  liveBadge: { flexDirection: "row", alignItems: "center", marginTop: spacing.lg, alignSelf: "flex-start", backgroundColor: "rgba(229,56,59,0.15)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginRight: 6 },
  liveText: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.5 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.lg, paddingHorizontal: spacing.sm },
  playMain: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  footer: { color: colors.textTertiary, fontFamily: fonts.body, fontSize: 11, textAlign: "center", marginTop: spacing.lg, marginBottom: spacing.sm },
  closeBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.pill },
  closeText: { color: "#fff", fontFamily: fonts.bodyBold },
});
