// ImportScreen — Import TXT/CSV pour playlists, favoris, artistes
// Supporte multi-formats : "Artiste - Titre", "Titre;Artiste", CSV avec headers, etc.
import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  ActivityIndicator, Alert, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, Stack } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { BlurView } from "expo-blur";
import { api } from "../src/api/client";
import { useFavorites } from "../src/context/FavoritesContext";
import { usePlaylists } from "../src/context/PlaylistsContext";
import { useLibrary } from "../src/context/LibraryContext";
import { showToast } from "../src/lib/toast";
import { colors, fonts, radii, spacing } from "../src/theme";
import type { Track } from "../src/types/music";

type ImportTarget = "favorites" | "playlist" | "artists";

interface ParsedLine {
  raw: string;
  query: string;
  artist?: string;
  title?: string;
}

interface SearchResult {
  query: string;
  track: Track | null;
}

// Parser multi-format
function parseImportContent(content: string): ParsedLine[] {
  const lines = content
    .split(/[\r\n]+/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && !l.toLowerCase().startsWith("artist") && !l.toLowerCase().startsWith("titre"));

  const results: ParsedLine[] = [];

  for (const line of lines) {
    let artist: string | undefined;
    let title: string | undefined;
    let query = line;

    // Format 1: "Artiste - Titre" ou "Artiste – Titre"
    if (line.includes(" - ") || line.includes(" – ")) {
      const parts = line.split(/ [-–] /);
      if (parts.length >= 2) {
        artist = parts[0].trim();
        title = parts.slice(1).join(" - ").trim();
        query = `${artist} ${title}`;
      }
    }
    // Format 2: CSV "Titre;Artiste" ou "Artiste;Titre"
    else if (line.includes(";")) {
      const parts = line.split(";").map((p) => p.trim().replace(/^["']|["']$/g, ""));
      if (parts.length >= 2) {
        // Heuristique : le plus court est probablement l'artiste
        if (parts[0].length < parts[1].length) {
          artist = parts[0];
          title = parts[1];
        } else {
          title = parts[0];
          artist = parts[1];
        }
        query = `${artist} ${title}`;
      }
    }
    // Format 3: CSV "Titre,Artiste" ou "Artiste,Titre"
    else if (line.includes(",") && !line.includes(" ")) {
      const parts = line.split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
      if (parts.length >= 2) {
        if (parts[0].length < parts[1].length) {
          artist = parts[0];
          title = parts[1];
        } else {
          title = parts[0];
          artist = parts[1];
        }
        query = `${artist} ${title}`;
      }
    }
    // Format 4: Juste un titre ou "Artiste Titre" (pas de séparateur clair)
    else {
      query = line;
    }

    results.push({ raw: line, query, artist, title });
  }

  return results;
}

export default function ImportScreen() {
  const router = useRouter();
  const { addFavorite } = useFavorites();
  const { playlists, create: createPlaylist, addTracks } = usePlaylists();
  const { saveArtist } = useLibrary();

  const [content, setContent] = useState("");
  const [target, setTarget] = useState<ImportTarget>("favorites");
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Ouvrir un fichier
  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/plain", "text/csv", "application/csv", "*/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      
      // Lire le contenu du fichier
      const response = await fetch(file.uri);
      const text = await response.text();
      setContent(text);
      showToast(`Fichier chargé (${text.split("\n").length} lignes)`);
    } catch (e) {
      showToast("Erreur lors de la lecture du fichier");
    }
  };

  // Lancer l'import
  const handleImport = useCallback(async () => {
    if (!content.trim()) {
      showToast("Aucun contenu à importer");
      return;
    }

    const parsed = parseImportContent(content);
    if (parsed.length === 0) {
      showToast("Aucune ligne valide trouvée");
      return;
    }

    if (parsed.length > 300) {
      Alert.alert("Trop de lignes", `Maximum 300 titres par import (trouvé: ${parsed.length})`);
      return;
    }

    setLoading(true);
    setProgress({ current: 0, total: parsed.length });
    setShowResults(false);

    try {
      // Recherche en bulk
      const queries = parsed.map((p) => p.query);
      const res = await api<{ results: SearchResult[] }>("/search-tracks-bulk", {
        method: "POST",
        body: JSON.stringify({ queries }),
      });

      setResults(res.results);
      setProgress({ current: parsed.length, total: parsed.length });

      // Compter les trouvés
      const found = res.results.filter((r) => r.track);
      const tracks = found.map((r) => r.track!);

      if (tracks.length === 0) {
        showToast("Aucun titre trouvé");
        setShowResults(true);
        setLoading(false);
        return;
      }

      // Importer selon la cible
      if (target === "favorites") {
        for (const t of tracks) {
          await addFavorite(t);
        }
        showToast(`${tracks.length} titres ajoutés aux favoris`);
      } else if (target === "playlist") {
        let playlistId = selectedPlaylist;
        
        // Créer une nouvelle playlist si nécessaire
        if (!playlistId && newPlaylistName.trim()) {
          const newPl = await createPlaylist(newPlaylistName.trim());
          if (newPl?.id) {
            playlistId = newPl.id;
          }
        }

        if (playlistId) {
          await addTracks(playlistId, tracks);
          showToast(`${tracks.length} titres ajoutés à la playlist`);
        } else {
          showToast("Sélectionnez ou créez une playlist");
        }
      } else if (target === "artists") {
        // Extraire les artistes uniques
        const artistsMap = new Map<number, { id: number; name: string; picture?: string; picture_medium?: string }>();
        for (const t of tracks) {
          if (t.artist?.id && !artistsMap.has(t.artist.id)) {
            artistsMap.set(t.artist.id, t.artist);
          }
        }
        for (const artist of artistsMap.values()) {
          await saveArtist(artist as any);
        }
        showToast(`${artistsMap.size} artistes ajoutés`);
      }

      setShowResults(true);
    } catch (e) {
      console.error("Import error:", e);
      showToast("Erreur lors de l'import");
    } finally {
      setLoading(false);
    }
  }, [content, target, selectedPlaylist, newPlaylistName, addFavorite, createPlaylist, addTracks, saveArtist]);

  const foundCount = results.filter((r) => r.track).length;
  const notFoundCount = results.length - foundCount;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Importer</Text>
        </View>

        <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Instructions */}
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={24} color={colors.primary} />
            <View style={styles.infoText}>
              <Text style={styles.infoTitle}>Formats supportés</Text>
              <Text style={styles.infoDesc}>• Artiste - Titre</Text>
              <Text style={styles.infoDesc}>• Titre;Artiste (CSV)</Text>
              <Text style={styles.infoDesc}>• Titre,Artiste (CSV)</Text>
              <Text style={styles.infoDesc}>• Un titre par ligne</Text>
            </View>
          </View>

          {/* Bouton fichier */}
          <TouchableOpacity style={styles.fileBtn} onPress={pickFile}>
            <Ionicons name="document-text" size={24} color={colors.primary} />
            <Text style={styles.fileBtnText}>Choisir un fichier TXT/CSV</Text>
          </TouchableOpacity>

          {/* Zone de texte */}
          <Text style={styles.label}>Ou collez le contenu ici :</Text>
          <TextInput
            style={styles.textInput}
            multiline
            numberOfLines={8}
            value={content}
            onChangeText={setContent}
            placeholder={"Drake - One Dance\nThe Weeknd - Blinding Lights\nDua Lipa - Levitating"}
            placeholderTextColor={colors.textTertiary}
            textAlignVertical="top"
          />
          {content.trim() && (
            <Text style={styles.lineCount}>{parseImportContent(content).length} lignes détectées</Text>
          )}

          {/* Cible */}
          <Text style={styles.label}>Importer vers :</Text>
          <View style={styles.targetRow}>
            <TouchableOpacity
              style={[styles.targetBtn, target === "favorites" && styles.targetBtnActive]}
              onPress={() => setTarget("favorites")}
            >
              <Ionicons name="heart" size={18} color={target === "favorites" ? "#fff" : colors.textSecondary} />
              <Text style={[styles.targetText, target === "favorites" && styles.targetTextActive]}>Favoris</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.targetBtn, target === "playlist" && styles.targetBtnActive]}
              onPress={() => setTarget("playlist")}
            >
              <Ionicons name="list" size={18} color={target === "playlist" ? "#fff" : colors.textSecondary} />
              <Text style={[styles.targetText, target === "playlist" && styles.targetTextActive]}>Playlist</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.targetBtn, target === "artists" && styles.targetBtnActive]}
              onPress={() => setTarget("artists")}
            >
              <Ionicons name="person" size={18} color={target === "artists" ? "#fff" : colors.textSecondary} />
              <Text style={[styles.targetText, target === "artists" && styles.targetTextActive]}>Artistes</Text>
            </TouchableOpacity>
          </View>

          {/* Sélection playlist */}
          {target === "playlist" && (
            <View style={styles.playlistSection}>
              <Text style={styles.subLabel}>Choisir une playlist existante :</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.playlistScroll}>
                {playlists.map((pl) => (
                  <TouchableOpacity
                    key={pl.id}
                    style={[styles.playlistChip, selectedPlaylist === pl.id && styles.playlistChipActive]}
                    onPress={() => { setSelectedPlaylist(pl.id); setNewPlaylistName(""); }}
                  >
                    <Text style={[styles.playlistChipText, selectedPlaylist === pl.id && styles.playlistChipTextActive]}>
                      {pl.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.subLabel}>Ou créer une nouvelle :</Text>
              <TextInput
                style={styles.newPlaylistInput}
                value={newPlaylistName}
                onChangeText={(v) => { setNewPlaylistName(v); setSelectedPlaylist(null); }}
                placeholder="Nom de la nouvelle playlist"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
          )}

          {/* Bouton Import */}
          <TouchableOpacity
            style={[styles.importBtn, (!content.trim() || loading) && styles.importBtnDisabled]}
            onPress={handleImport}
            disabled={!content.trim() || loading}
          >
            {loading ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.importBtnText}>
                  Recherche... {progress.current}/{progress.total}
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="cloud-upload" size={20} color="#fff" />
                <Text style={styles.importBtnText}>Lancer l'import</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Résultats */}
          {showResults && results.length > 0 && (
            <View style={styles.resultsSection}>
              <Text style={styles.resultsTitle}>Résultats de l'import</Text>
              <View style={styles.resultsSummary}>
                <View style={[styles.resultsBadge, { backgroundColor: "#2ecc71" }]}>
                  <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  <Text style={styles.resultsBadgeText}>{foundCount} trouvés</Text>
                </View>
                {notFoundCount > 0 && (
                  <View style={[styles.resultsBadge, { backgroundColor: "#e74c3c" }]}>
                    <Ionicons name="close-circle" size={16} color="#fff" />
                    <Text style={styles.resultsBadgeText}>{notFoundCount} non trouvés</Text>
                  </View>
                )}
              </View>

              {/* Liste des non trouvés */}
              {notFoundCount > 0 && (
                <View style={styles.notFoundList}>
                  <Text style={styles.notFoundTitle}>Titres non trouvés :</Text>
                  {results.filter((r) => !r.track).slice(0, 20).map((r, i) => (
                    <Text key={i} style={styles.notFoundItem}>• {r.query}</Text>
                  ))}
                  {notFoundCount > 20 && (
                    <Text style={styles.notFoundMore}>...et {notFoundCount - 20} autres</Text>
                  )}
                </View>
              )}
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { marginRight: spacing.sm },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.heading,
    fontSize: 22,
  },
  content: { flex: 1 },
  scrollContent: { padding: spacing.lg },

  // Info card
  infoCard: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoText: { marginLeft: spacing.sm, flex: 1 },
  infoTitle: { color: colors.textPrimary, fontFamily: fonts.bodyBold, fontSize: 14 },
  infoDesc: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },

  // File button
  fileBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.primary,
    marginBottom: spacing.md,
  },
  fileBtnText: {
    color: colors.primary,
    fontFamily: fonts.bodyMed,
    fontSize: 14,
    marginLeft: spacing.sm,
  },

  // Text input
  label: {
    color: colors.textPrimary,
    fontFamily: fonts.bodyMed,
    fontSize: 14,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  textInput: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: 14,
    minHeight: 150,
    borderWidth: 1,
    borderColor: colors.border,
  },
  lineCount: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: spacing.xs,
    textAlign: "right",
  },

  // Target selection
  targetRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  targetBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  targetBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  targetText: {
    color: colors.textSecondary,
    fontFamily: fonts.bodyMed,
    fontSize: 13,
    marginLeft: 6,
  },
  targetTextActive: { color: "#fff" },

  // Playlist section
  playlistSection: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
  },
  subLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  playlistScroll: {
    marginBottom: spacing.md,
  },
  playlistChip: {
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    marginRight: spacing.xs,
  },
  playlistChipActive: {
    backgroundColor: colors.primary,
  },
  playlistChipText: {
    color: colors.textSecondary,
    fontFamily: fonts.bodyMed,
    fontSize: 13,
  },
  playlistChipTextActive: { color: "#fff" },
  newPlaylistInput: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: spacing.sm,
    color: colors.textPrimary,
    fontFamily: fonts.body,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Import button
  importBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radii.lg,
    marginTop: spacing.xl,
  },
  importBtnDisabled: {
    opacity: 0.5,
  },
  importBtnText: {
    color: "#fff",
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    marginLeft: spacing.sm,
  },

  // Results
  resultsSection: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
  },
  resultsTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.heading,
    fontSize: 18,
    marginBottom: spacing.sm,
  },
  resultsSummary: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  resultsBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  resultsBadgeText: {
    color: "#fff",
    fontFamily: fonts.bodyMed,
    fontSize: 12,
    marginLeft: 4,
  },
  notFoundList: {
    backgroundColor: "rgba(231,76,60,0.1)",
    padding: spacing.sm,
    borderRadius: radii.md,
  },
  notFoundTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodyMed,
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  notFoundItem: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 18,
  },
  notFoundMore: {
    color: colors.textTertiary,
    fontFamily: fonts.body,
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 4,
  },
});
