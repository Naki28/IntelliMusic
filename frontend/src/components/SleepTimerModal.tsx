// SleepTimerModal — Modale pour programmer une mise en pause automatique
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePlayer } from "../context/PlayerContext";
import { colors, fonts, radii, spacing } from "../theme";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const OPTIONS: Array<{ label: string; minutes: number | null }> = [
  { label: "Désactivé", minutes: null },
  { label: "5 minutes", minutes: 5 },
  { label: "10 minutes", minutes: 10 },
  { label: "15 minutes", minutes: 15 },
  { label: "30 minutes", minutes: 30 },
  { label: "45 minutes", minutes: 45 },
  { label: "1 heure", minutes: 60 },
  { label: "1h 30", minutes: 90 },
];

function fmtRemaining(endAt: number | null): string {
  if (!endAt) return "";
  const remMs = endAt - Date.now();
  if (remMs <= 0) return "";
  const min = Math.floor(remMs / 60000);
  const sec = Math.floor((remMs % 60000) / 1000);
  if (min > 0) return `${min}min ${sec.toString().padStart(2, "0")}s`;
  return `${sec}s`;
}

export default function SleepTimerModal({ visible, onClose }: Props) {
  const { sleepTimerEndAt, setSleepTimer } = usePlayer();
  const [, tick] = useState(0);

  // Re-render chaque seconde pour le countdown
  useEffect(() => {
    if (!sleepTimerEndAt) return;
    const i = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, [sleepTimerEndAt]);

  const select = (minutes: number | null) => {
    setSleepTimer(minutes);
    onClose();
  };

  const remaining = fmtRemaining(sleepTimerEndAt);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <View style={styles.sheet}>
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <SafeAreaView edges={["bottom"]} style={{ flex: 1 }}>
            <View style={styles.header}>
              <View style={styles.grabber} />
              <View style={styles.headerRow}>
                <View>
                  <Text style={styles.title}>Minuteur</Text>
                  {sleepTimerEndAt ? (
                    <Text style={styles.subtitle}>Mise en pause dans {remaining}</Text>
                  ) : (
                    <Text style={styles.subtitle}>Programmer une mise en pause</Text>
                  )}
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.options}>
              {OPTIONS.map((o) => {
                const active = (sleepTimerEndAt && o.minutes) || (!sleepTimerEndAt && o.minutes === null);
                // note: "active" sur une durée fixée n'est pas vraiment calculable → on marque Désactivé si aucun timer
                const isOff = o.minutes === null && !sleepTimerEndAt;
                return (
                  <TouchableOpacity
                    key={o.label}
                    testID={`sleep-opt-${o.minutes ?? "off"}`}
                    onPress={() => select(o.minutes)}
                    style={[styles.option, isOff && styles.optionActive]}
                  >
                    <Text style={[styles.optionLabel, isOff && styles.optionLabelActive]}>{o.label}</Text>
                    {isOff ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "rgba(18,18,22,0.92)",
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    overflow: "hidden",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  header: { paddingHorizontal: spacing.lg, paddingTop: 10, paddingBottom: spacing.sm },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.25)", alignSelf: "center", marginBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 20 },
  subtitle: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  options: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionActive: {},
  optionLabel: { color: colors.textPrimary, fontFamily: fonts.bodyMed, fontSize: 15 },
  optionLabelActive: { color: colors.primary },
});
