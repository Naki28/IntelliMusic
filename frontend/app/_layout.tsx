// Root Layout — Fonts + Providers + Auth Gate + Modals
import React, { useEffect } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { Stack, useRouter, useSegments, useRootNavigationState } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts as useOutfit, Outfit_600SemiBold, Outfit_700Bold } from "@expo-google-fonts/outfit";
import { Manrope_400Regular, Manrope_500Medium, Manrope_700Bold } from "@expo-google-fonts/manrope";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { PlayerProvider } from "../src/context/PlayerContext";
import { FavoritesProvider } from "../src/context/FavoritesContext";
import { PlaylistsProvider } from "../src/context/PlaylistsContext";
import { LibraryProvider } from "../src/context/LibraryContext";
import { colors } from "../src/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
function AuthCallbackHandler() {
  const { exchangeSession, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== "web" || !ready) return;
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (hash && hash.includes("session_id=")) {
      const m = hash.match(/session_id=([^&]+)/);
      if (m && m[1]) {
        exchangeSession(m[1])
          .then(() => {
            window.history.replaceState(null, "", window.location.pathname);
            router.replace("/(tabs)");
          })
          .catch((e) => console.warn("Auth exchange error:", e));
      }
    }
  }, [ready, exchangeSession, router]);
  return null;
}

function AuthGate() {
  const { user, ready } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navState = useRootNavigationState();

  useEffect(() => {
    if (!ready || !navState?.key) return;
    const inAuthGroup = segments[0] === "login";
    if (!user && !inAuthGroup) {
      router.replace("/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user, ready, segments, navState?.key, router]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useOutfit({
    Outfit_600SemiBold, Outfit_700Bold,
    Manrope_400Regular, Manrope_500Medium, Manrope_700Bold,
  });
  useEffect(() => { if (fontsLoaded) SplashScreen.hideAsync().catch(() => {}); }, [fontsLoaded]);
  if (!fontsLoaded) return <View style={styles.splash} />;

  return (
    <AuthProvider>
      <FavoritesProvider>
        <LibraryProvider>
          <PlaylistsProvider>
            <PlayerProvider>
              <StatusBar style="light" />
              <AuthCallbackHandler />
              <AuthGate />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
                <Stack.Screen name="login" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="player" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
              </Stack>
            </PlayerProvider>
          </PlaylistsProvider>
        </LibraryProvider>
      </FavoritesProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({ splash: { flex: 1, backgroundColor: colors.background } });
