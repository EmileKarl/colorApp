import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card, SectionHeader } from "../../src/components/Card";
import { Chip, ChipRow } from "../../src/components/Chip";
import { Field } from "../../src/components/Field";
import { Screen } from "../../src/components/Screen";
import { StateView } from "../../src/components/StateView";
import { useAuth } from "../../src/context/AuthContext";
import { useRecentObjects } from "../../src/hooks/useRecentObjects";
import {
  listFavoriteObjectIds,
  loadCatalogue,
  setObjectFavorite,
  type CatalogueEntry,
} from "../../src/lib/objectApi";
import { ALL_CATEGORIES, CATEGORY_ICON, CATEGORY_LABEL_FR, builtinObject } from "../../src/objects/models";
import { applyColor, createProject } from "../../src/objects/project";
import { ObjectCanvas } from "../../src/objects/renderer/ObjectCanvas";
import type { ObjectCategory } from "../../src/objects/types";
import { radius, spacing, type, useLayout, useTheme } from "../../src/theme";

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Object library — ColorLens page 9.
 *
 * Reached with an optional `hex` parameter: when the user arrives from a
 * captured color, every thumbnail is already wearing it. Showing the object in
 * a neutral grey and only applying the color after selection would make the
 * choice harder than it needs to be — the whole question the screen asks is
 * "which of these looks good in *your* color".
 */
export default function ObjectLibraryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { columns, width, gutter } = useLayout();
  const { user } = useAuth();
  const { hex } = useLocalSearchParams<{ hex?: string }>();
  const { recentObjectIds } = useRecentObjects();

  const [entries, setEntries] = useState<CatalogueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ObjectCategory | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);

  const load = useCallback(async () => {
    const result = await loadCatalogue();
    setEntries(result.entries);
    setLoading(false);
    if (user) {
      // A failure here only costs the favourites markers, so it must not stop
      // the catalogue from rendering.
      try {
        setFavorites(await listFavoriteObjectIds(user.id));
      } catch {
        setFavorites([]);
      }
    }
  }, [user]);

  useEffect(() => {
    // setState inside `load` only runs after its internal await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (category && entry.model.category !== category) return false;
      if (favoritesOnly && !favorites.includes(entry.model.id)) return false;
      if (!needle) return true;
      return (
        entry.model.name.toLowerCase().includes(needle) ||
        CATEGORY_LABEL_FR[entry.model.category].toLowerCase().includes(needle) ||
        entry.model.zones.some((zone) => zone.label.toLowerCase().includes(needle))
      );
    });
  }, [entries, query, category, favoritesOnly, favorites]);

  const recent = useMemo(
    () =>
      recentObjectIds
        .map((id) => entries.find((entry) => entry.model.id === id))
        .filter((entry): entry is CatalogueEntry => Boolean(entry)),
    [recentObjectIds, entries],
  );

  const onToggleFavorite = async (objectId: string) => {
    if (!user) {
      router.push("/auth/sign-in");
      return;
    }
    const next = !favorites.includes(objectId);
    // Optimistic: the star must respond instantly, and a failed write is
    // recoverable by tapping again.
    setFavorites((previous) =>
      next ? [...previous, objectId] : previous.filter((id) => id !== objectId),
    );
    try {
      await setObjectFavorite(user.id, objectId, next);
    } catch {
      setFavorites((previous) =>
        next ? previous.filter((id) => id !== objectId) : [...previous, objectId],
      );
    }
  };

  const tileWidth = (width - gutter * 2 - spacing.sm * (columns - 1)) / columns;

  return (
    <Screen onRefresh={load} refreshing={loading} contentStyle={styles.content}>
      <Text style={[type.title, { color: theme.text }]}>
        Sur quel objet veux-tu appliquer cette couleur ?
      </Text>

      <Field
        placeholder="Rechercher un objet…"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Rechercher un objet"
      />

      <ChipRow>
        <Chip label="Tout" selected={category === null} onPress={() => setCategory(null)} />
        {ALL_CATEGORIES.map((entry) => (
          <Chip
            key={entry}
            label={CATEGORY_LABEL_FR[entry]}
            icon={CATEGORY_ICON[entry] as IconName}
            selected={category === entry}
            onPress={() => setCategory(category === entry ? null : entry)}
          />
        ))}
        <Chip
          label="Favoris"
          icon="star"
          selected={favoritesOnly}
          onPress={() => setFavoritesOnly((previous) => !previous)}
        />
      </ChipRow>

      {recent.length > 0 && !query && !category && !favoritesOnly ? (
        <View style={styles.section}>
          <SectionHeader title="Récemment utilisés" />
          <View style={styles.grid}>
            {recent.map((entry) => (
              <ObjectTile
                key={`recent-${entry.model.id}`}
                entry={entry}
                hex={hex}
                width={tileWidth}
                favorite={favorites.includes(entry.model.id)}
                onPress={() =>
                  router.push({ pathname: "/objects/[id]", params: { id: entry.model.id, hex } })
                }
                onToggleFavorite={() => onToggleFavorite(entry.model.id)}
              />
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader
          title={category ? CATEGORY_LABEL_FR[category] : "Tous les objets"}
          subtitle={`${visible.length} modèle${visible.length > 1 ? "s" : ""}`}
        />
        {loading ? (
          <StateView kind="loading" />
        ) : visible.length === 0 ? (
          <StateView
            kind={query || category || favoritesOnly ? "no_results" : "empty_list"}
            message={
              favoritesOnly
                ? "Aucun objet en favori pour l'instant. Touche l'étoile sur un objet pour l'ajouter."
                : undefined
            }
          />
        ) : (
          <View style={styles.grid}>
            {visible.map((entry) => (
              <ObjectTile
                key={entry.model.id}
                entry={entry}
                hex={hex}
                width={tileWidth}
                favorite={favorites.includes(entry.model.id)}
                onPress={() =>
                  router.push({ pathname: "/objects/[id]", params: { id: entry.model.id, hex } })
                }
                onToggleFavorite={() => onToggleFavorite(entry.model.id)}
              />
            ))}
          </View>
        )}
      </View>

      {/* Honest about the catalogue's size rather than letting the user
          wonder whether the list failed to load. */}
      <Text style={[type.caption, styles.note, { color: theme.subtext }]}>
        {entries.length} modèles vectoriels pour l’instant. Ils sont dessinés à la main et
        fonctionnent hors ligne ; des mockups photographiques pourront s’y ajouter sans
        mise à jour de l’application.
      </Text>
    </Screen>
  );
}

function ObjectTile({
  entry,
  hex,
  width,
  favorite,
  onPress,
  onToggleFavorite,
}: {
  entry: CatalogueEntry;
  hex?: string;
  width: number;
  favorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
}) {
  const theme = useTheme();
  const model = entry.model;

  const project = useMemo(() => {
    const base = createProject(model);
    return hex ? applyColor(base, model, hex) : base;
  }, [model, hex]);

  const canvasHeight = Math.round(width * 0.78);

  return (
    <Card style={{ width }} padded={false} onPress={onPress} accessibilityLabel={model.name}>
      <View>
        <ObjectCanvas model={model} project={project} width={width} height={canvasHeight} />
        <Pressable
          onPress={onToggleFavorite}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          accessibilityState={{ selected: favorite }}
          style={[styles.star, { backgroundColor: theme.surface }]}
        >
          <Ionicons
            name={favorite ? "star" : "star-outline"}
            size={15}
            color={favorite ? theme.warning : theme.subtext}
          />
        </Pressable>
      </View>
      <View style={styles.tileCaption}>
        <Text style={[type.label, { color: theme.text }]} numberOfLines={1}>
          {model.name}
        </Text>
        <Text style={[type.caption, { color: theme.subtext }]} numberOfLines={1}>
          {model.zones.length} zones
        </Text>
      </View>
    </Card>
  );
}

/** Re-exported so the detail route can resolve a built-in without a network call. */
export { builtinObject };

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  section: { gap: spacing.xs },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tileCaption: { padding: spacing.sm, gap: 2 },
  star: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  note: { textAlign: "center", paddingHorizontal: spacing.sm },
});
