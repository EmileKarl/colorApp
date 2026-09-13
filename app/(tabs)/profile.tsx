import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Card, SectionHeader } from "../../src/components/Card";
import { ErrorBanner } from "../../src/components/ErrorBanner";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { StateView } from "../../src/components/StateView";
import { useAuth } from "../../src/context/AuthContext";
import { spacing, type, useTheme } from "../../src/theme";

export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, isModerator, signOut, deleteAccount } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <Screen center>
        <StateView kind="signed_out" />
        <View style={styles.actions}>
          <PrimaryButton label="Se connecter" onPress={() => router.push("/auth/sign-in")} />
          <PrimaryButton
            label="Créer un compte"
            onPress={() => router.push("/auth/sign-up")}
            variant="secondary"
          />
        </View>
      </Screen>
    );
  }

  const onDeleteAccount = () => {
    Alert.alert(
      "Supprimer le compte",
      "Cette action est définitive : ton profil, tes couleurs, tes palettes et tes créations seront supprimés. Continuer ?",
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
    <Screen contentStyle={styles.content}>
      <Card>
        <Text style={[type.heading, { color: theme.text }]} numberOfLines={1}>
          {user.email}
        </Text>
        <Text style={[type.caption, { color: theme.subtext }]}>
          Compte créé le {new Date(user.created_at).toLocaleDateString()}
        </Text>
      </Card>

      {error ? <ErrorBanner message={error} /> : null}

      <View style={styles.section}>
        <SectionHeader
          title="Ma bibliothèque"
          subtitle="Tes couleurs et tes palettes enregistrées"
        />
        <PrimaryButton
          label="Mes créations"
          icon="cube-outline"
          onPress={() => router.push("/library/creations")}
          variant="secondary"
        />
        <PrimaryButton
          label="Mes couleurs"
          icon="color-palette-outline"
          onPress={() => router.push("/library/colors")}
          variant="secondary"
        />
        <PrimaryButton
          label="Mes palettes"
          icon="color-filter-outline"
          onPress={() => router.push("/library/palettes")}
          variant="secondary"
        />
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Rendu des objets"
          subtitle="À vérifier une fois sur ton téléphone avant de construire le Studio dessus"
        />
        <PrimaryButton
          label="Vérifier le rendu"
          icon="cube-outline"
          onPress={() => router.push("/objects-check")}
          variant="secondary"
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Compte" />
        {isModerator ? (
          <PrimaryButton
            label="File de modération"
            icon="shield-checkmark-outline"
            onPress={() => router.push("/moderation")}
            variant="secondary"
          />
        ) : null}
        <PrimaryButton
          label="Se déconnecter"
          icon="log-out-outline"
          onPress={signOut}
          variant="secondary"
        />
        <PrimaryButton
          label="Supprimer mon compte"
          onPress={onDeleteAccount}
          variant="danger"
          loading={busy}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  section: { gap: spacing.sm },
  actions: { width: "100%", maxWidth: 320, gap: spacing.sm, alignSelf: "center" },
});
