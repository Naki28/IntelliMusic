// ProfileView — Profil utilisateur, paramètres, connexion Deezer (MOCK)
import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, Alert, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../src/context/AuthContext";
import { usePlayer } from "../../src/context/PlayerContext";
import { colors, fonts, radii, spacing } from "../../src/theme";

const COUNTRIES = ["FR", "BE", "CH", "CA", "US", "GB", "DE", "ES", "IT", "MA", "SN", "CI"];
const ALL_GENRES = ["Pop", "Hip Hop", "Rap", "R&B", "Rock", "Jazz", "Classical", "Electro", "Reggae", "Afro", "Latin", "Country", "Indie"];

export default function ProfileView() {
  const { user, logout, updateProfile, setDeezerConnected } = useAuth();
  const { isFullStreamMode, setFullStreamMode } = usePlayer();
  const [editingArtist, setEditingArtist] = useState("");

  if (!user) return null;

  const toggleGenre = (g: string) => {
    const has = user.favorite_genres.includes(g);
    const next = has ? user.favorite_genres.filter((x) => x !== g) : [...user.favorite_genres, g];
    updateProfile({ favorite_genres: next });
  };

  const removeArtist = (a: string) => {
    updateProfile({ favorite_artists: user.favorite_artists.filter((x) => x !== a) });
  };

  const addArtist = () => {
    const v = editingArtist.trim();
    if (!v) return;
    if (user.favorite_artists.includes(v)) { setEditingArtist(""); return; }
    updateProfile({ favorite_artists: [...user.favorite_artists, v] });
    setEditingArtist("");
  };

  const handleToggleFullStream = () => {
    if (isFullStreamMode) {
      setFullStreamMode(false);
      return;
    }
    const enable = () => setFullStreamMode(true);
    const msg = "⚠️ Mode expérimental : extrait l'audio complet via yt-dlp (YouTube). Légal pour usage perso, viole les CGU YouTube — risque de retrait App Store si publié. Activer ?";
    if (Platform.OS === "web") {
      if (window.confirm(msg)) enable();
    } else {
      Alert.alert("Lecture complète (yt-dlp)", msg, [
        { text: "Annuler", style: "cancel" },
        { text: "Activer", onPress: enable },
      ]);
    }
  };

  const handleConnectDeezer = () => {
    Alert.alert(
      "Connexion Deezer",
      "⚠️ Fonctionnalité MOCK : OAuth Deezer non configuré. Active uniquement le badge Premium (les titres restent en aperçu 30s).",
      [
        { text: "Annuler", style: "cancel" },
        { text: user.deezer_connected ? "Déconnecter" : "Activer (mock)", onPress: () => setDeezerConnected(!user.deezer_connected) },
      ]
    );
  };

  const confirmLogout = () => {
    if (Platform.OS === "web") {
      if (window.confirm("Se déconnecter ?")) logout();
    } else {
      Alert.alert("Déconnexion", "Confirmer ?", [
        { text: "Annuler", style: "cancel" },
        { text: "Se déconnecter", style: "destructive", onPress: logout },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header utilisateur */}
        <View style={styles.header}>
          {user.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person" size={36} color={colors.textPrimary} />
            </View>
          )}
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>
          {user.deezer_connected ? (
            <View style={styles.premiumBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#fff" />
              <Text style={styles.premiumText}>Deezer connecté (mock)</Text>
            </View>
          ) : null}
        </View>

        {/* Pays */}
        <Text style={styles.sectionTitle}>Pays</Text>
        <Text style={styles.sectionHint}>Sert aux recommandations adaptées</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
          {COUNTRIES.map((c) => (
            <TouchableOpacity
              key={c}
              testID={`country-${c}`}
              onPress={() => updateProfile({ country: c })}
              style={[styles.chip, user.country === c && styles.chipActive]}
            >
              <Text style={[styles.chipText, user.country === c && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Genres préférés */}
        <Text style={styles.sectionTitle}>Genres préférés</Text>
        <Text style={styles.sectionHint}>Personnalise ton IntelliRadio</Text>
        <View style={styles.chipGrid}>
          {ALL_GENRES.map((g) => {
            const active = user.favorite_genres.includes(g);
            return (
              <TouchableOpacity
                key={g}
                testID={`genre-chip-${g}`}
                onPress={() => toggleGenre(g)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{g}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Artistes préférés */}
        <Text style={styles.sectionTitle}>Artistes préférés</Text>
        <View style={styles.artistRow}>
          <TextInput
            testID="profile-artist-input"
            value={editingArtist}
            onChangeText={setEditingArtist}
            placeholder="Ajouter un artiste..."
            placeholderTextColor={colors.textTertiary}
            style={styles.artistInput}
            onSubmitEditing={addArtist}
          />
          <TouchableOpacity testID="profile-artist-add" onPress={addArtist} style={styles.addBtn}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.chipGrid}>
          {user.favorite_artists.map((a) => (
            <TouchableOpacity key={a} onPress={() => removeArtist(a)} style={[styles.chip, styles.chipArtist]}>
              <Text style={styles.chipTextActive}>{a}</Text>
              <Ionicons name="close" size={14} color="#fff" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          ))}
          {user.favorite_artists.length === 0 ? (
            <Text style={styles.empty}>Aucun artiste ajouté</Text>
          ) : null}
        </View>

        {/* Mode Lecture complète (yt-dlp) */}
        <Text style={styles.sectionTitle}>Lecture</Text>
        <TouchableOpacity testID="profile-fullstream-btn" onPress={handleToggleFullStream} style={[styles.actionRow, isFullStreamMode && { borderColor: colors.primary }]}>
          <Ionicons name={isFullStreamMode ? "infinite" : "infinite-outline"} size={20} color={isFullStreamMode ? colors.primary : colors.accent} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.actionTitle}>{isFullStreamMode ? "Mode complet activé" : "Activer la lecture complète"}</Text>
            <Text style={styles.actionSubtitle}>{isFullStreamMode ? "Morceaux entiers via yt-dlp" : "Au lieu des aperçus 30s — usage perso"}</Text>
          </View>
          <View style={[styles.toggle, isFullStreamMode && styles.toggleOn]}>
            <View style={[styles.toggleDot, isFullStreamMode && styles.toggleDotOn]} />
          </View>
        </TouchableOpacity>

        {/* Connexion Deezer */}
        <Text style={styles.sectionTitle}>Compte Deezer</Text>
        <TouchableOpacity testID="profile-deezer-btn" onPress={handleConnectDeezer} style={styles.actionRow}>
          <Ionicons name="link" size={20} color={colors.accent} />
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <Text style={styles.actionTitle}>{user.deezer_connected ? "Déconnecter Deezer" : "Connecter Deezer"}</Text>
            <Text style={styles.actionSubtitle}>{user.deezer_connected ? "Tu es connecté (mock)" : "Débloque les titres complets (mock)"}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </TouchableOpacity>

        {/* Logout */}
        <TouchableOpacity testID="profile-logout" onPress={confirmLogout} style={[styles.actionRow, { marginTop: spacing.md }]}>
          <Ionicons name="log-out-outline" size={20} color={colors.primary} />
          <Text style={[styles.actionTitle, { color: colors.primary, marginLeft: spacing.md, flex: 1 }]}>Se déconnecter</Text>
        </TouchableOpacity>

        <View style={{ height: 200 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
  header: { alignItems: "center", paddingVertical: spacing.lg },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: spacing.md, backgroundColor: colors.surface },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  name: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 22 },
  email: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
  premiumBadge: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm, backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill },
  premiumText: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 11, marginLeft: 4 },
  sectionTitle: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 18, marginTop: spacing.lg, marginBottom: 4 },
  sectionHint: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.border, marginRight: 8, marginBottom: 8, flexDirection: "row", alignItems: "center" },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipArtist: { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
  chipText: { color: colors.textSecondary, fontFamily: fonts.bodyMed, fontSize: 13 },
  chipTextActive: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 13 },
  artistRow: { flexDirection: "row", marginTop: spacing.sm, alignItems: "center" },
  artistInput: { flex: 1, backgroundColor: colors.surface, borderRadius: radii.md, padding: 12, color: colors.textPrimary, fontFamily: fonts.body, borderWidth: 1, borderColor: colors.border },
  addBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginLeft: spacing.sm },
  empty: { color: colors.textTertiary, fontFamily: fonts.body, fontSize: 13 },
  actionRow: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, marginTop: spacing.sm, borderWidth: 1, borderColor: colors.border },
  actionTitle: { color: colors.textPrimary, fontFamily: fonts.bodyMed, fontSize: 15 },
  actionSubtitle: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: colors.surface, padding: 3, justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  toggleOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.textTertiary },
  toggleDotOn: { backgroundColor: "#fff", alignSelf: "flex-end" },
});
