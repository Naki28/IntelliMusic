// QueueModal — Modale bottom-sheet affichant la file d'attente (tracks + podcasts mixés)
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, Image } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePlayer } from "../context/PlayerContext";
import { colors, fonts, radii, spacing } from "../theme";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function QueueModal({ visible, onClose }: Props) {
  const { queue, index, jumpTo, removeFromQueue, clearQueue } = usePlayer();

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
                <Text style={styles.title}>File d&apos;attente</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              {queue.length > 1 ? (
                <TouchableOpacity testID="queue-clear" onPress={clearQueue} style={styles.clearBtn}>
                  <Ionicons name="trash-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.clearText}>Vider la file</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {queue.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="list-outline" size={48} color={colors.textTertiary} />
                <Text style={styles.emptyText}>La file est vide</Text>
              </View>
            ) : (
              <FlatList
                data={queue}
                keyExtractor={(it) => it.uid}
                contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl }}
                renderItem={({ item, index: i }) => {
                  const isCurrent = i === index;
                  const isUpcoming = i > index;
                  const isTrack = item.kind === "track" && item.track;
                  const title = isTrack ? item.track!.title : item.stream?.name || "";
                  const subtitle = isTrack ? item.track!.artist?.name : item.stream?.subtitle || "Podcast";
                  const cover = isTrack
                    ? (item.track!.album.cover_medium || item.track!.album.cover)
                    : item.stream?.artwork;
                  return (
                    <View style={[styles.row, isCurrent && styles.rowCurrent]}>
                      <TouchableOpacity
                        testID={`queue-item-${i}`}
                        onPress={() => { jumpTo(i); onClose(); }}
                        activeOpacity={0.7}
                        style={styles.rowTouchArea}
                      >
                        {cover ? (
                          <Image source={{ uri: cover }} style={styles.cover} />
                        ) : (
                          <View style={[styles.cover, styles.coverFallback]}>
                            <Ionicons name={item.kind === "podcast" ? "mic" : "musical-note"} size={20} color={colors.textSecondary} />
                          </View>
                        )}
                        <View style={styles.meta}>
                          <View style={styles.metaRow}>
                            {isCurrent ? <Ionicons name="volume-high" size={12} color={colors.primary} style={{ marginRight: 6 }} /> : null}
                            {item.kind === "podcast" ? <Ionicons name="mic" size={11} color={colors.accent} style={{ marginRight: 5 }} /> : null}
                            <Text style={[styles.trackTitle, isCurrent && { color: colors.primary }]} numberOfLines={1}>{title}</Text>
                          </View>
                          <Text style={styles.trackSub} numberOfLines={1}>{subtitle}</Text>
                        </View>
                      </TouchableOpacity>
                      {isUpcoming ? (
                        <TouchableOpacity
                          testID={`queue-remove-${i}`}
                          onPress={() => removeFromQueue(i)}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          style={styles.removeBtn}
                        >
                          <Ionicons name="close-circle-outline" size={22} color={colors.textTertiary} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                }}
              />
            )}
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    height: "75%",
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
  clearBtn: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  clearText: { color: colors.textSecondary, fontFamily: fonts.bodyMed, fontSize: 12, marginLeft: 4 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingBottom: spacing.xl },
  emptyText: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 14, marginTop: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowCurrent: { backgroundColor: "rgba(229,56,59,0.08)", borderRadius: radii.sm, paddingHorizontal: 8 },
  rowTouchArea: { flex: 1, flexDirection: "row", alignItems: "center" },
  cover: { width: 44, height: 44, borderRadius: radii.sm, backgroundColor: colors.surface },
  coverFallback: { alignItems: "center", justifyContent: "center" },
  meta: { flex: 1, marginLeft: 12 },
  metaRow: { flexDirection: "row", alignItems: "center" },
  trackTitle: { color: colors.textPrimary, fontFamily: fonts.bodyMed, fontSize: 14, flexShrink: 1 },
  trackSub: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  removeBtn: { paddingLeft: spacing.sm },
});
