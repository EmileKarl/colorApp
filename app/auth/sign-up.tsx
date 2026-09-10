import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { ErrorBanner } from "../../src/components/ErrorBanner";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { useAuth } from "../../src/context/AuthContext";
import { spacing, useTheme } from "../../src/theme";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUpScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { signUpWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

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
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setBusy(true);
    try {
      await signUpWithEmail(email.trim(), password);
      setDone(true);
    } catch {
      setError("Impossible de créer le compte. Cette adresse est peut-être déjà utilisée.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.text }]}>Vérifie ta boîte courriel</Text>
        <Text style={[styles.subtitle, { color: theme.subtext }]}>
          Un lien de confirmation vient de t’être envoyé pour activer ton compte.
        </Text>
        <PrimaryButton label="Retour" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.subtitle, { color: theme.subtext }]}>
        En créant un compte, tu acceptes que ton nom d’utilisateur et les couleurs que tu
        proposes soient visibles publiquement dans la communauté.
      </Text>
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
        placeholder="Mot de passe (8 caractères min.)"
        placeholderTextColor={theme.subtext}
        secureTextEntry
        autoComplete="password-new"
        value={password}
        onChangeText={setPassword}
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
      />
      <TextInput
        placeholder="Confirmer le mot de passe"
        placeholderTextColor={theme.subtext}
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
      />
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton label="Créer le compte" onPress={onSubmit} loading={busy} />
      <Text
        style={[styles.link, { color: theme.subtext }]}
        onPress={() => router.replace("/auth/sign-in")}
      >
        Déjà un compte ? Connecte-toi.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, gap: spacing.md },
  center: { alignItems: "center", justifyContent: "center", gap: spacing.md },
  title: { fontSize: 18, fontWeight: "700" },
  subtitle: { fontSize: 13, textAlign: "center" },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 15,
  },
  link: { textAlign: "center", fontSize: 13, textDecorationLine: "underline" },
});
