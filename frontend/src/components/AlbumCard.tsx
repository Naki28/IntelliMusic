// AlbumCard — Carte d'album/artiste
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { colors, fonts, radii, spacing } from "../theme";

interface Props {
  testID?: string;
  imageUri: string;
  title: string;
  subtitle?: string;
  size?: number;
  rounded?: boolean;
  onPress?: () => void;
}

export default function AlbumCard({
  testID,
  imageUri,
  title,
  subtitle,
  size = 150,
  rounded = false,
  onPress,
}: Props) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.8}
      style={[styles.card, { width: size }]}
    >
      <Image
        source={{ uri: imageUri }}
        style={[
          styles.cover,
          { width: size, height: size, borderRadius: rounded ? size / 2 : radii.md },
        ]}
      />
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginRight: spacing.md,
  },
  cover: {
    backgroundColor: colors.surface,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    marginTop: 8,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
});
