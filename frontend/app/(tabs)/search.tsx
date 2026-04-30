// SearchView — Recherche en direct (debounced) sur titres / albums / artistes
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  Image,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { DeezerAPI } from "../../src/api/deezer";
import type { Track, Album, Artist } from "../../src/types/music";
import { colors, fonts, radii, spacing } from "../../src/theme";
import SectionHeader from "../../src/components/SectionHeader";
import TrackRow from "../../src/components/TrackRow";
import AlbumCard from "../../src/components/AlbumCard";
import { usePlayer } from "../../src/context/PlayerContext";
import { useContextMenu } from "../../src/context/ContextMenuContext";
import { showToast } from "../../src/lib/toast";

type Tab = "tracks" | "albums" | "artists" | "podcasts";

interface ITunesPodcastResult { collectionId?: number; collectionName?: string; artistName?: string; artworkUrl600?: string; }

export default function SearchView() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("tracks");
  const [loading, setLoading] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [podcasts, setPodcasts] = useState<ITunesPodcastResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { playQueue, addToQueue, playWithSmartQueue } = usePlayer();
  const { openTrackMenu, openAlbumMenu, openArtistMenu } = useContextMenu();

  // Long press sur un album → ajoute tous ses titres à la file
  const handleAlbumLongPress = async (albumId: number) => {
    try {
      const a = await DeezerAPI.album(albumId);
      const ts = (a.tracks?.data || []).map((t: any) => ({ ...t, album: { ...a }, artist: t.artist || a.artist }));
      if (ts.length > 0) { addToQueue(ts); showToast(`Album ajouté à la file (${ts.length})`); }
    } catch { showToast("Erreur lors de l'ajout"); }
  };

  // Debounce de la recherche (350ms) — recherche en parallèle musique + podcasts
  useEffect(() => {
    if (!query.trim()) {
      setTracks([]); setAlbums([]); setArtists([]); setPodcasts([]); setError(null);
      return;
    }
    const handler = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const [t, a, ar, p] = await Promise.all([
          DeezerAPI.searchTracks(query),
          DeezerAPI.searchAlbums(query),
          DeezerAPI.searchArtists(query),
          fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/podcasts/search?q=${encodeURIComponent(query)}&limit=20`).then(r => r.ok ? r.json() : { results: [] }).catch(() => ({ results: [] })),
        ]);
        setTracks(t.data ?? []);
        setAlbums(a.data ?? []);
        setArtists(ar.data ?? []);
        setPodcasts((p as any).results ?? []);
        // Prefetch top 5 albums + top 5 artistes → ouverture quasi-instantanée
        DeezerAPI.prefetchAlbums((a.data ?? []).slice(0, 5).map((x) => x.id));
        DeezerAPI.prefetchArtists((ar.data ?? []).slice(0, 5).map((x) => x.id));
      } catch (e) {
        setError("Erreur de recherche");
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(handler);
  }, [query]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Rechercher</Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          testID="search-input"
          value={query}
          onChangeText={setQuery}
          placeholder="Titre, album, artiste..."
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          returnKeyType="search"
          autoCorrect={false}
        />
        {query.length > 0 ? (
          <TouchableOpacity testID="search-clear" onPress={() => { setQuery(""); Keyboard.dismiss(); }}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(["tracks", "albums", "artists", "podcasts"] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            testID={`search-tab-${t}`}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
              {t === "tracks" ? "Titres" : t === "albums" ? "Albums" : t === "artists" ? "Artistes" : "Podcasts"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : query.trim() === "" ? (
        <View style={styles.center}>
          <Ionicons name="musical-notes-outline" size={56} color={colors.textTertiary} />
          <Text style={styles.emptyText}>Découvrez des millions de titres</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {tab === "tracks" &&
            tracks.map((t, i) => (
              <TrackRow
                key={t.id}
                track={t}
                onPress={() => playWithSmartQueue(t, tracks)}
                onLongPress={() => openTrackMenu(t)}
              />
            ))}
          {tab === "albums" && (
            <View style={styles.grid}>
              {albums.map((a) => (
                <View key={a.id} style={styles.gridItem}>
                  <AlbumCard
                    testID={`search-album-${a.id}`}
                    imageUri={a.cover_big || a.cover_medium || ""}
                    title={a.title}
                    subtitle={a.artist?.name}
                    size={150}
                    onPress={() => router.push(`/album/${a.id}`)}
                    onLongPress={() => handleAlbumLongPress(a.id)}
                  />
                </View>
              ))}
            </View>
          )}
          {tab === "artists" && (
            <View style={styles.grid}>
              {artists.map((a) => (
                <View key={a.id} style={styles.gridItem}>
                  <AlbumCard
                    testID={`search-artist-${a.id}`}
                    imageUri={a.picture_big || a.picture_medium || ""}
                    title={a.name}
                    size={120}
                    rounded
                    onPress={() => router.push(`/artist/${a.id}`)}
                  />
                </View>
              ))}
            </View>
          )}
          {tab === "podcasts" && (
            <View style={styles.grid}>
              {podcasts.map((p) => (
                <View key={p.collectionId} style={styles.gridItem}>
                  <AlbumCard
                    testID={`search-podcast-${p.collectionId}`}
                    imageUri={p.artworkUrl600 || ""}
                    title={p.collectionName || ""}
                    subtitle={p.artistName}
                    size={150}
                    onPress={() => router.push(`/podcast/${p.collectionId}`)}
                  />
                </View>
              ))}
            </View>
          )}
          <View style={{ height: 200 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.heading,
    fontSize: 28,
    letterSpacing: -1,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    paddingVertical: 12,
    marginLeft: 10,
    fontSize: 15,
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabLabel: { color: colors.textSecondary, fontFamily: fonts.bodyMed, fontSize: 13 },
  tabLabelActive: { color: "#fff" },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  emptyText: { color: colors.textSecondary, fontFamily: fonts.body, marginTop: spacing.md },
  errorText: { color: colors.primary, fontFamily: fonts.bodyMed },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  gridItem: { marginBottom: spacing.lg },
});
