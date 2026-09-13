import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { Card, SectionHeader } from "../src/components/Card";
import { ErrorBanner } from "../src/components/ErrorBanner";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { Screen } from "../src/components/Screen";
import { useAuth } from "../src/context/AuthContext";
import { usePreferences } from "../src/context/PreferencesContext";
import { clearTemporaryImages } from "../src/lib/storageApi";
import { radius, spacing, type, useTheme } from "../src/theme";

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Settings — ColorLens page 24.
 *
 * Grouped as the spec groups them: account, application, privacy, storage.
 *
 * Two deliberate absences. There is no "langue" picker: the app exists only in
 * French today, and a selector with one entry is a control that does nothing.
 * There is no notifications toggle either: the app sends none, and a switch
 * that promises to silence something that never speaks is worse than its
 * absence. Both return when there is something behind them.
 */
export default function SettingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, signOut, deleteAccount } = useAuth();
  const preferences = usePreferences();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);

  const onClearCache = () => {
    try {
      const removed = clearTemporaryImages();
      // A real count, not an unverifiable "cache vidé".
      setCacheMessage(
        removed === 0
          ? "Aucun fichier temporaire à supprimer."
          : `${removed} fichier${removed > 1 ? "s" : ""} temporaire${removed > 1 ? "s" : ""} supprimé${removed > 1 ? "s" : ""}.`,
      );
    } catch {
      setError("Le vidage du cache a échoué.");
    }
  };

  const onDeleteAccount = () => {
    Alert.alert(
      "Supprimer le compte",
      "Cette action est définitive : ton profil, tes couleurs, tes palettes, tes collections et tes créations seront supprimés. Continuer ?",
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
              router.replace("/(tabs)");
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
      {error ? <ErrorBanner message={error} /> : null}

      <View style={styles.section}>
        <SectionHeader title="Compte" />
        {user ? (
          <>
            <Card>
              <Text style={[type.subheading, { color: theme.text }]} numberOfLines={1}>
                {user.email}
              </Text>
              <Text style={[type.caption, { color: theme.subtext }]}>
                Compte créé le {new Date(user.created_at).toLocaleDateString()}
              </Text>
            </Card>
            <PrimaryButton
              label="Se déconnecter"
              icon="log-out-outline"
              variant="secondary"
              onPress={signOut}
            />
          </>
        ) : (
          <>
            <PrimaryButton label="Se connecter" onPress={() => router.push("/auth/sign-in")} />
            <PrimaryButton
              label="Créer un compte"
              variant="secondary"
              onPress={() => router.push("/auth/sign-up")}
            />
          </>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Application" />
        <ToggleRow
          icon="color-palette-outline"
          label="Thème dynamique"
          hint="L’interface prend la couleur que tu viens de capturer."
          value={preferences.dynamicTheme}
          onChange={preferences.setDynamicTheme}
        />
        <ToggleRow
          icon="sparkles-outline"
          label="Animations"
          hint="Désactive les transitions si tu préfères une interface immobile."
          value={preferences.animations}
          onChange={preferences.setAnimations}
        />
        <ToggleRow
          icon="speedometer-outline"
          label="Rendu haute qualité"
          hint="Rendu plus fin des objets. À désactiver si l’aperçu saccade."
          value={preferences.highQualityRender}
          onChange={preferences.setHighQualityRender}
        />
        <Text style={[type.caption, { color: theme.subtext }]}>
          Le mode clair ou sombre suit le réglage de ton téléphone.
        </Text>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Confidentialité" />
        <PrimaryButton
          label="Autorisations caméra et photos"
          icon="lock-open-outline"
          variant="secondary"
          onPress={() => Linking.openSettings()}
        />
        <ToggleRow
          icon="cloud-offline-outline"
          label="Traitement local uniquement"
          hint="Les images ne quittent jamais l’appareil. Les créations restent alors non synchronisées."
          value={preferences.localOnly}
          onChange={preferences.setLocalOnly}
        />
        <ToggleRow
          icon="chatbubble-ellipses-outline"
          label="Suggestions génératives"
          hint="Désactivé : aucun texte n’est envoyé à un service externe. Les descriptions actuelles sont calculées sur l’appareil."
          value={preferences.aiConsent}
          onChange={preferences.setAiConsent}
          disabled
        />
        <Text style={[type.caption, { color: theme.subtext }]}>
          Tes créations sont privées par défaut. Rien n’est publié sans que tu l’actives
          explicitement.
        </Text>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Stockage" />
        <PrimaryButton
          label="Vider le cache d’images"
          icon="trash-bin-outline"
          variant="secondary"
          onPress={onClearCache}
        />
        {cacheMessage ? (
          <Text style={[type.caption, { color: theme.subtext }]}>{cacheMessage}</Text>
        ) : null}
        <PrimaryButton
          label="Vérifier l’accès à la galerie"
          icon="images-outline"
          variant="secondary"
          onPress={async () => {
            const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
            setCacheMessage(
              status === "granted"
                ? "Accès à la galerie autorisé."
                : "Accès à la galerie refusé — tu peux le changer dans les réglages du téléphone.",
            );
          }}
        />
      </View>

      {user ? (
        <View style={styles.section}>
          <SectionHeader title="Zone sensible" />
          <PrimaryButton
            label="Supprimer mon compte"
            icon="trash-outline"
            variant="danger"
            loading={busy}
            onPress={onDeleteAccount}
          />
          <Text style={[type.caption, { color: theme.subtext }]}>
            Suppression définitive et immédiate, conformément au droit à l’effacement.
          </Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader title="À propos" />
        <Text style={[type.caption, { color: theme.subtext }]}>
          ColorLens — « Capture une couleur. Crée ton univers. »{"\n"}
          La couleur affichée est une estimation issue de la caméra du téléphone, pas une
          mesure colorimétrique professionnelle. Incertitude annoncée minimale : 3 ΔE00.
        </Text>
      </View>
    </Screen>
  );
}

function ToggleRow({
  icon,
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  icon: IconName;
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => !disabled && onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      style={[
        styles.row,
        { borderColor: theme.border, backgroundColor: theme.surface, opacity: disabled ? 0.6 : 1 },
      ]}
    >
      <Ionicons name={icon} size={18} color={theme.subtext} />
      <View style={styles.rowText}>
        <Text style={[type.subheading, { color: theme.text }]}>{label}</Text>
        <Text style={[type.caption, { color: theme.subtext }]}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  section: { gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, gap: 2 },
});
