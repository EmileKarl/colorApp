import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Card } from "../../src/components/Card";
import { ErrorBanner } from "../../src/components/ErrorBanner";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { Sheet } from "../../src/components/Sheet";
import { StateView } from "../../src/components/StateView";
import { useAuth } from "../../src/context/AuthContext";
import {
  deleteCreation,
  duplicateCreation,
  listCreations,
  updateCreation,
} from "../../src/lib/creationApi";
import { builtinObject } from "../../src/objects/models";
import { parseProject } from "../../src/objects/project";
import { ObjectCanvas } from "../../src/objects/renderer/ObjectCanvas";
import { radius, spacing, type, useLayout, useTheme } from "../../src/theme";
import type { CreationRow } from "../../src/types/database";

/**
 * Saved creations — the management half of ColorLens page 18: duplicate,
 * edit, share, delete, publish or unpublish.
 *
 * Each card renders the creation from its stored `project_data` rather than
 * from a saved preview image. That costs a little GPU per card and buys
 * correctness: a preview uploaded at save time goes stale the moment the
 * object model changes, and shows the user something their creation no longer
 * looks like.
 */
export default function CreationsScreen() {
  const router = useRouter();
  const { width, gutter } = useLayout();
  const { user } = useAuth();

  const [items, setItems] = useState<CreationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CreationRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      setItems(await listCreations(user.id));
    } catch {
      setError("Impossible de charger tes créations.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Reloads on every focus so a creation saved from the Studio appears when
  // the user navigates back, rather than after a manual pull-to-refresh.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!user) {
    return (
      <Screen center>
        <StateView kind="signed_out" />
        <PrimaryButton label="Se connecter" onPress={() => router.push("/auth/sign-in")} />
      </Screen>
    );
  }

  const onDelete = (creation: CreationRow) => {
    Alert.alert("Supprimer", `Supprimer « ${creation.name} » ? Cette action est définitive.`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          setSelected(null);
          try {
            await deleteCreation(creation.id);
            setItems((previous) => previous.filter((entry) => entry.id !== creation.id));
          } catch {
            setError("La suppression a échoué.");
          }
        },
      },
    ]);
  };

  const onDuplicate = async (creation: CreationRow) => {
    setBusy(true);
    try {
      const copy = await duplicateCreation(creation, user.id);
      setItems((previous) => [copy, ...previous]);
      setSelected(null);
    } catch {
      setError("La duplication a échoué.");
    } finally {
      setBusy(false);
    }
  };

  const onTogglePublic = async (creation: CreationRow) => {
    const next = !creation.is_public;
    setBusy(true);
    try {
      await updateCreation(creation.id, { isPublic: next });
      setItems((previous) =>
        previous.map((entry) => (entry.id === creation.id ? { ...entry, is_public: next } : entry)),
      );
      setSelected((current) => (current ? { ...current, is_public: next } : current));
    } catch {
      setError("Le changement de visibilité a échoué.");
    } finally {
      setBusy(false);
    }
  };

  const cardWidth = width - gutter * 2;

  return (
    <Screen onRefresh={load} refreshing={loading} contentStyle={styles.content}>
      {error ? <ErrorBanner message={error} /> : null}

      {!loading && items.length === 0 ? (
        <StateView
          kind="empty_profile"
          onAlternative={() => router.push("/objects")}
          alternativeLabel="Choisir un objet"
        />
      ) : null}

      {items.map((creation) => (
        <CreationCard
          key={creation.id}
          creation={creation}
          width={cardWidth}
          onPress={() => setSelected(creation)}
        />
      ))}

      <Sheet
        visible={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ""}
        subtitle={selected?.is_public ? "Publique — visible dans Explorer" : "Privée"}
      >
        {selected ? (
          <>
            <PrimaryButton
              label="Rouvrir dans le Studio"
              icon="color-wand-outline"
              onPress={() => {
                const creation = selected;
                setSelected(null);
                router.push({
                  pathname: "/studio/[id]",
                  params: { id: creation.object_id, creation: creation.id },
                });
              }}
            />
            <PrimaryButton
              label="Dupliquer"
              icon="copy-outline"
              variant="secondary"
              loading={busy}
              onPress={() => onDuplicate(selected)}
            />
            <PrimaryButton
              label={selected.is_public ? "Rendre privée" : "Rendre publique"}
              icon={selected.is_public ? "lock-closed-outline" : "globe-outline"}
              variant="secondary"
              loading={busy}
              onPress={() => onTogglePublic(selected)}
            />
            <PrimaryButton
              label="Supprimer"
              icon="trash-outline"
              variant="danger"
              onPress={() => onDelete(selected)}
            />
          </>
        ) : null}
      </Sheet>
    </Screen>
  );
}

function CreationCard({
  creation,
  width,
  onPress,
}: {
  creation: CreationRow;
  width: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const model = builtinObject(creation.object_id);
  const project = model ? parseProject(creation.project_data, model) : null;

  return (
    <Card padded={false} onPress={onPress} accessibilityLabel={creation.name}>
      {model && project ? (
        <ObjectCanvas
          model={model}
          project={project}
          width={width}
          height={Math.round(width * 0.6)}
        />
      ) : (
        // A creation whose object is no longer in the catalogue still has to
        // be listed — it is the user's data, and hiding it would look like
        // silent data loss.
        <View style={[styles.missing, { backgroundColor: theme.surfaceAlt, height: width * 0.3 }]}>
          <Ionicons name="cube-outline" size={22} color={theme.subtext} />
          <Text style={[type.caption, { color: theme.subtext }]}>Modèle indisponible</Text>
        </View>
      )}
      <View style={styles.caption}>
        <View style={styles.captionText}>
          <Text style={[type.subheading, { color: theme.text }]} numberOfLines={1}>
            {creation.name}
          </Text>
          <Text style={[type.caption, { color: theme.subtext }]} numberOfLines={1}>
            {new Date(creation.created_at).toLocaleDateString()}
            {creation.tags.length > 0 ? ` · ${creation.tags.map((tag) => `#${tag}`).join(" ")}` : ""}
          </Text>
        </View>
        <Ionicons
          name={creation.is_public ? "globe-outline" : "lock-closed-outline"}
          size={16}
          color={theme.subtext}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  caption: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
  },
  captionText: { flex: 1, gap: 2 },
  missing: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radius.md,
  },
});
