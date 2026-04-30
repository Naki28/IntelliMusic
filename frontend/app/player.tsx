// PlayerView — Lecteur plein écran (track, podcast ou radio live)
// Nouveau layout : contrôles, puis volume, puis boutons queue + sleep timer.
// Pour les podcasts : boutons précédent/suivant deviennent -15s / +30s.
import React, { useState } from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { usePlayer } from "../src/context/PlayerContext";
import { useFavorites } from "../src/context/FavoritesContext";
import QueueModal from "../src/components/QueueModal";
import SleepTimerModal from "../src/components/SleepTimerModal";
import { colors, fonts, radii, spacing } from "../src/theme";

function fmt(ms: number) {
  if (!ms || isNaN(ms)) return "0:00";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function fmtSleepRemaining(endAt: number | null): string {
  if (!endAt) return "";
  const rem = endAt - Date.now();
  if (rem <= 0) return "";
  const m = Math.ceil(rem / 60000);
  return `${m}min`;
}

export default function PlayerView() {
  const router = useRouter();
  const {
    mode, currentTrack, stream, isPlaying, isLoading, positionMs, durationMs,
    volume, isShuffled, repeatMode, sleepTimerEndAt,
    togglePlay, next, previous, seekTo, toggleShuffle, cycleRepeat, setVolume,
  } = usePlayer();
  const { isFavorite, toggleFavorite } = useFavorites();

  const [showQueue, setShowQueue] = useState(false);
  const [showSleep, setShowSleep] = useState(false);

  const isStream = mode === "stream" && !!stream;
  const isPodcast = isStream && stream?.kind === "podcast";
  const isLive = isStream && stream?.kind !== "podcast";
  const cover = isStream ? stream!.artwork : currentTrack?.album.cover_xl || currentTrack?.album.cover_big;
  const title = isStream ? stream!.name : currentTrack?.title;
  const subtitle = isStream ? (stream!.subtitle || "En direct") : currentTrack?.artist?.name;

  const officialDurMs = currentTrack?.duration ? currentTrack.duration * 1000 : 0;
  const effectiveDurationMs = !isStream && officialDurMs > 0 ? officialDurMs : durationMs;
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
  const artistId = !isStream ? currentTrack?.artist?.id : null;
  const podcastId = isPodcast ? stream?.podcastId : null;

  // Navigation depuis le sous-titre
  const goToArtist = () => {
    if (artistId) {
      router.back();
      setTimeout(() => router.push(`/artist/${artistId}`), 120);
    }
  };
  const goToPodcast = () => {
    if (podcastId) {
      router.back();
      setTimeout(() => router.push(`/podcast/${podcastId}`), 120);
    }
  };
  const goToAlbum = () => {
    if (!isStream && currentTrack?.album?.id) {
      const aid = currentTrack.album.id;
      router.back();
      setTimeout(() => router.push(`/album/${aid}`), 120);
    }
  };

  // Couleurs/icônes repeat
  const repeatIcon = repeatMode === "one" ? "repeat" : "repeat";
  const repeatColor = repeatMode === "off" ? colors.textSecondary : colors.primary;

  const sleepRem = fmtSleepRemaining(sleepTimerEndAt);

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
            <TouchableOpacity
              disabled={isLive || (!isPodcast && !currentTrack?.album?.id)}
              onPress={isPodcast ? goToPodcast : goToAlbum}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={styles.headerTitle} numberOfLines={1}>
                {isPodcast ? stream?.subtitle : isLive ? "IntelliRadio" : currentTrack?.album?.title}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={{ width: 28 }} />
        </View>

        <View style={styles.coverWrap}>
          {cover ? <Image source={{ uri: cover }} style={styles.cover} /> : (
            <View style={[styles.cover, { alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }]}>
              <Ionicons name={isPodcast ? "mic" : "radio"} size={64} color={colors.primary} />
            </View>
          )}
        </View>

        <View style={styles.info}>
          <View style={{ flex: 1 }}>
            <Text style={styles.trackTitle} numberOfLines={2}>{title}</Text>
            {isPodcast && podcastId ? (
              <TouchableOpacity testID="player-podcast-link" onPress={goToPodcast} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Text style={[styles.trackArtist, styles.artistLink]}>{subtitle}</Text>
              </TouchableOpacity>
            ) : artistId ? (
              <TouchableOpacity testID="player-artist-link" onPress={goToArtist} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Text style={[styles.trackArtist, styles.artistLink]}>{subtitle}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.trackArtist}>{subtitle}</Text>
            )}
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

        {/* Row 1 — Contrôles principaux */}
        <View style={styles.controls}>
          <TouchableOpacity
            testID="player-shuffle"
            onPress={toggleShuffle}
            hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
            disabled={!!isStream}
          >
            <Ionicons name="shuffle" size={24} color={isStream ? colors.textTertiary : isShuffled ? colors.primary : colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity testID="player-prev" onPress={isPodcast ? () => seekTo(Math.max(0, positionMs - 15000)) : previous} disabled={!!isLive}>
            {isPodcast ? (
              <View style={styles.skipBtn}>
                <Ionicons name="play-back" size={26} color={colors.textPrimary} />
                <Text style={styles.skipLabel}>15</Text>
              </View>
            ) : (
              <Ionicons name="play-skip-back" size={36} color={isLive ? colors.textTertiary : colors.textPrimary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity testID="player-play-pause" onPress={togglePlay} style={styles.playMain}>
            {isLoading ? <ActivityIndicator color="#fff" size="large" /> : <Ionicons name={isPlaying ? "pause" : "play"} size={36} color="#fff" />}
          </TouchableOpacity>
          <TouchableOpacity testID="player-next" onPress={isPodcast ? () => seekTo(positionMs + 30000) : next} disabled={!!isLive}>
            {isPodcast ? (
              <View style={styles.skipBtn}>
                <Ionicons name="play-forward" size={26} color={colors.textPrimary} />
                <Text style={styles.skipLabel}>30</Text>
              </View>
            ) : (
              <Ionicons name="play-skip-forward" size={36} color={isLive ? colors.textTertiary : colors.textPrimary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            testID="player-repeat"
            onPress={cycleRepeat}
            hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
            disabled={!!isStream}
          >
            <View>
              <Ionicons name={repeatIcon} size={24} color={isStream ? colors.textTertiary : repeatColor} />
              {repeatMode === "one" ? (
                <Text style={styles.repeatOne}>1</Text>
              ) : null}
            </View>
          </TouchableOpacity>
        </View>

        {/* Row 2 — Volume */}
        <View style={styles.volumeRow}>
          <Ionicons name="volume-low" size={16} color={colors.textSecondary} />
          <Slider
            testID="player-volume"
            style={styles.volumeSlider}
            minimumValue={0}
            maximumValue={1}
            value={volume}
            onValueChange={(v) => setVolume(v)}
            minimumTrackTintColor={colors.textPrimary}
            maximumTrackTintColor="rgba(255,255,255,0.15)"
            thumbTintColor={colors.textPrimary}
          />
          <Ionicons name="volume-high" size={16} color={colors.textSecondary} />
        </View>

        {/* Row 3 — File d'attente + Minuteur */}
        <View style={styles.secondaryRow}>
          <TouchableOpacity
            testID="player-queue"
            onPress={() => setShowQueue(true)}
            style={styles.secondaryBtn}
          >
            <Ionicons name="list" size={20} color={colors.textPrimary} />
            <Text style={styles.secondaryLabel}>File d&apos;attente</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="player-sleep-timer"
            onPress={() => setShowSleep(true)}
            style={[styles.secondaryBtn, sleepTimerEndAt && styles.secondaryBtnActive]}
          >
            <Ionicons name="moon" size={20} color={sleepTimerEndAt ? colors.primary : colors.textPrimary} />
            <Text style={[styles.secondaryLabel, sleepTimerEndAt && { color: colors.primary }]}>
              {sleepTimerEndAt ? sleepRem : "Minuteur"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <QueueModal visible={showQueue} onClose={() => setShowQueue(false)} />
      <SleepTimerModal visible={showSleep} onClose={() => setShowSleep(false)} />
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
  coverWrap: { alignItems: "center", justifyContent: "center", marginVertical: spacing.md, flex: 1 },
  cover: { width: 300, height: 300, borderRadius: radii.lg, backgroundColor: colors.surface },
  info: { flexDirection: "row", alignItems: "center", paddingTop: spacing.md },
  trackTitle: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 22, letterSpacing: -0.5 },
  trackArtist: { color: colors.textSecondary, fontFamily: fonts.bodyMed, fontSize: 14, marginTop: 4 },
  artistLink: { color: colors.textPrimary, textDecorationLine: "underline" },
  sliderWrap: { marginTop: spacing.md },
  slider: { width: "100%", height: 32 },
  timeRow: { flexDirection: "row", justifyContent: "space-between", marginTop: -4 },
  time: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12 },
  liveBadge: { flexDirection: "row", alignItems: "center", marginTop: spacing.md, alignSelf: "flex-start", backgroundColor: "rgba(229,56,59,0.15)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginRight: 6 },
  liveText: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 1.5 },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md, paddingHorizontal: spacing.sm },
  playMain: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  skipBtn: { alignItems: "center", justifyContent: "center" },
  skipLabel: { color: colors.textPrimary, fontFamily: fonts.bodyBold, fontSize: 10, marginTop: -2 },
  repeatOne: { position: "absolute", top: -6, right: -8, color: colors.primary, fontFamily: fonts.bodyBold, fontSize: 10, backgroundColor: colors.background, borderRadius: 6, paddingHorizontal: 3 },
  volumeRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm, paddingHorizontal: spacing.sm },
  volumeSlider: { flex: 1, height: 24, marginHorizontal: 8 },
  secondaryRow: { flexDirection: "row", justifyContent: "space-around", marginTop: spacing.sm, paddingHorizontal: spacing.sm, marginBottom: spacing.sm },
  secondaryBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, marginHorizontal: 6, borderRadius: radii.pill, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: colors.border },
  secondaryBtnActive: { borderColor: colors.primary, backgroundColor: "rgba(229,56,59,0.08)" },
  secondaryLabel: { color: colors.textPrimary, fontFamily: fonts.bodyMed, fontSize: 12, marginLeft: 6 },
  closeBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.pill },
  closeText: { color: "#fff", fontFamily: fonts.bodyBold },
});
