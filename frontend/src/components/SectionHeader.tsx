// SectionHeader — En-tête de section avec titre + sous-titre
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, fonts, spacing } from "../theme";

interface Props {
  overline?: string;
  title: string;
}

export default function SectionHeader({ overline, title }: Props) {
  return (
    <View style={styles.wrap}>
      {overline ? <Text style={styles.overline}>{overline}</Text> : null}
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  overline: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fonts.heading,
    fontSize: 22,
    letterSpacing: -0.5,
  },
});
