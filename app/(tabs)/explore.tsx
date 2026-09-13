import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";

import { EmptyState } from "../../src/components/EmptyState";
import { ErrorBanner } from "../../src/components/ErrorBanner";
import { useAuth } from "../../src/context/AuthContext";
import { castVote, fetchTopRankedNames, reportContent } from "../../src/lib/communityApi";
import { ALL_COLOR_FAMILIES, FAMILY_LABEL_FR, type ColorFamily } from "../../src/lib/color";
import type { ColorNameRankingRow } from "../../src/types/database";
import { spacing, useTheme } from "../../src/theme";

export default function CommunityScreen() {
  const theme = useTheme();
  const { user } = useAuth();
  const [rankings, setRankings] = useState<ColorNameRankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [familyFilter, setFamilyFilter] = useState<ColorFamily | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRankings(await fetchTopRankedNames());
    } catch {
      setError(
        "Impossible de charger le classement communautaire. Vérifie que le backend Supabase est configuré (voir README).",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // setState inside `load` only runs after its internal `await`, never
    // synchronously during this effect — safe despite the lint rule's name.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const familiesInResults = useMemo(
    () => ALL_COLOR_FAMILIES.filter((family) => rankings.some((r) => r.family === family)),
    [rankings],
  );

  const visibleRankings = useMemo(
    () => (familyFilter ? rankings.filter((r) => r.family === familyFilter) : rankings),
    [rankings, familyFilter],
  );

  const onSelectFilter = (family: ColorFamily | null) => {
    Haptics.selectionAsync();
    setFamilyFilter(family);
  };

  const onVote = async (row: ColorNameRankingRow, value: 1 | -1) => {
    if (!user) {
      Alert.alert("Connexion requise", "Connecte-toi pour voter pour un nom de couleur.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await castVote({ colorNameId: row.color_name_id, voterId: user.id, value });
      await load();
    } catch {
      setError("Le vote a échoué. Réessaie.");
    }
  };

  const onReport = (row: ColorNameRankingRow) => {
    if (!user) {
      Alert.alert("Connexion requise", "Connecte-toi pour signaler un contenu.");
      return;
    }
    Alert.alert("Signaler ce nom", `Signaler « ${row.name} » comme inapproprié ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Signaler",
        style: "destructive",
        onPress: async () => {
          try {
            await reportContent({
              reporterId: user.id,
              targetType: "color_name",
              targetId: row.color_name_id,
              reason: "Signalé depuis le classement communautaire",
            });
          } catch {
            setError("Le signalement a échoué.");
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {error ? <ErrorBanner message={error} /> : null}

      {familiesInResults.length > 1 ? (
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[null, ...familiesInResults]}
          keyExtractor={(item) => item ?? "all"}
          contentContainerStyle={styles.filterRow}
          renderItem={({ item }) => {
            const active = familyFilter === item;
            return (
              <Pressable
                onPress={() => onSelectFilter(item)}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? theme.accent : theme.surface,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text style={{ color: active ? theme.background : theme.text, fontSize: 13 }}>
                  {item ? FAMILY_LABEL_FR[item] : "Tous"}
                </Text>
              </Pressable>
            );
          }}
        />
      ) : null}

      <FlatList
        data={visibleRankings}
        keyExtractor={(item) => item.color_name_id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        contentContainerStyle={visibleRankings.length === 0 ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              title="Aucune couleur classée pour l'instant"
              subtitle="Scanne et propose le premier nom de couleur de la communauté !"
            />
          ) : null
        }
        renderItem={({ item }) => (
          <View style={[styles.row, { borderColor: theme.border }]}>
            <View style={[styles.swatch, { backgroundColor: item.hex }]} />
            <View style={styles.rowText}>
              <Text style={[styles.name, { color: theme.text }]}>{item.name}</Text>
              <Text style={[styles.hex, { color: theme.subtext }]}>
                {item.hex.toUpperCase()} · {FAMILY_LABEL_FR[item.family]}
              </Text>
            </View>
            <View style={styles.voteControls}>
              <Pressable onPress={() => onVote(item, 1)} hitSlop={8}>
                <Text style={{ color: theme.success, fontSize: 18 }}>▲</Text>
              </Pressable>
              <Text style={{ color: theme.text, fontWeight: "700" }}>{item.score}</Text>
              <Pressable onPress={() => onVote(item, -1)} hitSlop={8}>
                <Text style={{ color: theme.danger, fontSize: 18 }}>▼</Text>
              </Pressable>
              <Pressable onPress={() => onReport(item)} hitSlop={8} style={styles.report}>
                <Text style={{ color: theme.subtext, fontSize: 12 }}>Signaler</Text>
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
  filterRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: spacing.xs,
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
  name: { fontSize: 15, fontWeight: "600" },
  hex: { fontSize: 12, marginTop: 2 },
  voteControls: { alignItems: "center", gap: 2 },
  report: { marginTop: 4 },
});
