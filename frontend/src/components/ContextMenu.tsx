// ContextMenu — Menu contextuel Liquid Glass (appui long)
// Supporte : Track, Podcast, Album, Artist avec options contextuelles
import React, { useCallback, useState, useEffect } from "react";
import {
  View, Text, Modal, TouchableOpacity, StyleSheet, Image, ScrollView,
  Pressable, Dimensions, Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors, fonts, spacing, radii } from "../theme";
import type { Track, Album, Artist } from "../types/music";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Types d'items supportés
export type ContextItemType = "track" | "podcast" | "album" | "artist";

export interface ContextMenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

interface PodcastEpisode {
  id: string;
  title: string;
  audio_url?: string;
  duration?: number;
  pub_date?: string;
  description?: string;
}

interface PodcastMeta {
  id: number;
  name: string;
  artist?: string;
  artwork?: string;
}

interface ContextMenuProps {
  visible: boolean;
  onClose: () => void;
  type: ContextItemType;
  // Data (selon le type)
  track?: Track;
  podcast?: { meta: PodcastMeta; episode?: PodcastEpisode };
  album?: Album;
  artist?: Artist;
  // Actions handlers
  onAddToQueue?: () => void;
  onPlayNext?: () => void;
  onAddToPlaylist?: () => void;
  onStartRadio?: () => void; // Mix inspiré par ce titre
  onShare?: () => void;
  onDontRecommend?: () => void;
  onGoToAlbum?: () => void;
  onGoToArtist?: () => void;
  onAddToLibrary?: () => void;
  onRemoveFromLibrary?: () => void;
  onMarkAsPlayed?: () => void;
  onToggleFavorite?: () => void;
  isFavorite?: boolean;
  isInLibrary?: boolean;
  isPlaying?: boolean; // Si un contenu est en cours de lecture
}

export default function ContextMenu({
  visible,
  onClose,
  type,
  track,
  podcast,
  album,
  artist,
  onAddToQueue,
  onPlayNext,
  onAddToPlaylist,
  onStartRadio,
  onShare,
  onDontRecommend,
  onGoToAlbum,
  onGoToArtist,
  onAddToLibrary,
  onRemoveFromLibrary,
  onMarkAsPlayed,
  onToggleFavorite,
  isFavorite,
  isInLibrary,
  isPlaying = false,
}: ContextMenuProps) {
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (visible) {
      setAnimating(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
  }, [visible]);

  const handleAction = useCallback((action?: () => void) => {
    if (action) {
      Haptics.selectionAsync().catch(() => {});
      action();
    }
    onClose();
  }, [onClose]);

  // Génération des options selon le type
  const getMenuItems = (): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [];

    switch (type) {
      case "track":
        if (track) {
          // Favoris
          items.push({
            icon: isFavorite ? "heart" : "heart-outline",
            label: isFavorite ? "Retirer des favoris" : "Ajouter aux favoris",
            onPress: () => handleAction(onToggleFavorite),
          });
          // File d'attente (si lecture en cours)
          if (isPlaying && onAddToQueue) {
            items.push({
              icon: "list",
              label: "Ajouter à la file d'attente",
              onPress: () => handleAction(onAddToQueue),
            });
            if (onPlayNext) {
              items.push({
                icon: "play-skip-forward",
                label: "Lire ensuite",
                onPress: () => handleAction(onPlayNext),
              });
            }
          }
          // Mix inspiré
          if (onStartRadio) {
            items.push({
              icon: "radio",
              label: "Mix inspiré par ce titre",
              onPress: () => handleAction(onStartRadio),
            });
          }
          // Playlist
          if (onAddToPlaylist) {
            items.push({
              icon: "add-circle-outline",
              label: "Ajouter à une playlist",
              onPress: () => handleAction(onAddToPlaylist),
            });
          }
          // Navigation
          if (onGoToAlbum && track.album?.id) {
            items.push({
              icon: "disc",
              label: "Voir l'album",
              onPress: () => handleAction(onGoToAlbum),
            });
          }
          if (onGoToArtist && track.artist?.id) {
            items.push({
              icon: "person",
              label: "Voir l'artiste",
              onPress: () => handleAction(onGoToArtist),
            });
          }
          // Partage
          if (onShare) {
            items.push({
              icon: "share-outline",
              label: "Partager",
              onPress: () => handleAction(onShare),
            });
          }
          // Ne pas recommander
          if (onDontRecommend) {
            items.push({
              icon: "eye-off-outline",
              label: "Ne pas me recommander",
              destructive: true,
              onPress: () => handleAction(onDontRecommend),
            });
          }
        }
        break;

      case "podcast":
        if (podcast?.episode) {
          // Marquer comme lu
          if (onMarkAsPlayed) {
            items.push({
              icon: "checkmark-circle-outline",
              label: "Marquer comme écouté",
              onPress: () => handleAction(onMarkAsPlayed),
            });
          }
          // File d'attente
          if (isPlaying && onAddToQueue) {
            items.push({
              icon: "list",
              label: "Ajouter à la file d'attente",
              onPress: () => handleAction(onAddToQueue),
            });
          }
          // Playlist
          if (onAddToPlaylist) {
            items.push({
              icon: "add-circle-outline",
              label: "Ajouter à une playlist",
              onPress: () => handleAction(onAddToPlaylist),
            });
          }
          // Partage
          if (onShare) {
            items.push({
              icon: "share-outline",
              label: "Partager",
              onPress: () => handleAction(onShare),
            });
          }
        }
        break;

      case "album":
        if (album) {
          // Bibliothèque
          items.push({
            icon: isInLibrary ? "bookmark" : "bookmark-outline",
            label: isInLibrary ? "Retirer de ma bibliothèque" : "Ajouter à ma bibliothèque",
            onPress: () => handleAction(isInLibrary ? onRemoveFromLibrary : onAddToLibrary),
          });
          // File d'attente
          if (isPlaying && onAddToQueue) {
            items.push({
              icon: "list",
              label: "Ajouter à la file d'attente",
              onPress: () => handleAction(onAddToQueue),
            });
          }
          // Artiste
          if (onGoToArtist && album.artist?.id) {
            items.push({
              icon: "person",
              label: "Voir l'artiste",
              onPress: () => handleAction(onGoToArtist),
            });
          }
          // Partage
          if (onShare) {
            items.push({
              icon: "share-outline",
              label: "Partager",
              onPress: () => handleAction(onShare),
            });
          }
        }
        break;

      case "artist":
        if (artist) {
          // Bibliothèque (follow)
          items.push({
            icon: isInLibrary ? "person-remove" : "person-add",
            label: isInLibrary ? "Ne plus suivre" : "Suivre",
            onPress: () => handleAction(isInLibrary ? onRemoveFromLibrary : onAddToLibrary),
          });
          // Partage
          if (onShare) {
            items.push({
              icon: "share-outline",
              label: "Partager",
              onPress: () => handleAction(onShare),
            });
          }
          // Ne pas recommander
          if (onDontRecommend) {
            items.push({
              icon: "eye-off-outline",
              label: "Ne pas me recommander",
              destructive: true,
              onPress: () => handleAction(onDontRecommend),
            });
          }
        }
        break;
    }

    return items;
  };

  // Header du menu (image + titre)
  const renderHeader = () => {
    let imageUri = "";
    let title = "";
    let subtitle = "";

    switch (type) {
      case "track":
        imageUri = track?.album?.cover_medium || track?.album?.cover || "";
        title = track?.title || "";
        subtitle = track?.artist?.name || "";
        break;
      case "podcast":
        imageUri = podcast?.meta?.artwork || "";
        title = podcast?.episode?.title || podcast?.meta?.name || "";
        subtitle = podcast?.meta?.artist || "";
        break;
      case "album":
        imageUri = album?.cover_medium || album?.cover || "";
        title = album?.title || "";
        subtitle = album?.artist?.name || "";
        break;
      case "artist":
        imageUri = artist?.picture_medium || artist?.picture || "";
        title = artist?.name || "";
        subtitle = "Artiste";
        break;
    }

    return (
      <View style={styles.header}>
        <Image source={{ uri: imageUri }} style={[styles.headerImage, type === "artist" && styles.headerImageRound]} />
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={2}>{title}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{subtitle}</Text>
        </View>
      </View>
    );
  };

  const menuItems = getMenuItems();

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.menuContainer} onPress={(e) => e.stopPropagation()}>
          {/* Liquid Glass effect */}
          <BlurView intensity={80} tint="dark" style={styles.blurContainer}>
            <View style={styles.glassOverlay}>
              {/* Header */}
              {renderHeader()}
              
              {/* Divider */}
              <View style={styles.divider} />
              
              {/* Menu Items */}
              <ScrollView style={styles.itemsContainer} showsVerticalScrollIndicator={false}>
                {menuItems.map((item, index) => (
                  <TouchableOpacity
                    key={`${item.label}-${index}`}
                    style={styles.menuItem}
                    activeOpacity={0.7}
                    onPress={item.onPress}
                  >
                    <Ionicons
                      name={item.icon}
                      size={22}
                      color={item.destructive ? "#FF453A" : colors.textPrimary}
                    />
                    <Text style={[styles.menuItemLabel, item.destructive && styles.destructiveLabel]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              
              {/* Cancel button */}
              <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.8}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  menuContainer: {
    marginHorizontal: spacing.md,
    marginBottom: Platform.OS === "ios" ? 40 : 24,
    borderRadius: radii.xl,
    overflow: "hidden",
  },
  blurContainer: {
    borderRadius: radii.xl,
    overflow: "hidden",
  },
  glassOverlay: {
    backgroundColor: "rgba(30,30,40,0.75)",
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    // Liquid glass effect
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerImage: {
    width: 56,
    height: 56,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
  },
  headerImageRound: {
    borderRadius: 28,
  },
  headerText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    lineHeight: 20,
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginHorizontal: spacing.lg,
  },
  itemsContainer: {
    maxHeight: SCREEN_HEIGHT * 0.45,
    paddingVertical: spacing.sm,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  menuItemLabel: {
    color: colors.textPrimary,
    fontFamily: fonts.bodyMed,
    fontSize: 15,
    marginLeft: spacing.md,
    flex: 1,
  },
  destructiveLabel: {
    color: "#FF453A",
  },
  cancelButton: {
    backgroundColor: "rgba(255,255,255,0.06)",
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    alignItems: "center",
  },
  cancelText: {
    color: colors.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
});
