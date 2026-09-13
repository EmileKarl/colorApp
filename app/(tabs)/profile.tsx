import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card, SectionHeader } from "../../src/components/Card";
import { ErrorBanner } from "../../src/components/ErrorBanner";
import { Field } from "../../src/components/Field";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { Sheet } from "../../src/components/Sheet";
import { StateView } from "../../src/components/StateView";
import { useAuth } from "../../src/context/AuthContext";
import { FAMILY_LABEL_FR } from "../../src/lib/color";
import { getProfile, getProfileStats, updateProfile } from "../../src/lib/profileApi";
import { radius, spacing, type, useTheme } from "../../src/theme";
import type { ProfileRow, ProfileStatsRow } from "../../src/types/database";

type IconName = keyof typeof Ionicons.glyphMap;

/** Profile — ColorLens page 23. */
export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, isModerator } = useAuth();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [stats, setStats] = useState<ProfileStatsRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [bioDraft, setBioDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [loadedProfile, loadedStats] = await Promise.all([
        getProfile(user.id),
        getProfileStats(user.id).catch(() => null),
      ]);
      setProfile(loadedProfile);
      setStats(loadedStats);
    } catch {
      setError("Impossible de charger ton profil.");
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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
          <PrimaryButton
            label="Paramètres"
            icon="settings-outline"
            variant="ghost"
            onPress={() => router.push("/settings")}
          />
        </View>
      </Screen>
    );
  }

  const onSaveProfile = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateProfile(user.id, { username: usernameDraft, bio: bioDraft || null });
      setProfile((current) =>
        current ? { ...current, username: usernameDraft.trim(), bio: bioDraft || null } : current,
      );
      setEditing(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La mise à jour a échoué.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen onRefresh={load} contentStyle={styles.content}>
      <Card>
        <View style={styles.identity}>
          <View style={[styles.avatar, { backgroundColor: theme.surfaceAlt }]}>
            <Text style={[type.title, { color: theme.subtext }]}>
              {(profile?.username ?? user.email ?? "?").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.identityText}>
            <Text style={[type.heading, { color: theme.text }]} numberOfLines={1}>
              {profile?.username ?? "…"}
            </Text>
            <Text style={[type.caption, { color: theme.subtext }]} numberOfLines={1}>
              {user.email}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              setUsernameDraft(profile?.username ?? "");
              setBioDraft(profile?.bio ?? "");
              setEditing(true);
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Modifier le profil"
          >
            <Ionicons name="create-outline" size={20} color={theme.subtext} />
          </Pressable>
        </View>
        {profile?.bio ? (
          <Text style={[type.body, styles.bio, { color: theme.subtext }]}>{profile.bio}</Text>
        ) : null}
      </Card>

      {error ? <ErrorBanner message={error} /> : null}

      <View style={styles.section}>
        <SectionHeader
          title="Statistiques"
          subtitle="Comptées en direct depuis tes données, jamais estimées"
        />
        {stats ? (
          <View style={styles.statGrid}>
            <Stat icon="eyedrop-outline" label="Couleurs capturées" value={stats.colors_captured} />
            <Stat
              icon="color-filter-outline"
              label="Palettes créées"
              value={stats.palettes_created}
            />
            <Stat icon="cube-outline" label="Objets personnalisés" value={stats.creations_made} />
            <Stat icon="globe-outline" label="Créations partagées" value={stats.creations_shared} />
            <Stat icon="git-branch-outline" label="Remixes" value={stats.remixes_made} />
            <Stat icon="albums-outline" label="Collections" value={stats.collections_count} />
          </View>
        ) : (
          // Not zeroes: showing "0 couleurs capturées" when the query failed
          // would be reporting a number the app does not have.
          <Text style={[type.caption, { color: theme.subtext }]}>
            Statistiques indisponibles hors ligne.
          </Text>
        )}
        {stats?.most_used_family ? (
          <Text style={[type.caption, { color: theme.subtext }]}>
            Famille la plus capturée : {FAMILY_LABEL_FR[stats.most_used_family]}
          </Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Ma bibliothèque" />
        <PrimaryButton
          label="Mes créations"
          icon="cube-outline"
          onPress={() => router.push("/library/creations")}
          variant="secondary"
        />
        <PrimaryButton
          label="Mes collections"
          icon="albums-outline"
          onPress={() => router.push("/library/collections")}
          variant="secondary"
        />
        <PrimaryButton
          label="Mes palettes"
          icon="color-filter-outline"
          onPress={() => router.push("/library/palettes")}
          variant="secondary"
        />
        <PrimaryButton
          label="Mes couleurs"
          icon="color-palette-outline"
          onPress={() => router.push("/library/colors")}
          variant="secondary"
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Outils" />
        <PrimaryButton
          label="Color Lab"
          icon="flask-outline"
          onPress={() => router.push("/lab")}
          variant="secondary"
        />
        <PrimaryButton
          label="Vérifier le rendu des objets"
          icon="eye-outline"
          onPress={() => router.push("/objects-check")}
          variant="secondary"
        />
        {isModerator ? (
          <PrimaryButton
            label="File de modération"
            icon="shield-checkmark-outline"
            onPress={() => router.push("/moderation")}
            variant="secondary"
          />
        ) : null}
        <PrimaryButton
          label="Paramètres"
          icon="settings-outline"
          onPress={() => router.push("/settings")}
          variant="secondary"
        />
      </View>

      <Sheet
        visible={editing}
        onClose={() => setEditing(false)}
        title="Modifier le profil"
        footer={<PrimaryButton label="Enregistrer" onPress={onSaveProfile} loading={busy} />}
      >
        <Field
          label="Nom d’utilisateur"
          value={usernameDraft}
          onChangeText={setUsernameDraft}
          autoCapitalize="none"
          hint="Entre 3 et 24 caractères. Visible publiquement."
        />
        <Field
          label="Bio"
          value={bioDraft}
          onChangeText={setBioDraft}
          multiline
          numberOfLines={3}
          style={styles.multiline}
          hint="Optionnelle, 300 caractères maximum."
        />
      </Sheet>
    </Screen>
  );
}

function Stat({ icon, label, value }: { icon: IconName; label: string; value: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Ionicons name={icon} size={18} color={theme.subtext} />
      <Text style={[type.title, { color: theme.text }]}>{value}</Text>
      <Text style={[type.caption, styles.statLabel, { color: theme.subtext }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  section: { gap: spacing.sm },
  actions: { width: "100%", maxWidth: 320, gap: spacing.sm, alignSelf: "center" },
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  identityText: { flex: 1, gap: 2 },
  bio: { marginTop: spacing.sm },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  stat: {
    flexGrow: 1,
    flexBasis: "30%",
    alignItems: "center",
    gap: 2,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statLabel: { textAlign: "center" },
  multiline: { minHeight: 88, textAlignVertical: "top" },
});
