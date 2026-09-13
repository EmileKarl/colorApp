import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { ErrorBanner } from "../../src/components/ErrorBanner";
import { Field } from "../../src/components/Field";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { useAuth } from "../../src/context/AuthContext";
import { spacing, type, useTheme } from "../../src/theme";

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
    <Screen contentStyle={styles.content}>
      <Field
        label="Courriel"
        placeholder="toi@exemple.com"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        returnKeyType="next"
      />
      <Field
        label="Mot de passe"
        placeholder="••••••••"
        secureTextEntry
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
        returnKeyType="go"
        onSubmitEditing={onSubmit}
      />
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton label="Se connecter" onPress={onSubmit} loading={busy} />
      <Pressable onPress={() => router.replace("/auth/sign-up")} accessibilityRole="link">
        <Text style={[type.caption, styles.link, { color: theme.subtext }]}>
          Pas encore de compte ? Crée-en un.
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingTop: spacing.lg },
  link: { textAlign: "center", textDecorationLine: "underline" },
});
