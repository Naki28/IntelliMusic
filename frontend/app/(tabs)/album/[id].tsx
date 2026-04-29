// AlbumDetail — Page d'un album (route /album/[id])
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { DeezerAPI } from "../../../src/api/deezer";
import type { Album, Track } from "../../../src/types/music";
import TrackRow from "../../../src/components/TrackRow";
import { usePlayer } from "../../../src/context/PlayerContext";
import { useLibrary } from "../../../src/context/LibraryContext";
import { colors, fonts, radii, spacing } from "../../../src/theme";

export default function AlbumDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { playQueue } = usePlayer();
  const { isAlbumSaved, toggleAlbum } = useLibrary();
  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const a = await DeezerAPI.album(Number(id));
        setAlbum(a);
      } catch (e) { console.warn(e); }
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.primary} /></SafeAreaView>;
  if (!album) return <SafeAreaView style={styles.center}><Text style={{color: colors.textPrimary, fontFamily: fonts.body}}>Album introuvable</Text></SafeAreaView>;

  const tracks: Track[] = (album.tracks?.data || []).map((t: any) => ({ ...t, album: { ...album }, artist: t.artist || album.artist }));
  const cover = album.cover_xl || album.cover_big || album.cover_medium;
  const saved = isAlbumSaved(album.id);

  return (
    <View style={styles.container}>
      {cover ? <Image source={{ uri: cover }} style={styles.bg} blurRadius={50} /> : null}
      <LinearGradient colors={["rgba(5,5,8,0.5)", colors.background]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={styles.headerNav}>
          <TouchableOpacity testID="album-back" onPress={() => router.back()} hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}>
            <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 220 }} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            {cover ? <Image source={{ uri: cover }} style={styles.cover} /> : null}
            <Text style={styles.title} numberOfLines={2}>{album.title}</Text>
            <Text style={styles.artist}>{album.artist?.name}</Text>
            <View style={{ flexDirection: "row", marginTop: spacing.md }}>
              <TouchableOpacity testID="album-play" onPress={() => playQueue(tracks, 0)} style={styles.playBtn}>
                <Ionicons name="play" size={18} color="#fff" />
                <Text style={styles.playText}>Lire</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="album-save" onPress={() => toggleAlbum(album)} style={[styles.saveBtn, saved && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                <Ionicons name={saved ? "checkmark" : "add"} size={18} color={saved ? "#fff" : colors.textPrimary} />
                <Text style={[styles.saveText, saved && { color: "#fff" }]}>{saved ? "Ajouté" : "Bibliothèque"}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={{ paddingHorizontal: spacing.lg }}>
            {tracks.map((t, i) => <TrackRow key={t.id} track={t} index={i} onPress={() => playQueue(tracks, i)} />)}
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
  cover: { width: 220, height: 220, borderRadius: radii.lg, backgroundColor: colors.surface, marginBottom: spacing.md },
  title: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 26, textAlign: "center", letterSpacing: -1 },
  artist: { color: colors.textSecondary, fontFamily: fonts.bodyMed, fontSize: 14, marginTop: 4 },
  playBtn: { flexDirection: "row", alignItems: "center", backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radii.pill, marginRight: spacing.sm },
  playText: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 14, marginLeft: 6 },
  saveBtn: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radii.pill },
  saveText: { color: colors.textPrimary, fontFamily: fonts.bodyMed, fontSize: 13, marginLeft: 6 },
});
