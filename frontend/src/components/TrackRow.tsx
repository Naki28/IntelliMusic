// TrackRow — Ligne de titre dans une liste, avec badge "NOUVEAU" auto si <7 jours
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Track } from "../types/music";
import { colors, fonts, radii, spacing } from "../theme";
import { useFavorites } from "../context/FavoritesContext";
import NewBadge, { isRecent } from "./NewBadge";

interface Props {
  track: Track;
  index?: number;
  onPress: () => void;
  // override (optionnel) — sinon détection auto via track.album.release_date
  showNewBadge?: boolean;
  newBadgeDays?: number;
}

export default function TrackRow({ track, index, onPress, showNewBadge, newBadgeDays = 7 }: Props) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const fav = isFavorite(track.id);

  // Auto-détection si non spécifié
  const releaseDate = (track as any)?.release_date || track.album?.release_date;
  const isNew = showNewBadge ?? isRecent(releaseDate, newBadgeDays);

  return (
    <TouchableOpacity
      testID={`track-row-${track.id}`}
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.row}
    >
      {typeof index === "number" ? (
        <Text style={styles.index}>{index + 1}</Text>
      ) : null}
      <Image
        source={{ uri: track.album.cover_medium || track.album.cover }}
        style={styles.cover}
      />
      <View style={styles.meta}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {track.title}
          </Text>
          {isNew ? (
            <View style={styles.badgeWrap}>
              <NewBadge small />
            </View>
          ) : null}
        </View>
        <Text style={styles.artist} numberOfLines={1}>
          {track.artist.name}
        </Text>
      </View>
      <TouchableOpacity
        testID={`track-fav-${track.id}`}
        onPress={() => toggleFavorite(track)}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons
          name={fav ? "heart" : "heart-outline"}
          size={22}
          color={fav ? colors.primary : colors.textSecondary}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  index: {
    width: 22,
    color: colors.textTertiary,
    fontFamily: fonts.bodyMed,
    textAlign: "center",
  },
  cover: {
    width: 52,
    height: 52,
    borderRadius: radii.sm,
    marginLeft: spacing.sm,
    backgroundColor: colors.surface,
  },
  meta: {
    flex: 1,
    marginLeft: spacing.md,
  },
  titleRow: { flexDirection: "row", alignItems: "center" },
  badgeWrap: { marginLeft: 6 },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.bodyMed,
    fontSize: 15,
    flexShrink: 1,
  },
  artist: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 2,
  },
});
