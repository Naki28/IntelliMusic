// HomeView — Écran d'accueil personnalisé (recommandations user + bouton profil)
import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, TouchableOpacity, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { DeezerAPI } from "../../src/api/deezer";
import { api } from "../../src/api/client";
import type { Track, Album, Artist, Genre } from "../../src/types/music";
import { colors, fonts, spacing, radii } from "../../src/theme";
import SectionHeader from "../../src/components/SectionHeader";
import TrackRow from "../../src/components/TrackRow";
import AlbumCard from "../../src/components/AlbumCard";
import NewBadge, { isRecent } from "../../src/components/NewBadge";
import { usePlayer } from "../../src/context/PlayerContext";
import { useAuth } from "../../src/context/AuthContext";

interface HomeReco { for_you_tracks: Track[]; trending_artists: Artist[]; new_releases: Album[]; }

export default function HomeView() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [reco, setReco] = useState<HomeReco | null>(null);

  const { playQueue } = usePlayer();

  const load = async () => {
    try {
      setError(null);
      const [chart, releases, genresRes, recoRes] = await Promise.all([
        DeezerAPI.chart(),
        DeezerAPI.newReleases().catch(() => ({ data: [] as Album[] })),
        DeezerAPI.genres().catch(() => ({ data: [] as Genre[] })),
        api<HomeReco>("/home/recommendations").catch(() => null),
      ]);
      setTracks(chart.tracks?.data?.slice(0, 10) ?? []);
      setAlbums((releases.data && releases.data.length > 0 ? releases.data : chart.albums?.data ?? []).slice(0, 10));
      setArtists(chart.artists?.data?.slice(0, 10) ?? []);
      setGenres((genresRes.data ?? []).filter((g) => g.id !== 0).slice(0, 8));
      setReco(recoRes);
    } catch (e: any) {
      setError("Impossible de charger l'accueil. Vérifiez votre connexion.");
    } finally {
      setLoading(false); setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);
  const onRefresh = () => { setRefreshing(true); load(); };

  // Prefetch : dès qu'on a les listes, on chauffe le cache des détails
  // → cliquer sur un album/artiste ouvre la page quasi-instantanément
  useEffect(() => {
    if (albums.length > 0) DeezerAPI.prefetchAlbums(albums.slice(0, 5).map(a => a.id));
  }, [albums]);
  useEffect(() => {
    if (artists.length > 0) DeezerAPI.prefetchArtists(artists.slice(0, 5).map(a => a.id));
  }, [artists]);
  useEffect(() => {
    if (reco?.new_releases?.length) DeezerAPI.prefetchAlbums(reco.new_releases.slice(0, 5).map(a => a.id));
    if (reco?.trending_artists?.length) DeezerAPI.prefetchArtists(reco.trending_artists.slice(0, 5).map(a => a.id));
  }, [reco]);

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></SafeAreaView>;

  const heroTrack = (reco?.for_you_tracks && reco.for_you_tracks[0]) || tracks[0];
  const personalTracks = reco?.for_you_tracks?.length ? reco.for_you_tracks : tracks;
  const trendingArtists = reco?.trending_artists?.length ? reco.trending_artists : artists;
  const newReleases = reco?.new_releases?.length ? reco.new_releases : albums;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView testID="home-scroll" contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>IntelliMusic</Text>
            <Text style={styles.greeting}>Bonsoir {user?.name?.split(" ")[0] || ""}, prêt à écouter ?</Text>
          </View>
          <TouchableOpacity testID="home-profile-btn" onPress={() => router.push("/profile")} style={styles.avatar} activeOpacity={0.8}>
            {user?.picture ? <Image source={{ uri: user.picture }} style={styles.avatarImg} /> : <Ionicons name="person" size={20} color={colors.textPrimary} />}
          </TouchableOpacity>
        </View>

        {error ? <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View> : null}

        {heroTrack ? (
          <TouchableOpacity testID="home-hero" activeOpacity={0.85} onPress={() => playQueue(personalTracks, 0)} style={styles.hero}>
            <Image source={{ uri: heroTrack.album.cover_xl || heroTrack.album.cover_big }} style={styles.heroImg} />
            <LinearGradient colors={["transparent", "rgba(5,5,8,0.4)", "rgba(5,5,8,0.95)"]} style={StyleSheet.absoluteFill} />
            <View style={styles.heroContent}>
              <Text style={styles.heroOverline}>{reco?.for_you_tracks?.length ? "Pour toi" : "Top du jour"}</Text>
              <Text style={styles.heroTitle} numberOfLines={2}>{heroTrack.title}</Text>
              <Text style={styles.heroArtist}>{heroTrack.artist.name}</Text>
              <View style={styles.heroPlay}><Ionicons name="play" size={18} color="#fff" /><Text style={styles.heroPlayText}>Lire maintenant</Text></View>
            </View>
          </TouchableOpacity>
        ) : null}

        <SectionHeader overline={reco?.for_you_tracks?.length ? "Pour toi" : "Tendances"} title={reco?.for_you_tracks?.length ? "Suggestions personnalisées" : "Top Charts"} />
        <View>
          {personalTracks.slice(0, 8).map((t, i) => (
            <TrackRow key={t.id} track={t} index={i} onPress={() => playQueue(personalTracks, i)} />
          ))}
        </View>

        {newReleases.length > 0 ? (
          <>
            <SectionHeader overline="Sorties" title="Nouveautés de la semaine" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {newReleases.map((a) => (
                <TouchableOpacity key={a.id} onPress={() => router.push(`/album/${a.id}`)}>
                  <View>
                    {isRecent((a as any).release_date, 7) ? <View style={{ position: "absolute", top: 6, left: 6, zIndex: 5 }}><NewBadge small /></View> : null}
                    <AlbumCard testID={`album-${a.id}`} imageUri={a.cover_big || a.cover_medium || a.cover || ""} title={a.title} subtitle={a.artist?.name} size={150} />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        ) : null}

        {genres.length > 0 ? (
          <>
            <SectionHeader overline="Univers" title="Suggestions par genre" />
            <View style={styles.genreGrid}>
              {genres.map((g) => (
                <TouchableOpacity key={g.id} testID={`genre-${g.id}`} onPress={async () => {
                  try { const r = await DeezerAPI.searchTracks(g.name, 25); if (r.data?.length) playQueue(r.data, 0); } catch {}
                }} style={styles.genreCard}>
                  <Image source={{ uri: g.picture_medium || g.picture }} style={styles.genreImg} />
                  <LinearGradient colors={["rgba(229,56,59,0.15)", "rgba(5,5,8,0.85)"]} style={StyleSheet.absoluteFill} />
                  <Text style={styles.genreName}>{g.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}

        {trendingArtists.length > 0 ? (
          <>
            <SectionHeader overline="Stars" title={reco?.trending_artists?.length ? "Tes artistes du moment" : "Artistes du moment"} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
              {trendingArtists.map((a) => (
                <TouchableOpacity key={a.id} onPress={() => router.push(`/artist/${a.id}`)}>
                  <AlbumCard testID={`artist-${a.id}`} imageUri={a.picture_big || a.picture_medium || ""} title={a.name} size={120} rounded />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        ) : null}

        <View style={{ height: 200 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md, marginBottom: spacing.lg },
  brand: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 28, letterSpacing: -1 },
  greeting: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  avatarImg: { width: "100%", height: "100%" },
  errorBox: { backgroundColor: "rgba(229,56,59,0.15)", borderRadius: radii.md, padding: spacing.md, marginVertical: spacing.sm },
  errorText: { color: colors.textPrimary, fontFamily: fonts.body, fontSize: 13 },
  hero: { height: 240, borderRadius: radii.lg, overflow: "hidden", backgroundColor: colors.surface },
  heroImg: { width: "100%", height: "100%", position: "absolute" },
  heroContent: { padding: spacing.lg, position: "absolute", bottom: 0, left: 0, right: 0 },
  heroOverline: { color: colors.accent, fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 2, textTransform: "uppercase" },
  heroTitle: { color: "#fff", fontFamily: fonts.heading, fontSize: 26, marginTop: 6, letterSpacing: -0.5 },
  heroArtist: { color: colors.textSecondary, fontFamily: fonts.bodyMed, fontSize: 14, marginTop: 4 },
  heroPlay: { flexDirection: "row", alignItems: "center", backgroundColor: colors.primary, alignSelf: "flex-start", paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radii.pill, marginTop: spacing.md },
  heroPlayText: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 13, marginLeft: 6 },
  hScroll: { paddingVertical: spacing.xs },
  genreGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  genreCard: { width: "48%", height: 90, borderRadius: radii.md, overflow: "hidden", marginBottom: spacing.md, backgroundColor: colors.surface, justifyContent: "flex-end", padding: spacing.sm },
  genreImg: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  genreName: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 16 },
});
