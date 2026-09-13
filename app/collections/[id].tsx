import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card, SectionHeader } from "../../src/components/Card";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { StateView } from "../../src/components/StateView";
import { getCollection, removeFromCollection, type CollectionWithItems } from "../../src/lib/collectionApi";
import { getColor } from "../../src/lib/colorApi";
import { getCreation } from "../../src/lib/creationApi";
import { getPalette } from "../../src/lib/paletteApi";
import { builtinObject } from "../../src/objects/models";
import { parseProject } from "../../src/objects/project";
import { ObjectCanvas } from "../../src/objects/renderer/ObjectCanvas";
import { monoFontFamily, radius, spacing, type, useLayout, useTheme } from "../../src/theme";
import type { CollectionItemRow } from "../../src/types/database";

type ResolvedItem =
  | { kind: "color"; id: string; label: string; hex: string }
  | { kind: "palette"; id: string; label: string; colors: string[] }
  | { kind: "creation"; id: string; label: string; objectId: string; project: unknown }
  | { kind: "missing"; id: string; label: string };

/**
 * A collection's contents — ColorLens page 20.
 *
 * Items are polymorphic in the database, so they are resolved here one kind at
 * a time. An item whose target has been deleted renders as a "missing" row
 * rather than vanishing: the cleanup trigger removes orphans, so a missing row
 * means something the user should see, not something to hide.
 */
export default function CollectionDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { width, gutter } = useLayout();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [collection, setCollection] = useState<CollectionWithItems | null>(null);
  const [resolved, setResolved] = useState<ResolvedItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const found = await getCollection(id);
      if (cancelled) return;
      if (!found) {
        setStatus("error");
        return;
      }
      setCollection(found);
      setResolved(await Promise.all(found.items.map(resolveItem)));
      if (!cancelled) setStatus("ready");
    }

    load().catch(() => {
      if (!cancelled) setStatus("error");
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (status === "loading") {
    return (
      <Screen center>
        <StateView kind="loading" />
      </Screen>
    );
  }

  if (status === "error" || !collection) {
    return (
      <Screen center>
        <StateView
          kind="offline"
          message="Cette collection n’a pas pu être chargée."
          onRetry={() => router.replace({ pathname: "/collections/[id]", params: { id } })}
        />
      </Screen>
    );
  }

  const onRemove = async (item: ResolvedItem) => {
    const row = collection.items.find((entry) => entry.item_id === item.id);
    if (!row) return;
    try {
      await removeFromCollection({
        collectionId: collection.id,
        itemType: row.item_type,
        itemId: row.item_id,
      });
      setResolved((previous) => previous.filter((entry) => entry.id !== item.id));
    } catch {
      // Left in place on failure; tapping again retries.
    }
  };

  const cardWidth = width - gutter * 2;

  return (
    <Screen contentStyle={styles.content}>
      <SectionHeader
        title={collection.name}
        subtitle={
          collection.is_public
            ? "Publique — visible par les autres"
            : "Privée — visible uniquement par toi"
        }
      />

      {collection.description ? (
        <Text style={[type.body, { color: theme.subtext }]}>{collection.description}</Text>
      ) : null}

      {resolved.length === 0 ? (
        <StateView
          kind="empty_collection"
          onAlternative={() => router.push("/objects")}
          alternativeLabel="Créer quelque chose"
        />
      ) : null}

      {resolved.map((item) => (
        <Card key={`${item.kind}-${item.id}`} padded={false} onLongPress={() => onRemove(item)}>
          {item.kind === "color" ? (
            <View style={styles.colorRow}>
              <View style={[styles.swatch, { backgroundColor: item.hex }]} />
              <View style={styles.rowText}>
                <Text style={[type.subheading, { color: theme.text }]}>{item.label}</Text>
                <Text style={[type.caption, styles.mono, { color: theme.subtext }]}>
                  {item.hex.toUpperCase()}
                </Text>
              </View>
            </View>
          ) : null}

          {item.kind === "palette" ? (
            <View>
              <View style={styles.paletteStrip}>
                {item.colors.map((hex, index) => (
                  <View key={`${hex}-${index}`} style={[styles.paletteStep, { backgroundColor: hex }]} />
                ))}
              </View>
              <Text style={[type.subheading, styles.caption, { color: theme.text }]}>
                {item.label}
              </Text>
            </View>
          ) : null}

          {item.kind === "creation" ? <CreationPreview item={item} width={cardWidth} /> : null}

          {item.kind === "missing" ? (
            <Text style={[type.body, styles.caption, { color: theme.subtext }]}>{item.label}</Text>
          ) : null}
        </Card>
      ))}

      {resolved.length > 0 ? (
        <Text style={[type.caption, styles.hint, { color: theme.subtext }]}>
          Appui long sur un élément pour le retirer de la collection. Il n’est pas supprimé.
        </Text>
      ) : null}

      <PrimaryButton
        label="Ajouter depuis mes couleurs"
        icon="add"
        variant="secondary"
        onPress={() => router.push("/library/colors")}
      />
    </Screen>
  );
}

function CreationPreview({
  item,
  width,
}: {
  item: Extract<ResolvedItem, { kind: "creation" }>;
  width: number;
}) {
  const theme = useTheme();
  const model = builtinObject(item.objectId);
  const project = model ? parseProject(item.project, model) : null;
  if (!model || !project) {
    return (
      <Text style={[type.body, styles.caption, { color: theme.subtext }]}>
        {item.label} — modèle indisponible
      </Text>
    );
  }
  return (
    <View>
      <ObjectCanvas model={model} project={project} width={width} height={Math.round(width * 0.55)} />
      <Text style={[type.subheading, styles.caption, { color: theme.text }]}>{item.label}</Text>
    </View>
  );
}

async function resolveItem(row: CollectionItemRow): Promise<ResolvedItem> {
  try {
    if (row.item_type === "color") {
      const color = await getColor(row.item_id);
      if (!color) return { kind: "missing", id: row.item_id, label: "Couleur introuvable" };
      return {
        kind: "color",
        id: color.id,
        label: color.name ?? "Sans nom",
        hex: color.hex,
      };
    }
    if (row.item_type === "palette") {
      const palette = await getPalette(row.item_id);
      if (!palette) return { kind: "missing", id: row.item_id, label: "Palette introuvable" };
      return {
        kind: "palette",
        id: palette.id,
        label: palette.name,
        colors: palette.colors.map((entry) => entry.hex),
      };
    }
    const creation = await getCreation(row.item_id);
    if (!creation) return { kind: "missing", id: row.item_id, label: "Création introuvable" };
    return {
      kind: "creation",
      id: creation.id,
      label: creation.name,
      objectId: creation.object_id,
      project: creation.project_data,
    };
  } catch {
    return { kind: "missing", id: row.item_id, label: "Élément non chargé" };
  }
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm },
  colorRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md },
  swatch: { width: 44, height: 44, borderRadius: radius.md },
  rowText: { flex: 1, gap: 2 },
  mono: { fontFamily: monoFontFamily },
  paletteStrip: { flexDirection: "row", height: 56 },
  paletteStep: { flex: 1 },
  caption: { padding: spacing.md },
  hint: { textAlign: "center", paddingVertical: spacing.sm },
});
