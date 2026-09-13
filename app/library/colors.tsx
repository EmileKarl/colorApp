import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ErrorBanner } from "../../src/components/ErrorBanner";
import { Field } from "../../src/components/Field";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { StateView } from "../../src/components/StateView";
import { useAuth } from "../../src/context/AuthContext";
import { searchColors } from "../../src/domain/search";
import { deleteColor, listColors } from "../../src/lib/colorApi";
import { FAMILY_LABEL_FR } from "../../src/lib/color";
import { monoFontFamily, radius, spacing, type, useLayout, useTheme } from "../../src/theme";
import type { ColorRow } from "../../src/types/database";

export default function ColorLibraryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { gutter } = useLayout();
  const { user } = useAuth();
  const [items, setItems] = useState<ColorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Search runs over the already-loaded list rather than hitting the network:
  // the library is small, and filtering locally keeps typing instant.
  const visibleItems = useMemo(() => {
    if (query.trim().length === 0) return items;
    const matches = searchColors(
      query,
      items.map((item) => ({ hex: item.hex, label: item.name ?? undefined, id: item.id })),
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
      setItems(await listColors(user.id));
    } catch {
      setError("Impossible de charger tes couleurs.");
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

  const onDelete = (item: ColorRow) => {
    Alert.alert("Supprimer", `Retirer ${item.hex.toUpperCase()} de ta bibliothèque ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteColor(item.id);
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
        <StateView kind="signed_out" />
        <PrimaryButton label="Se connecter" onPress={() => router.push("/auth/sign-in")} />
      </View>
    );
  }

  return (
    // This screen owns a FlatList rather than Screen's ScrollView, so it
    // carries its own keyboard handling — §13 forbids the keyboard covering
    // the search field.
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {error ? <ErrorBanner message={error} /> : null}

      <View style={{ paddingHorizontal: gutter, paddingTop: spacing.md }}>
        <Field
          placeholder="Rechercher : bleu foncé, neutre, #0047AB…"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Rechercher dans mes couleurs"
        />
      </View>

      <FlatList
        data={visibleItems}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          visibleItems.length === 0 ? styles.emptyContainer : styles.list,
          { paddingHorizontal: gutter },
        ]}
        ListEmptyComponent={
          !loading ? <StateView kind={query ? "no_results" : "empty_collection"} /> : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: "/compare", params: { a: item.hex } })}
            onLongPress={() => onDelete(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.name ?? "Sans nom"}, ${item.hex}`}
            style={({ pressed }) => [
              styles.row,
              { borderColor: theme.border, backgroundColor: theme.surface },
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.swatch, { backgroundColor: item.hex }]} />
            <View style={styles.rowText}>
              <Text style={[type.subheading, { color: theme.text }]} numberOfLines={1}>
                {item.name || "Sans nom"}
              </Text>
              <Text style={[type.caption, styles.hex, { color: theme.subtext }]}>
                {item.hex.toUpperCase()}
                {item.family ? ` · ${FAMILY_LABEL_FR[item.family]}` : ""}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", gap: spacing.md, padding: spacing.lg },
  list: { paddingVertical: spacing.md, gap: spacing.sm },
  emptyContainer: { flexGrow: 1, justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
  },
  pressed: { opacity: 0.75 },
  swatch: { width: 44, height: 44, borderRadius: radius.md },
  rowText: { flex: 1, gap: 2 },
  hex: { fontFamily: monoFontFamily },
});
