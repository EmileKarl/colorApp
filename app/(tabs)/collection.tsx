import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { EmptyState } from "../../src/components/EmptyState";
import { ErrorBanner } from "../../src/components/ErrorBanner";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { useAuth } from "../../src/context/AuthContext";
import { deleteSavedColor, listSavedColors } from "../../src/lib/collectionApi";
import type { SavedColorRow } from "../../src/types/database";
import { spacing, useTheme } from "../../src/theme";

export default function CollectionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<SavedColorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      setItems(await listSavedColors(user.id));
    } catch {
      setError("Impossible de charger ta collection.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // setState inside `load` only runs after its internal `await`, never
    // synchronously during this effect — safe despite the lint rule's name.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const onDelete = (item: SavedColorRow) => {
    Alert.alert("Supprimer", `Retirer ${item.hex.toUpperCase()} de ta collection ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteSavedColor(item.id);
            setItems((prev) => prev.filter((i) => i.id !== item.id));
          } catch {
            setError("La suppression a échoué.");
          }
        },
      },
    ]);
  };

  if (!user) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <EmptyState
          title="Connecte-toi pour voir ta collection"
          subtitle="Tes couleurs sauvegardées sont liées à ton compte et synchronisées dans le cloud."
        />
        <PrimaryButton label="Se connecter" onPress={() => router.push("/auth/sign-in")} />
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
              title="Aucune couleur sauvegardée"
              subtitle="Scanne une couleur puis appuie sur « Sauvegarder » pour la retrouver ici."
            />
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onLongPress={() => onDelete(item)}
            style={[styles.row, { borderColor: theme.border }]}
          >
            <View style={[styles.swatch, { backgroundColor: item.hex }]} />
            <View style={styles.rowText}>
              <Text style={[styles.label, { color: theme.text }]}>
                {item.label || "Sans étiquette"}
              </Text>
              <Text style={[styles.hex, { color: theme.subtext }]}>{item.hex.toUpperCase()}</Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.lg },
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
  label: { fontSize: 15, fontWeight: "600" },
  hex: { fontSize: 12, marginTop: 2 },
});
