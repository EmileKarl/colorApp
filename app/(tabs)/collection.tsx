import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { EmptyState } from "../../src/components/EmptyState";
import { ErrorBanner } from "../../src/components/ErrorBanner";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { useAuth } from "../../src/context/AuthContext";
import { searchColors } from "../../src/domain/search";
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
  const [query, setQuery] = useState("");

  // Search runs over the already-loaded list rather than hitting the network:
  // the collection is small, and filtering locally keeps typing instant.
  const visibleItems = useMemo(() => {
    if (query.trim().length === 0) return items;
    const matches = searchColors(
      query,
      items.map((item) => ({ hex: item.hex, label: item.label ?? undefined, id: item.id })),
    );
    const matchedIds = new Set(matches.map((match) => match.item.id));
    return items.filter((item) => matchedIds.has(item.id));
  }, [items, query]);

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

      <TextInput
        placeholder="Rechercher : bleu foncé, neutre, #0047AB…"
        placeholderTextColor={theme.subtext}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Rechercher dans la collection"
        style={[styles.search, { color: theme.text, borderColor: theme.border }]}
      />

      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={visibleItems.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              title={query ? "Aucun résultat" : "Aucune couleur sauvegardée"}
              subtitle={
                query
                  ? "Essaie une famille de couleur, un qualificatif comme « clair », ou un code hexadécimal."
                  : "Scanne une couleur puis appuie sur « Sauvegarder » pour la retrouver ici."
              }
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
  search: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 15,
    margin: spacing.md,
    marginBottom: 0,
  },
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
