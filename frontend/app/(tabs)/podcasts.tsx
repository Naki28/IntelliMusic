// PodcastsView — Onglet Podcasts (recherche + top + saved)
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "../../src/api/client";
import { useLibrary } from "../../src/context/LibraryContext";
import { colors, fonts, radii, spacing } from "../../src/theme";

interface ITunesPodcast {
  collectionId?: number;
  id?: number;
  collectionName?: string;
  name?: string;
  artistName?: string;
  artist?: string;
  artworkUrl600?: string;
  artworkUrl100?: string;
  image?: string;
}

function getId(p: ITunesPodcast): number {
  return (p.collectionId || p.id || 0) as number;
}
function getArt(p: ITunesPodcast): string | undefined {
  return p.artworkUrl600 || p.artworkUrl100 || p.image;
}
function getName(p: ITunesPodcast): string {
  return p.collectionName || p.name || "";
}
function getArtist(p: ITunesPodcast): string {
  return p.artistName || p.artist || "";
}

export default function PodcastsView() {
  const router = useRouter();
  const { podcasts: savedPodcasts } = useLibrary();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ITunesPodcast[]>([]);
  const [topList, setTopList] = useState<ITunesPodcast[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api<{ data: ITunesPodcast[] }>("/podcasts/top?limit=20");
        setTopList(r.data || []);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!q.trim()) { setResults([]); return; }
    const h = setTimeout(async () => {
      try {
        setLoading(true);
        const r = await api<{ results: ITunesPodcast[] }>(`/podcasts/search?q=${encodeURIComponent(q)}&limit=20`);
        setResults(r.results || []);
      } catch {} finally { setLoading(false); }
    }, 350);
    return () => clearTimeout(h);
  }, [q]);

  const renderCard = (p: ITunesPodcast, key: string) => (
    <TouchableOpacity key={key} testID={`podcast-${getId(p)}`} onPress={() => router.push(`/podcast/${getId(p)}`)} style={styles.card}>
      <Image source={{ uri: getArt(p) }} style={styles.cover} />
      <Text style={styles.cardName} numberOfLines={2}>{getName(p)}</Text>
      <Text style={styles.cardArtist} numberOfLines={1}>{getArtist(p)}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Podcasts</Text>
      </View>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          testID="podcast-search-input"
          value={q}
          onChangeText={setQ}
          placeholder="Rechercher un podcast..."
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
        />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 200 }} showsVerticalScrollIndicator={false}>
        {q.trim() ? (
          loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} /> : (
            <>
              <Text style={styles.section}>Résultats</Text>
              <View style={styles.grid}>{results.map((p) => renderCard(p, `r${getId(p)}`))}</View>
            </>
          )
        ) : (
          <>
            {savedPodcasts.length > 0 ? (
              <>
                <Text style={styles.section}>Mes podcasts</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg }}>
                  {savedPodcasts.map((p) => renderCard(p as any, `s${getId(p as any)}`))}
                </ScrollView>
              </>
            ) : null}
            <Text style={styles.section}>Top podcasts FR</Text>
            <View style={styles.grid}>{topList.map((p) => renderCard(p, `t${getId(p)}`))}</View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 28, letterSpacing: -1 },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radii.md, paddingHorizontal: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.md, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, color: colors.textPrimary, fontFamily: fonts.body, paddingVertical: 12, marginLeft: 10, fontSize: 15 },
  section: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 20, paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: spacing.lg, justifyContent: "space-between" },
  card: { width: 150, marginRight: spacing.md, marginBottom: spacing.lg },
  cover: { width: 150, height: 150, borderRadius: radii.md, backgroundColor: colors.surface },
  cardName: { color: colors.textPrimary, fontFamily: fonts.bodyBold, fontSize: 13, marginTop: 6 },
  cardArtist: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
});
