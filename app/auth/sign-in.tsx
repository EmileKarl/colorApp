import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { ErrorBanner } from "../../src/components/ErrorBanner";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { useAuth } from "../../src/context/AuthContext";
import { spacing, useTheme } from "../../src/theme";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!EMAIL_RE.test(email.trim())) {
      setError("Adresse courriel invalide.");
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setBusy(true);
    try {
      await signInWithEmail(email.trim(), password);
      router.back();
    } catch {
      setError("Connexion impossible. Vérifie ton courriel et ton mot de passe.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <TextInput
        placeholder="Courriel"
        placeholderTextColor={theme.subtext}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
      />
      <TextInput
        placeholder="Mot de passe"
        placeholderTextColor={theme.subtext}
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
      />
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton label="Se connecter" onPress={onSubmit} loading={busy} />
      <Text style={[styles.link, { color: theme.subtext }]} onPress={() => router.replace("/auth/sign-up")}>
        Pas encore de compte ? Crée-en un.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, gap: spacing.md },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 15,
  },
  link: { textAlign: "center", fontSize: 13, textDecorationLine: "underline" },
});
