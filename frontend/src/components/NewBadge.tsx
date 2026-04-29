// NewBadge — Petite étiquette "NOUVEAU" (track sortie <7j ou épisode podcast récent)
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../theme";

export default function NewBadge({ small = false }: { small?: boolean }) {
  return (
    <View style={[styles.badge, small && styles.small]}>
      <Text style={[styles.text, small && { fontSize: 9 }]}>NOUVEAU</Text>
    </View>
  );
}

// Vérifie si une date ISO est dans les N derniers jours
export function isRecent(dateStr?: string, days = 7): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const diff = Date.now() - d.getTime();
  return diff >= 0 && diff < days * 24 * 3600 * 1000;
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  small: { paddingHorizontal: 5, paddingVertical: 1 },
  text: { color: "#050508", fontFamily: fonts.bodyBold, fontSize: 10, letterSpacing: 0.5 },
});
