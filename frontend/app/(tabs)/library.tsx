// LibraryView — Redesign Liquid Glass avec catégories visuelles
import React, { useState } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal,
  ScrollView, Image, Alert, Platform, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useFavorites } from "../../src/context/FavoritesContext";
import { usePlayer } from "../../src/context/PlayerContext";
import { usePlaylists } from "../../src/context/PlaylistsContext";
import { useLibrary } from "../../src/context/LibraryContext";
import { useContextMenu } from "../../src/context/ContextMenuContext";
import TrackRow from "../../src/components/TrackRow";
import { showToast } from "../../src/lib/toast";
import { colors, fonts, radii, spacing } from "../../src/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - spacing.lg * 3) / 2;

type LibrarySection = "overview" | "favorites" | "playlists" | "albums" | "artists" | "podcasts";

// Liquid Glass Card Component
function GlassCard({
  icon, label, count, gradient, onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  count: number;
  gradient: [string, string];
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.glassCard} activeOpacity={0.85} onPress={onPress}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.glassGradient}>
        <View style={styles.glassInner}>
          <View style={styles.glassIconWrap}>
            <Ionicons name={icon} size={28} color="#fff" />
          </View>
          <Text style={styles.glassLabel}>{label}</Text>
          <Text style={styles.glassCount}>{count}</Text>
        </View>
      </LinearGradient>
      {/* Glass overlay effect */}
      <View style={styles.glassOverlay} />
    </TouchableOpacity>
  );
}

export default function LibraryView() {
  const { favorites } = useFavorites();
  const { playQueue } = usePlayer();
  const { playlists, create, remove } = usePlaylists();
  const { albums: savedAlbums, artists: savedArtists } = useLibrary();
  const { openTrackMenu, openAlbumMenu, openArtistMenu } = useContextMenu();
  const router = useRouter();

  const [section, setSection] = useState<LibrarySection>("overview");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const handleCreate = async () => {
    const v = newName.trim();
    if (!v) return;
    await create(v);
    setNewName("");
    setCreating(false);
    showToast("Playlist créée");
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

  // Section Overview - Liquid Glass Grid
  const renderOverview = () => (
    <ScrollView style={styles.content} contentContainerStyle={styles.overviewContent} showsVerticalScrollIndicator={false}>
      <View style={styles.glassGrid}>
        <GlassCard
          icon="heart"
          label="Favoris"
          count={favorites.length}
          gradient={["#FF416C", "#FF4B2B"]}
          onPress={() => setSection("favorites")}
        />
        <GlassCard
          icon="list"
          label="Playlists"
          count={playlists.length}
          gradient={["#7F7FD5", "#86A8E7"]}
          onPress={() => setSection("playlists")}
        />
        <GlassCard
          icon="disc"
          label="Albums"
          count={savedAlbums.length}
          gradient={["#11998e", "#38ef7d"]}
          onPress={() => setSection("albums")}
        />
        <GlassCard
          icon="person"
          label="Artistes"
          count={savedArtists.length}
          gradient={["#FC466B", "#3F5EFB"]}
          onPress={() => setSection("artists")}
        />
      </View>

      {/* Quick access - Recent favorites */}
      {favorites.length > 0 && (
        <View style={styles.quickSection}>
          <View style={styles.quickHeader}>
            <Text style={styles.quickTitle}>Favoris récents</Text>
            <TouchableOpacity onPress={() => setSection("favorites")}>
              <Text style={styles.quickMore}>Tout voir</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickScroll}>
            {favorites.slice(0, 10).map((t) => (
              <TouchableOpacity
                key={t.id}
                style={styles.quickCard}
                activeOpacity={0.8}
                onPress={() => playQueue(favorites, favorites.indexOf(t))}
                onLongPress={() => openTrackMenu(t)}
                delayLongPress={400}
              >
                <Image source={{ uri: t.album?.cover_medium || t.album?.cover }} style={styles.quickImg} />
                <Text style={styles.quickName} numberOfLines={1}>{t.title}</Text>
                <Text style={styles.quickArtist} numberOfLines={1}>{t.artist?.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Quick access - Playlists */}
      {playlists.length > 0 && (
        <View style={styles.quickSection}>
          <View style={styles.quickHeader}>
            <Text style={styles.quickTitle}>Mes playlists</Text>
            <TouchableOpacity onPress={() => setSection("playlists")}>
              <Text style={styles.quickMore}>Tout voir</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickScroll}>
            {/* New Playlist Card */}
            <TouchableOpacity style={[styles.quickCard, styles.newPlaylistCard]} onPress={() => setCreating(true)}>
              <View style={styles.newPlaylistIcon}>
                <Ionicons name="add" size={32} color={colors.primary} />
              </View>
              <Text style={styles.quickName}>Nouvelle</Text>
              <Text style={styles.quickArtist}>playlist</Text>
            </TouchableOpacity>
            {playlists.map((pl) => {
              const cover = pl.tracks?.[0]?.album?.cover_medium;
              return (
                <TouchableOpacity
                  key={pl.id}
                  style={styles.quickCard}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/playlist/${pl.id}`)}
                  onLongPress={() => handleDelete(pl.id, pl.name)}
                  delayLongPress={500}
                >
                  {cover ? (
                    <Image source={{ uri: cover }} style={styles.quickImg} />
                  ) : (
                    <View style={[styles.quickImg, styles.quickImgFallback]}>
                      <Ionicons name="musical-notes" size={28} color={colors.textSecondary} />
                    </View>
                  )}
                  <Text style={styles.quickName} numberOfLines={1}>{pl.name}</Text>
                  <Text style={styles.quickArtist}>{pl.tracks?.length || 0} titres</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Quick access - Albums */}
      {savedAlbums.length > 0 && (
        <View style={styles.quickSection}>
          <View style={styles.quickHeader}>
            <Text style={styles.quickTitle}>Albums sauvegardés</Text>
            <TouchableOpacity onPress={() => setSection("albums")}>
              <Text style={styles.quickMore}>Tout voir</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickScroll}>
            {savedAlbums.slice(0, 10).map((a) => (
              <TouchableOpacity
                key={a.id}
                style={styles.quickCard}
                activeOpacity={0.8}
                onPress={() => router.push(`/album/${a.id}`)}
                onLongPress={() => openAlbumMenu(a)}
                delayLongPress={400}
              >
                <Image source={{ uri: a.cover_medium || a.cover }} style={styles.quickImg} />
                <Text style={styles.quickName} numberOfLines={1}>{a.title}</Text>
                <Text style={styles.quickArtist} numberOfLines={1}>{a.artist?.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </ScrollView>
  );

  // Section Favorites
  const renderFavorites = () => (
    favorites.length === 0 ? (
      <View style={styles.empty}>
        <View style={styles.emptyIconWrap}>
          <Ionicons name="heart-outline" size={48} color={colors.textTertiary} />
        </View>
        <Text style={styles.emptyTitle}>Aucun favori</Text>
        <Text style={styles.emptyText}>Appuie sur le cœur d'un titre pour l'ajouter</Text>
      </View>
    ) : (
      <FlatList
        data={favorites}
        keyExtractor={(it) => String(it.id)}
        renderItem={({ item, index }) => (
          <TrackRow
            track={item}
            index={index}
            onPress={() => playQueue(favorites, index)}
            onLongPress={() => openTrackMenu(item)}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 220 }}
      />
    )
  );

  // Section Playlists
  const renderPlaylists = () => (
    <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 220 }}>
      <TouchableOpacity onPress={() => setCreating(true)} style={styles.createBtn}>
        <LinearGradient colors={["#7F7FD5", "#86A8E7"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.createBtnGradient}>
          <Ionicons name="add-circle" size={22} color="#fff" />
          <Text style={styles.createBtnText}>Nouvelle playlist</Text>
        </LinearGradient>
      </TouchableOpacity>

      {playlists.length === 0 ? (
        <View style={styles.emptyInline}>
          <Ionicons name="albums-outline" size={40} color={colors.textTertiary} />
          <Text style={styles.emptyTitle}>Aucune playlist</Text>
          <Text style={styles.emptyText}>Crée ta première playlist</Text>
        </View>
      ) : (
        playlists.map((pl) => {
          const cover = pl.tracks?.[0]?.album?.cover_medium;
          return (
            <TouchableOpacity
              key={pl.id}
              onPress={() => router.push(`/playlist/${pl.id}`)}
              onLongPress={() => handleDelete(pl.id, pl.name)}
              style={styles.listRow}
              activeOpacity={0.8}
            >
              {cover ? (
                <Image source={{ uri: cover }} style={styles.listCover} />
              ) : (
                <View style={[styles.listCover, styles.listCoverFallback]}>
                  <Ionicons name="musical-notes" size={24} color={colors.textSecondary} />
                </View>
              )}
              <View style={styles.listMeta}>
                <Text style={styles.listTitle} numberOfLines={1}>{pl.name}</Text>
                <Text style={styles.listSubtitle}>{pl.tracks?.length || 0} titre{(pl.tracks?.length || 0) > 1 ? "s" : ""}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );

  // Section Albums
  const renderAlbums = () => (
    savedAlbums.length === 0 ? (
      <View style={styles.empty}>
        <View style={styles.emptyIconWrap}>
          <Ionicons name="disc-outline" size={48} color={colors.textTertiary} />
        </View>
        <Text style={styles.emptyTitle}>Aucun album</Text>
        <Text style={styles.emptyText}>Ajoute des albums depuis leurs pages</Text>
      </View>
    ) : (
      <FlatList
        data={savedAlbums}
        keyExtractor={(a) => String(a.id)}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => router.push(`/album/${item.id}`)}
            onLongPress={() => openAlbumMenu(item)}
            delayLongPress={400}
            activeOpacity={0.8}
          >
            <Image source={{ uri: item.cover_big || item.cover_medium }} style={styles.gridImg} />
            <Text style={styles.gridTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.gridSubtitle} numberOfLines={1}>{item.artist?.name}</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 220 }}
      />
    )
  );

  // Section Artists
  const renderArtists = () => (
    savedArtists.length === 0 ? (
      <View style={styles.empty}>
        <View style={styles.emptyIconWrap}>
          <Ionicons name="person-outline" size={48} color={colors.textTertiary} />
        </View>
        <Text style={styles.emptyTitle}>Aucun artiste</Text>
        <Text style={styles.emptyText}>Suis des artistes depuis leurs pages</Text>
      </View>
    ) : (
      <FlatList
        data={savedArtists}
        keyExtractor={(a) => String(a.id)}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.gridCard, styles.artistCard]}
            onPress={() => router.push(`/artist/${item.id}`)}
            onLongPress={() => openArtistMenu(item)}
            delayLongPress={400}
            activeOpacity={0.8}
          >
            <Image source={{ uri: item.picture_big || item.picture_medium }} style={styles.artistImg} />
            <Text style={styles.gridTitle} numberOfLines={1}>{item.name}</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 220 }}
      />
    )
  );

  // Render current section
  const renderContent = () => {
    switch (section) {
      case "overview": return renderOverview();
      case "favorites": return renderFavorites();
      case "playlists": return renderPlaylists();
      case "albums": return renderAlbums();
      case "artists": return renderArtists();
      default: return renderOverview();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        {section !== "overview" ? (
          <TouchableOpacity onPress={() => setSection("overview")} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.title}>
          {section === "overview" ? "Bibliothèque" :
           section === "favorites" ? "Favoris" :
           section === "playlists" ? "Playlists" :
           section === "albums" ? "Albums" :
           section === "artists" ? "Artistes" : "Bibliothèque"}
        </Text>
        {section !== "overview" && (
          <Text style={styles.headerCount}>
            {section === "favorites" ? favorites.length :
             section === "playlists" ? playlists.length :
             section === "albums" ? savedAlbums.length :
             section === "artists" ? savedArtists.length : 0}
          </Text>
        )}
        {section === "overview" && (
          <TouchableOpacity onPress={() => router.push("/import")} style={styles.importBtn}>
            <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {renderContent()}

      {/* Modal création playlist */}
      <Modal visible={creating} transparent animationType="fade" onRequestClose={() => setCreating(false)}>
        <View style={styles.modalBg}>
          <BlurView intensity={60} tint="dark" style={styles.modalBlur}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Nouvelle playlist</Text>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="Nom de la playlist"
                placeholderTextColor={colors.textTertiary}
                style={styles.modalInput}
                autoFocus
                onSubmitEditing={handleCreate}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => { setCreating(false); setNewName(""); }} style={[styles.modalBtn, styles.modalBtnCancel]}>
                  <Text style={styles.modalBtnCancelText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCreate} style={[styles.modalBtn, styles.modalBtnConfirm]}>
                  <Text style={styles.modalBtnConfirmText}>Créer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    marginRight: spacing.sm,
    padding: 4,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.heading,
    fontSize: 28,
    letterSpacing: -1,
    flex: 1,
  },
  headerCount: {
    color: colors.textSecondary,
    fontFamily: fonts.bodyMed,
    fontSize: 16,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  importBtn: {
    padding: spacing.xs,
    marginLeft: "auto",
  },
  content: { flex: 1 },
  overviewContent: { paddingBottom: 220 },

  // Glass Cards Grid
  glassGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  glassCard: {
    width: CARD_WIDTH,
    height: 120,
    borderRadius: radii.lg,
    overflow: "hidden",
  },
  glassGradient: {
    flex: 1,
    padding: spacing.md,
  },
  glassInner: {
    flex: 1,
    justifyContent: "space-between",
  },
  glassIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  glassLabel: {
    color: "#fff",
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    marginTop: 8,
  },
  glassCount: {
    color: "rgba(255,255,255,0.8)",
    fontFamily: fonts.body,
    fontSize: 13,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    pointerEvents: "none",
  },

  // Quick access sections
  quickSection: {
    marginTop: spacing.xl,
  },
  quickHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  quickTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 18,
  },
  quickMore: {
    color: colors.primary,
    fontFamily: fonts.bodyMed,
    fontSize: 14,
  },
  quickScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  quickCard: {
    width: 110,
    marginRight: spacing.md,
  },
  quickImg: {
    width: 110,
    height: 110,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  quickImgFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  quickName: {
    color: colors.textPrimary,
    fontFamily: fonts.bodyMed,
    fontSize: 13,
    marginTop: 8,
  },
  quickArtist: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 2,
  },
  newPlaylistCard: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: radii.md,
    height: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  newPlaylistIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceElevated,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },

  // Create button
  createBtn: {
    marginBottom: spacing.lg,
    borderRadius: radii.lg,
    overflow: "hidden",
  },
  createBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
  },
  createBtnText: {
    color: "#fff",
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    marginLeft: spacing.sm,
  },

  // List rows
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
  },
  listCover: {
    width: 56,
    height: 56,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceElevated,
  },
  listCoverFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  listMeta: {
    flex: 1,
    marginLeft: spacing.md,
  },
  listTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodyMed,
    fontSize: 15,
  },
  listSubtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },

  // Grid
  gridRow: {
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  gridCard: {
    width: CARD_WIDTH,
  },
  gridImg: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  gridTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodyMed,
    fontSize: 14,
    marginTop: 8,
  },
  gridSubtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  artistCard: {
    alignItems: "center",
  },
  artistImg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surface,
  },

  // Empty states
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  emptyInline: {
    alignItems: "center",
    paddingVertical: spacing.xl * 2,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.heading,
    fontSize: 18,
    marginTop: spacing.sm,
  },
  emptyText: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: 14,
    textAlign: "center",
    marginTop: 6,
    maxWidth: 250,
  },

  // Modal
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalBlur: {
    borderRadius: radii.xl,
    overflow: "hidden",
    width: "100%",
    maxWidth: 400,
  },
  modal: {
    backgroundColor: "rgba(30,30,40,0.85)",
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  modalTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.heading,
    fontSize: 22,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  modalInput: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: 14,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalActions: {
    flexDirection: "row",
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.lg,
    alignItems: "center",
  },
  modalBtnCancel: {
    backgroundColor: colors.surface,
  },
  modalBtnCancelText: {
    color: colors.textSecondary,
    fontFamily: fonts.bodyMed,
    fontSize: 15,
  },
  modalBtnConfirm: {
    backgroundColor: colors.primary,
  },
  modalBtnConfirmText: {
    color: "#fff",
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
});
