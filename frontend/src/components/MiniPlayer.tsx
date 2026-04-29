// MiniPlayer — Mini lecteur (track ou stream radio/podcast)
// Refactor : Pressable parent + bouton play/pause en overlay (pas d'imbrication de TouchableOpacity)
// Évite le crash view.js:27 / animatedcomponent:107 lié aux gestures imbriqués sous BlurView/Reanimated.
import React from "react";
import { View, Text, Pressable, StyleSheet, Image, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { usePlayer } from "../context/PlayerContext";
import { colors, fonts, radii } from "../theme";

export default function MiniPlayer() {
  const router = useRouter();
  const { mode, currentTrack, stream, isPlaying, isLoading, togglePlay } = usePlayer();

  const visible = (mode === "track" && currentTrack) || (mode === "stream" && stream);
  if (!visible) return null;

  const isPodcast = mode === "stream" && stream?.kind === "podcast";
  const isLive = mode === "stream" && stream?.kind !== "podcast";
  const cover =
    mode === "track"
      ? currentTrack?.album?.cover_medium || currentTrack?.album?.cover
      : stream?.artwork;
  const title = (mode === "track" ? currentTrack?.title : stream?.name) || "";
  const subtitle =
    mode === "track"
      ? currentTrack?.artist?.name || ""
      : stream?.subtitle || (isLive ? "En direct" : "");

  // openPlayer doit être robuste : un push qui échoue ne doit pas crasher l'UI
  const openPlayer = () => {
    try {
      router.push("/player");
    } catch (e) {
      console.warn("MiniPlayer push /player error:", e);
    }
  };

  const onTogglePlay = (e?: any) => {
    // empêche la propagation vers le Pressable parent
    e?.stopPropagation?.();
    togglePlay().catch((err) => console.warn("togglePlay err:", err));
  };

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <BlurView intensity={70} tint="dark" style={styles.blur} pointerEvents="none" />
      <View style={styles.row} pointerEvents="box-none">
        <Pressable
          testID="mini-player"
          onPress={openPlayer}
          android_ripple={{ color: "rgba(255,255,255,0.06)" }}
          style={({ pressed }) => [styles.touchArea, pressed && { opacity: 0.85 }]}
        >
          {cover ? (
            <Image source={{ uri: cover }} style={styles.cover} />
          ) : (
            <View style={[styles.cover, styles.coverFallback]}>
              <Ionicons name={isPodcast ? "mic" : "radio"} size={24} color={colors.textPrimary} />
            </View>
          )}
          <View style={styles.meta}>
            <View style={styles.metaTopRow}>
              {isLive ? <View style={styles.liveDot} /> : null}
              {isPodcast ? (
                <Ionicons name="mic" size={11} color={colors.accent} style={styles.podcastIcon} />
              ) : null}
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            </View>
            {subtitle ? (
              <Text style={styles.artist} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </Pressable>
        <Pressable
          testID="mini-player-play-pause"
          onPress={onTogglePlay}
          hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
          style={({ pressed }) => [styles.playBtn, pressed && { opacity: 0.85 }]}
        >
          {isLoading ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <Ionicons name={isPlaying ? "pause" : "play"} size={22} color={colors.textPrimary} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 96,
    left: 12,
    right: 12,
    borderRadius: radii.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    zIndex: 10,
    backgroundColor: "rgba(18,18,22,0.6)",
  },
  blur: { ...StyleSheet.absoluteFillObject },
  row: { flexDirection: "row", alignItems: "center", padding: 8, paddingRight: 14 },
  touchArea: { flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 8 },
  cover: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.surface },
  coverFallback: { alignItems: "center", justifyContent: "center" },
  meta: { flex: 1, marginLeft: 12 },
  metaTopRow: { flexDirection: "row", alignItems: "center" },
  podcastIcon: { marginRight: 5 },
  title: { color: colors.textPrimary, fontFamily: fonts.bodyMed, fontSize: 14, flexShrink: 1 },
  artist: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginRight: 6 },
});
