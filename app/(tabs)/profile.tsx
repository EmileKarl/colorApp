import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { ErrorBanner } from "../../src/components/ErrorBanner";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { useAuth } from "../../src/context/AuthContext";
import { spacing, useTheme } from "../../src/theme";

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, signOut, deleteAccount } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.text }]}>Tu n’es pas connecté(e)</Text>
        <PrimaryButton label="Se connecter" onPress={() => router.push("/auth/sign-in")} />
        <PrimaryButton
          label="Créer un compte"
          onPress={() => router.push("/auth/sign-up")}
          variant="secondary"
        />
      </View>
    );
  }

  const onDeleteAccount = () => {
    Alert.alert(
      "Supprimer le compte",
      "Cette action est définitive : ton profil, ta collection privée et tes votes seront supprimés. Continuer ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer définitivement",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            setError(null);
            try {
              await deleteAccount();
            } catch {
              setError("La suppression du compte a échoué. Réessaie plus tard.");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>{user.email}</Text>
        <Text style={[styles.subtitle, { color: theme.subtext }]}>
          Compte créé le {new Date(user.created_at).toLocaleDateString()}
        </Text>
        {error ? <ErrorBanner message={error} /> : null}
        <PrimaryButton label="Se déconnecter" onPress={signOut} variant="secondary" />
        <PrimaryButton
          label="Supprimer mon compte"
          onPress={onDeleteAccount}
          variant="danger"
          loading={busy}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 18, fontWeight: "700" },
  subtitle: { fontSize: 13 },
});
