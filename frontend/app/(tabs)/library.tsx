// LibraryView — Favoris + Playlists
import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, ScrollView, Image, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFavorites } from "../../src/context/FavoritesContext";
import { usePlayer } from "../../src/context/PlayerContext";
import { usePlaylists } from "../../src/context/PlaylistsContext";
import { useLibrary } from "../../src/context/LibraryContext";
import TrackRow from "../../src/components/TrackRow";
import { colors, fonts, radii, spacing } from "../../src/theme";

type Tab = "favorites" | "playlists" | "albums" | "artists";

export default function LibraryView() {
  const { favorites } = useFavorites();
  const { playQueue } = usePlayer();
  const { playlists, create, remove } = usePlaylists();
  const { albums: savedAlbums, artists: savedArtists } = useLibrary();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("favorites");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = async () => {
    const v = newName.trim();
    if (!v) return;
    await create(v);
    setNewName("");
    setCreating(false);
  };

  const handleDelete = (id: string, name: string) => {
    const fn = () => remove(id);
    if (Platform.OS === "web") {
      if (window.confirm(`Supprimer "${name}" ?`)) fn();
    } else {
      Alert.alert("Supprimer", `Supprimer "${name}" ?`, [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: fn },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Bibliothèque</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={{ paddingRight: spacing.lg }}>
        <TouchableOpacity testID="lib-tab-favorites" onPress={() => setTab("favorites")} style={[styles.tab, tab === "favorites" && styles.tabActive]}>
          <Text style={[styles.tabLabel, tab === "favorites" && styles.tabLabelActive]}>Favoris ({favorites.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="lib-tab-playlists" onPress={() => setTab("playlists")} style={[styles.tab, tab === "playlists" && styles.tabActive]}>
          <Text style={[styles.tabLabel, tab === "playlists" && styles.tabLabelActive]}>Playlists ({playlists.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="lib-tab-albums" onPress={() => setTab("albums")} style={[styles.tab, tab === "albums" && styles.tabActive]}>
          <Text style={[styles.tabLabel, tab === "albums" && styles.tabLabelActive]}>Albums ({savedAlbums.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="lib-tab-artists" onPress={() => setTab("artists")} style={[styles.tab, tab === "artists" && styles.tabActive]}>
          <Text style={[styles.tabLabel, tab === "artists" && styles.tabLabelActive]}>Artistes ({savedArtists.length})</Text>
        </TouchableOpacity>
      </ScrollView>

      {tab === "favorites" ? (
        favorites.length === 0 ? (
          <View style={styles.empty} testID="library-empty">
            <Ionicons name="heart-outline" size={64} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>Aucun favori</Text>
            <Text style={styles.emptyText}>Appuie sur le cœur d&apos;un titre pour l&apos;ajouter</Text>
          </View>
        ) : (
          <FlatList
            testID="library-list"
            data={favorites}
            keyExtractor={(it) => String(it.id)}
            renderItem={({ item, index }) => (
              <TrackRow track={item} index={index} onPress={() => playQueue(favorites, index)} />
            )}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 220 }}
          />
        )
      ) : tab === "albums" ? (
        savedAlbums.length === 0 ? (
          <View style={styles.empty}><Ionicons name="albums-outline" size={56} color={colors.textTertiary} /><Text style={styles.emptyTitle}>Aucun album</Text><Text style={styles.emptyText}>Ajoute des albums depuis leurs pages</Text></View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 220 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
              {savedAlbums.map((a) => (
                <TouchableOpacity key={a.id} onPress={() => router.push(`/album/${a.id}`)} style={{ width: "48%", marginBottom: spacing.lg }}>
                  <Image source={{ uri: a.cover_big || a.cover_medium }} style={{ width: "100%", aspectRatio: 1, borderRadius: radii.md }} />
                  <Text style={{ color: colors.textPrimary, fontFamily: fonts.bodyMed, fontSize: 13, marginTop: 6 }} numberOfLines={1}>{a.title}</Text>
                  <Text style={{ color: colors.textSecondary, fontFamily: fonts.body, fontSize: 11 }} numberOfLines={1}>{a.artist?.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )
      ) : tab === "artists" ? (
        savedArtists.length === 0 ? (
          <View style={styles.empty}><Ionicons name="person-outline" size={56} color={colors.textTertiary} /><Text style={styles.emptyTitle}>Aucun artiste suivi</Text><Text style={styles.emptyText}>Suis des artistes depuis leurs pages</Text></View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 220 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
              {savedArtists.map((a) => (
                <TouchableOpacity key={a.id} onPress={() => router.push(`/artist/${a.id}`)} style={{ width: "48%", marginBottom: spacing.lg, alignItems: "center" }}>
                  <Image source={{ uri: a.picture_big || a.picture_medium }} style={{ width: 120, height: 120, borderRadius: 60 }} />
                  <Text style={{ color: colors.textPrimary, fontFamily: fonts.bodyMed, fontSize: 13, marginTop: 8, textAlign: "center" }} numberOfLines={1}>{a.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 220 }}>
          <TouchableOpacity testID="playlist-new-btn" onPress={() => setCreating(true)} style={styles.newBtn}>
            <Ionicons name="add-circle" size={22} color={colors.primary} />
            <Text style={styles.newText}>Nouvelle playlist</Text>
          </TouchableOpacity>

          {playlists.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="albums-outline" size={56} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>Aucune playlist</Text>
              <Text style={styles.emptyText}>Crée ta première playlist</Text>
            </View>
          ) : (
            playlists.map((pl) => {
              const cover = pl.tracks?.[0]?.album?.cover_medium;
              return (
                <TouchableOpacity
                  key={pl.id}
                  testID={`playlist-card-${pl.id}`}
                  onPress={() => router.push(`/playlist/${pl.id}`)}
                  onLongPress={() => handleDelete(pl.id, pl.name)}
                  style={styles.plRow}
                >
                  {cover ? <Image source={{ uri: cover }} style={styles.plCover} /> : (
                    <View style={[styles.plCover, styles.plCoverFallback]}>
                      <Ionicons name="musical-notes" size={24} color={colors.textSecondary} />
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <Text style={styles.plName} numberOfLines={1}>{pl.name}</Text>
                    <Text style={styles.plMeta}>{pl.tracks?.length || 0} titre{(pl.tracks?.length || 0) > 1 ? "s" : ""}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Modal création playlist */}
      <Modal visible={creating} transparent animationType="fade" onRequestClose={() => setCreating(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Nouvelle playlist</Text>
            <TextInput
              testID="playlist-name-input"
              value={newName}
              onChangeText={setNewName}
              placeholder="Nom de la playlist"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
              autoFocus
              onSubmitEditing={handleCreate}
            />
            <View style={{ flexDirection: "row", marginTop: spacing.md }}>
              <TouchableOpacity onPress={() => { setCreating(false); setNewName(""); }} style={[styles.modalBtn, { backgroundColor: colors.surface, marginRight: 8 }]}>
                <Text style={{ color: colors.textSecondary, fontFamily: fonts.bodyMed }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="playlist-create-confirm" onPress={handleCreate} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: "#fff", fontFamily: fonts.bodyBold }}>Créer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 28, letterSpacing: -1 },
  tabs: { flexDirection: "row", paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  tab: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radii.pill, marginRight: spacing.sm, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabLabel: { color: colors.textSecondary, fontFamily: fonts.bodyMed, fontSize: 13 },
  tabLabelActive: { color: "#fff" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, marginTop: spacing.lg },
  emptyTitle: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 18, marginTop: spacing.md },
  emptyText: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 13, textAlign: "center", marginTop: 6 },
  newBtn: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.md },
  newText: { color: colors.textPrimary, fontFamily: fonts.bodyBold, fontSize: 15, marginLeft: spacing.sm },
  plRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, marginBottom: 4 },
  plCover: { width: 56, height: 56, borderRadius: radii.sm, backgroundColor: colors.surface },
  plCoverFallback: { alignItems: "center", justifyContent: "center" },
  plName: { color: colors.textPrimary, fontFamily: fonts.bodyMed, fontSize: 15 },
  plMeta: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", padding: spacing.lg },
  modal: { backgroundColor: colors.surfaceElevated, borderRadius: radii.lg, padding: spacing.lg, width: "100%", maxWidth: 400, borderWidth: 1, borderColor: colors.border },
  modalTitle: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 20, marginBottom: spacing.md },
  modalInput: { backgroundColor: colors.background, borderRadius: radii.md, padding: 12, color: colors.textPrimary, fontFamily: fonts.body, borderWidth: 1, borderColor: colors.border },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: radii.pill, alignItems: "center" },
});
