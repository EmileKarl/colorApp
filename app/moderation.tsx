import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { EmptyState } from "../src/components/EmptyState";
import { ErrorBanner } from "../src/components/ErrorBanner";
import { useAuth } from "../src/context/AuthContext";
import { FAMILY_LABEL_FR } from "../src/lib/color";
import { fetchPendingColorNames, moderateColorName, type PendingColorName } from "../src/lib/moderationApi";
import { spacing, useTheme } from "../src/theme";

export default function ModerationScreen() {
  const theme = useTheme();
  const { user, isModerator } = useAuth();
  const [items, setItems] = useState<PendingColorName[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await fetchPendingColorNames());
    } catch {
      setError("Impossible de charger la file de modération.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setState only runs after load()'s internal await
    load();
  }, [load]);

  const decide = async (item: PendingColorName, approve: boolean) => {
    if (!user) return;
    setBusyId(item.id);
    setError(null);
    try {
      await moderateColorName({
        id: item.id,
        approve,
        moderatorId: user.id,
        reason: approve ? undefined : "Rejeté par la modération",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch {
      setError("L'action a échoué. Réessaie.");
    } finally {
      setBusyId(null);
    }
  };

  const onReject = (item: PendingColorName) => {
    Alert.alert("Rejeter cette proposition ?", `« ${item.name} » ne sera pas publiée.`, [
      { text: "Annuler", style: "cancel" },
      { text: "Rejeter", style: "destructive", onPress: () => decide(item, false) },
    ]);
  };

  if (!isModerator) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <EmptyState
          title="Accès réservé à la modération"
          subtitle="Cette section est réservée aux comptes modérateur/admin."
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {error ? <ErrorBanner message={error} /> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={items.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              title="File de modération vide"
              subtitle="Aucune proposition de nom en attente."
            />
          ) : null
        }
        renderItem={({ item }) => (
          <View style={[styles.row, { borderColor: theme.border }]}>
            <View
              style={[
                styles.swatch,
                { backgroundColor: item.color?.hex ?? theme.border },
              ]}
            />
            <View style={styles.rowText}>
              <Text style={[styles.name, { color: theme.text }]}>{item.name}</Text>
              <Text style={[styles.meta, { color: theme.subtext }]}>
                {item.color ? `${item.color.hex.toUpperCase()} · ${FAMILY_LABEL_FR[item.color.family]}` : "Couleur inconnue"}
              </Text>
            </View>
            <View style={styles.actions}>
              <Pressable
                onPress={() => decide(item, true)}
                disabled={busyId === item.id}
                accessibilityRole="button"
                accessibilityLabel={`Approuver ${item.name}`}
                style={[styles.actionButton, { backgroundColor: theme.success }]}
              >
                <Text style={styles.actionLabel}>Approuver</Text>
              </Pressable>
              <Pressable
                onPress={() => onReject(item)}
                disabled={busyId === item.id}
                accessibilityRole="button"
                accessibilityLabel={`Rejeter ${item.name}`}
                style={[styles.actionButton, { backgroundColor: theme.danger }]}
              >
                <Text style={styles.actionLabel}>Rejeter</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", padding: spacing.lg },
  list: { padding: spacing.md, gap: spacing.sm },
  emptyContainer: { flexGrow: 1, justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
  },
  swatch: { width: 44, height: 44, borderRadius: 12 },
  rowText: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600" },
  meta: { fontSize: 12, marginTop: 2 },
  actions: { gap: spacing.xs },
  actionButton: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: 10 },
  actionLabel: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
