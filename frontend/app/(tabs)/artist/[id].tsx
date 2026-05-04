// ArtistDetail — Page d'un artiste (route /artist/[id])
// Top 10 titres + albums de l'artiste (via cache prefetché)
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { DeezerAPI } from "../../../src/api/deezer";
import type { Artist, Track, Album } from "../../../src/types/music";
import TrackRow from "../../../src/components/TrackRow";
import AlbumCard from "../../../src/components/AlbumCard";
import SectionHeader from "../../../src/components/SectionHeader";
import { usePlayer } from "../../../src/context/PlayerContext";
import { useLibrary } from "../../../src/context/LibraryContext";
import { showToast } from "../../../src/lib/toast";
import { colors, fonts, radii, spacing } from "../../../src/theme";

export default function ArtistDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { playQueue, addToQueue } = usePlayer();
  const { isArtistSaved, toggleArtist } = useLibrary();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artist, setArtist] = useState<Artist | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Récupérer info artiste + Top 10 + albums en parallèle
        const [artistInfo, top, albumsRes] = await Promise.all([
          DeezerAPI.artist(Number(id)),
          DeezerAPI.artistTop(Number(id), 10),
          DeezerAPI.artistAlbums(Number(id), 25),
        ]);
        if (!mounted) return;
        setArtist(artistInfo);
        setTracks(top.data || []);
        setAlbums(albumsRes.data || []);
      } catch (e) { console.warn(e); }
      finally { if (mounted) setLoading(false); }
    })();
    return () => { mounted = false; };
  }, [id]);

  // Prefetch : dès qu'on a les albums, on chauffe le cache des 5 premiers
  useEffect(() => {
    if (albums.length > 0) {
      DeezerAPI.prefetchAlbums(albums.slice(0, 5).map(a => a.id));
    }
  }, [albums]);

  // Long press sur une carte album → ajoute tous les titres à la file d'attente
  const handleAlbumLongPress = async (albumId: number) => {
    try {
      const a = await DeezerAPI.album(albumId);
      const ts = (a.tracks?.data || []).map((t: any) => ({ ...t, album: { ...a }, artist: t.artist || a.artist }));
      if (ts.length > 0) {
        addToQueue(ts);
        showToast(`Album ajouté à la file (${ts.length})`);
      }
    } catch { showToast("Erreur lors de l'ajout"); }
  };

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.primary} /></SafeAreaView>;
  if (!artist) return <SafeAreaView style={styles.center}><Text style={{color: colors.textPrimary, fontFamily: fonts.body}}>Artiste introuvable</Text></SafeAreaView>;

  const cover = artist.picture_xl || artist.picture_big || artist.picture_medium;
  const saved = isArtistSaved(artist.id);

  return (
    <View style={styles.container}>
      {cover ? <Image source={{ uri: cover }} style={styles.bg} blurRadius={50} /> : null}
      <LinearGradient colors={["rgba(5,5,8,0.5)", colors.background]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <View style={styles.headerNav}>
          <TouchableOpacity testID="artist-back" onPress={() => router.back()} hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}>
            <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 220 }} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            {cover ? <Image source={{ uri: cover }} style={styles.cover} /> : null}
            <Text style={styles.title} numberOfLines={2}>{artist.name}</Text>
            {artist.nb_fan ? <Text style={styles.fans}>{artist.nb_fan.toLocaleString("fr-FR")} fans</Text> : null}
            <View style={{ flexDirection: "row", marginTop: spacing.md }}>
              <TouchableOpacity testID="artist-play" onPress={() => playQueue(tracks, 0)} style={styles.playBtn}>
                <Ionicons name="play" size={18} color="#fff" />
                <Text style={styles.playText}>Lire</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="artist-save" onPress={() => toggleArtist(artist)} style={[styles.saveBtn, saved && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                <Ionicons name={saved ? "checkmark" : "add"} size={18} color={saved ? "#fff" : colors.textPrimary} />
                <Text style={[styles.saveText, saved && { color: "#fff" }]}>{saved ? "Suivi" : "Suivre"}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.section}>Top titres</Text>
          <View style={{ paddingHorizontal: spacing.lg }}>
            {tracks.slice(0, 10).map((t, i) => (
              <TrackRow
                key={t.id}
                track={t}
                index={i}
                onPress={() => playQueue(tracks, i)}
                onLongPress={() => { addToQueue([t]); showToast("Ajouté à la file"); }}
              />
            ))}
          </View>

          {albums.length > 0 ? (
            <>
              <SectionHeader overline="Discographie" title={`Albums (${albums.length})`} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
                {albums.map((a) => (
                  <AlbumCard
                    key={a.id}
                    testID={`artist-album-${a.id}`}
                    imageUri={a.cover_big || a.cover_medium || ""}
                    title={a.title}
                    subtitle={a.release_date?.slice(0, 4)}
                    size={140}
                    onPress={() => router.push(`/album/${a.id}`)}
                    onLongPress={() => handleAlbumLongPress(a.id)}
                  />
                ))}
              </ScrollView>
            </>
          ) : null}
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
  cover: { width: 200, height: 200, borderRadius: 100, backgroundColor: colors.surface, marginBottom: spacing.md },
  title: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 28, textAlign: "center", letterSpacing: -1 },
  fans: { color: colors.textSecondary, fontFamily: fonts.bodyMed, fontSize: 13, marginTop: 4 },
  playBtn: { flexDirection: "row", alignItems: "center", backgroundColor: colors.primary, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radii.pill, marginRight: spacing.sm },
  playText: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 14, marginLeft: 6 },
  saveBtn: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radii.pill },
  saveText: { color: colors.textPrimary, fontFamily: fonts.bodyMed, fontSize: 13, marginLeft: 6 },
  section: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 18, paddingHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm },
});
