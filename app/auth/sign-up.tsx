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
const MIN_PASSWORD = 8;

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

  // Inline validation, shown only once the user has typed something: flagging
  // an untouched field as invalid reads as an accusation rather than help.
  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD;
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const onSubmit = async () => {
    setError(null);
    if (!EMAIL_RE.test(email.trim())) {
      setError("Adresse courriel invalide.");
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Le mot de passe doit contenir au moins ${MIN_PASSWORD} caractères.`);
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
      <Screen center contentStyle={styles.content}>
        <Text style={[type.heading, styles.centerText, { color: theme.text }]}>
          Vérifie ta boîte courriel
        </Text>
        <Text style={[type.body, styles.centerText, { color: theme.subtext }]}>
          Un lien de confirmation vient de t’être envoyé pour activer ton compte.
        </Text>
        <PrimaryButton label="Retour" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.content}>
      <Text style={[type.caption, { color: theme.subtext }]}>
        En créant un compte, tu acceptes que ton nom d’utilisateur et les couleurs que tu
        proposes publiquement soient visibles par les autres. Tes créations restent privées
        par défaut.
      </Text>
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
        autoComplete="password-new"
        value={password}
        onChangeText={setPassword}
        invalid={passwordTooShort}
        hint={passwordTooShort ? `Au moins ${MIN_PASSWORD} caractères.` : undefined}
        returnKeyType="next"
      />
      <Field
        label="Confirmation"
        placeholder="••••••••"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        invalid={mismatch}
        hint={mismatch ? "Les deux mots de passe diffèrent." : undefined}
        returnKeyType="go"
        onSubmitEditing={onSubmit}
      />
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton label="Créer le compte" onPress={onSubmit} loading={busy} />
      <Pressable onPress={() => router.replace("/auth/sign-in")} accessibilityRole="link">
        <Text style={[type.caption, styles.link, { color: theme.subtext }]}>
          Déjà un compte ? Connecte-toi.
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingTop: spacing.lg },
  centerText: { textAlign: "center" },
  link: { textAlign: "center", textDecorationLine: "underline" },
});
