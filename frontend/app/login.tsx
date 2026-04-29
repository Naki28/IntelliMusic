// LoginView — Écran de connexion (Google OAuth + démo)
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Platform, Alert, KeyboardAvoidingView, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../src/context/AuthContext";
import { colors, fonts, radii, spacing } from "../src/theme";

export default function LoginView() {
  const { loginDemo, loading } = useAuth();
  const [demoMode, setDemoMode] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const handleGoogle = () => {
    if (Platform.OS !== "web") {
      Alert.alert("Web uniquement", "La connexion Google fonctionne dans l'aperçu web. Utilise le compte démo sur mobile.");
      return;
    }
    const redirectUrl = window.location.origin + "/";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handleDemo = async () => {
    setError(null);
    try {
      await loginDemo(username.trim(), password);
    } catch (e: any) {
      setError("Identifiants invalides");
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={["#1A0506", "#050508", "#050508"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.brandWrap}>
              <View style={styles.logo}>
                <Ionicons name="musical-notes" size={32} color="#fff" />
              </View>
              <Text style={styles.brand}>IntelliMusic</Text>
              <Text style={styles.tag}>Ta musique. Ta radio. Ton univers.</Text>
            </View>

            <View style={styles.card}>
              {!demoMode ? (
                <>
                  <TouchableOpacity testID="login-google" onPress={handleGoogle} style={styles.googleBtn}>
                    <Ionicons name="logo-google" size={20} color="#050508" />
                    <Text style={styles.googleText}>Continuer avec Google</Text>
                  </TouchableOpacity>

                  <View style={styles.divider}>
                    <View style={styles.line} />
                    <Text style={styles.dividerText}>ou</Text>
                    <View style={styles.line} />
                  </View>

                  <TouchableOpacity testID="login-demo-toggle" onPress={() => setDemoMode(true)} style={styles.demoBtn}>
                    <Ionicons name="person-circle-outline" size={20} color={colors.textPrimary} />
                    <Text style={styles.demoText}>Compte démo</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.formTitle}>Connexion démo</Text>
                  <Text style={styles.formHint}>Utilise <Text style={{ color: colors.primary }}>naki28 / naki28</Text></Text>
                  <TextInput
                    testID="login-username"
                    placeholder="Nom d'utilisateur"
                    placeholderTextColor={colors.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={username}
                    onChangeText={setUsername}
                    style={styles.input}
                  />
                  <TextInput
                    testID="login-password"
                    placeholder="Mot de passe"
                    placeholderTextColor={colors.textTertiary}
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                    style={styles.input}
                  />
                  {error ? <Text style={styles.error}>{error}</Text> : null}
                  <TouchableOpacity testID="login-submit" onPress={handleDemo} style={styles.submitBtn} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Se connecter</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setDemoMode(false)} style={{ marginTop: spacing.md, alignItems: "center" }}>
                    <Text style={{ color: colors.textSecondary, fontFamily: fonts.body }}>← Retour</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
            <Text style={styles.footer}>En continuant, tu acceptes les conditions d&apos;utilisation.</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
  brandWrap: { alignItems: "center", marginBottom: spacing.xl },
  logo: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  brand: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 36, letterSpacing: -1.5 },
  tag: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 14, marginTop: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  googleBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#fff", paddingVertical: 14, borderRadius: radii.pill },
  googleText: { color: "#050508", fontFamily: fonts.bodyBold, fontSize: 15, marginLeft: 10 },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: spacing.md },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textTertiary, fontFamily: fonts.body, fontSize: 12, marginHorizontal: spacing.sm },
  demoBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, paddingVertical: 14, borderRadius: radii.pill },
  demoText: { color: colors.textPrimary, fontFamily: fonts.bodyMed, fontSize: 14, marginLeft: 8 },
  formTitle: { color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 22, marginBottom: 4 },
  formHint: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 13, marginBottom: spacing.md },
  input: { backgroundColor: colors.background, borderRadius: radii.md, padding: 14, color: colors.textPrimary, fontFamily: fonts.body, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  submitBtn: { backgroundColor: colors.primary, paddingVertical: 14, borderRadius: radii.pill, alignItems: "center", marginTop: spacing.sm },
  submitText: { color: "#fff", fontFamily: fonts.bodyBold, fontSize: 15 },
  error: { color: colors.primary, fontFamily: fonts.body, fontSize: 13, marginBottom: spacing.sm },
  footer: { color: colors.textTertiary, fontFamily: fonts.body, fontSize: 11, textAlign: "center", marginTop: spacing.xl },
});
