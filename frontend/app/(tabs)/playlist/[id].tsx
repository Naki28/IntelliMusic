// PlaylistDetailView — Détail d'une playlist (route /playlist/[id])
import React from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { usePlaylists } from "../../../src/context/PlaylistsContext";
import { usePlayer } from "../../../src/context/PlayerContext";
import TrackRow from "../../../src/components/TrackRow";
import { colors, fonts, radii, spacing } from "../../../src/theme";

export default function PlaylistDetailView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { playlists, removeTrack } = usePlaylists();
  const { playQueue } = usePlayer();

  const pl = playlists.find((p) => p.id === id);
  if (!pl) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{ color: colors.textPrimary, padding: spacing.lg, fontFamily: fonts.body }}>Playlist introuvable</Text>
      </SafeAreaView>
    );
  }

  const cover = pl.tracks[0]?.album?.cover_big || pl.tracks[0]?.album?.cover_medium;

  return (
    <View style={styles.container}>
      {cover ? <Image source={{ uri: cover }} style={styles.bg} blurRadius={40} /> : null}
      <LinearGradient colors={["rgba(5,5,8,0.4)", colors.background]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={styles.headerNav}>
          <TouchableOpacity testID="playlist-back" onPress={() => router.back()} hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}>
            <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.heroWrap}>
          {cover ? (
            <Image source={{ uri: cover }} style={styles.cover} />
          ) : (
            <View style={[styles.cover, { alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }]}>
              <Ionicons name="musical-notes" size={48} color={colors.textSecondary} />
            </View>
          )}
          <Text style={styles.name}>{pl.name}</Text>
          <Text style={styles.meta}>{pl.tracks.length} titre{pl.tracks.length > 1 ? "s" : ""}</Text>
          {pl.tracks.length > 0 ? (
            <TouchableOpacity testID="playlist-play-all" onPress={() => playQueue(pl.tracks, 0)} style={styles.playBtn}>
              <Ionicons name="play" size={18} color="#fff" />
              <Text style={styles.playText}>Tout lire</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {pl.tracks.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="add-circle-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyText}>Ajoute des titres depuis l&apos;accueil ou la recherche</Text>
          </View>
        ) : (
          <FlatList
            data={pl.tracks}
            keyExtractor={(t) => String(t.id)}
            renderItem={({ item, index }) => (
              <View style={styles.trackWrap}>
                <View style={{ flex: 1 }}>
                  <TrackRow track={item} index={index} onPress={() => playQueue(pl.tracks, index)} />
                </View>
                <TouchableOpacity testID={`playlist-track-remove-${item.id}`} onPress={() => removeTrack(pl.id, item.id)} style={styles.removeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Ionicons name="remove-circle-outline" size={22} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            )}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 220 }}
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  bg: { ...StyleSheet.absoluteFillObject, opacity: 0.4 },
  headerNav: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  heroWrap: { alignItems: "center", padding: spacing.lg },
  cover: { width: 200, height: 200, borderRadius: radii.lg, backgroundColor: colors.surface },
  name: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 26, marginTop: spacing.md, letterSpacing: -1 },
  meta: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 13, marginTop: 4 },
  playBtn: { flexDirection: "row", alignItems: "center", backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radii.pill, marginTop: spacing.md },
  playText: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 14, marginLeft: 6 },
  empty: { alignItems: "center", padding: spacing.xl },
  emptyText: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 13, marginTop: spacing.sm, textAlign: "center" },
  trackWrap: { flexDirection: "row", alignItems: "center" },
  removeBtn: { paddingLeft: spacing.sm },
});
