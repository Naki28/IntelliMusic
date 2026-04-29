// Tabs Layout — 5 onglets (Profil retiré, accessible via bouton avatar dans Home)
// Style "liquid glass" flottant
import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { View, StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { colors, fonts } from "../../src/theme";
import MiniPlayer from "../../src/components/MiniPlayer";

export default function TabsLayout() {
  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: styles.tabBar,
          tabBarBackground: () => (
            <BlurView intensity={90} tint="dark" style={[StyleSheet.absoluteFill, { borderRadius: 28 }]} />
          ),
          tabBarLabelStyle: { fontFamily: fonts.bodyMed, fontSize: 10 },
          tabBarItemStyle: { paddingTop: 6 },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Accueil", tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />, tabBarButtonTestID: "tab-home" }} />
        <Tabs.Screen name="search" options={{ title: "Rechercher", tabBarIcon: ({ color, size }) => <Ionicons name="search" color={color} size={size} />, tabBarButtonTestID: "tab-search" }} />
        <Tabs.Screen name="intelliradio" options={{ title: "IntelliRadio", tabBarIcon: ({ color, size }) => <Ionicons name="radio" color={color} size={size} />, tabBarButtonTestID: "tab-radio" }} />
        <Tabs.Screen name="podcasts" options={{ title: "Podcasts", tabBarIcon: ({ color, size }) => <Ionicons name="mic" color={color} size={size} />, tabBarButtonTestID: "tab-podcasts" }} />
        <Tabs.Screen name="library" options={{ title: "Bibliothèque", tabBarIcon: ({ color, size }) => <Ionicons name="library" color={color} size={size} />, tabBarButtonTestID: "tab-library" }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
        {/* Pages détail dans le groupe (tabs) → la tabbar et le MiniPlayer restent visibles */}
        <Tabs.Screen name="album/[id]" options={{ href: null }} />
        <Tabs.Screen name="artist/[id]" options={{ href: null }} />
        <Tabs.Screen name="podcast/[id]" options={{ href: null }} />
        <Tabs.Screen name="playlist/[id]" options={{ href: null }} />
      </Tabs>
      <MiniPlayer />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabBar: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 24 : 16,
    left: 16,
    right: 16,
    backgroundColor: "rgba(18,18,22,0.5)",
    borderRadius: 28,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    height: 64,
    overflow: "hidden",
  },
});
