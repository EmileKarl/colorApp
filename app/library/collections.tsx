import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Card } from "../../src/components/Card";
import { ErrorBanner } from "../../src/components/ErrorBanner";
import { Field } from "../../src/components/Field";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { Sheet } from "../../src/components/Sheet";
import { StateView } from "../../src/components/StateView";
import { useAuth } from "../../src/context/AuthContext";
import {
  createCollection,
  deleteCollection,
  duplicateCollection,
  listCollections,
  renameCollection,
  setCollectionVisibility,
  type CollectionWithItems,
} from "../../src/lib/collectionApi";
import { spacing, type, useTheme } from "../../src/theme";

/** Named collections — ColorLens page 20. */
export default function CollectionsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();

  const [items, setItems] = useState<CollectionWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [selected, setSelected] = useState<CollectionWithItems | null>(null);
  const [renaming, setRenaming] = useState<CollectionWithItems | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      setItems(await listCollections(user.id));
    } catch {
      setError("Impossible de charger tes collections.");
    } finally {
      setLoading(false);
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
        <PrimaryButton label="Se connecter" onPress={() => router.push("/auth/sign-in")} />
      </Screen>
    );
  }

  const onCreate = async () => {
    if (draftName.trim().length === 0) return;
    setBusy(true);
    try {
      const created = await createCollection({ userId: user.id, name: draftName });
      setItems((previous) => [{ ...created, items: [] }, ...previous]);
      setDraftName("");
      setCreating(false);
    } catch {
      setError("La création a échoué.");
    } finally {
      setBusy(false);
    }
  };

  // Renaming uses a sheet rather than Alert.prompt: that API is iOS-only, so
  // on Android the button would have silently done nothing — which §13
  // forbids.
  const onRenameConfirm = async () => {
    if (!renaming || renameDraft.trim().length === 0) return;
    setBusy(true);
    try {
      await renameCollection(renaming.id, renameDraft);
      setItems((previous) =>
        previous.map((entry) =>
          entry.id === renaming.id ? { ...entry, name: renameDraft.trim() } : entry,
        ),
      );
      setRenaming(null);
    } catch {
      setError("Le renommage a échoué.");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = (collection: CollectionWithItems) => {
    Alert.alert(
      "Supprimer la collection",
      `Supprimer « ${collection.name} » ? Les couleurs, palettes et créations qu’elle contient ne sont pas supprimées.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            setSelected(null);
            try {
              await deleteCollection(collection.id);
              setItems((previous) => previous.filter((entry) => entry.id !== collection.id));
            } catch {
              setError("La suppression a échoué.");
            }
          },
        },
      ],
    );
  };

  return (
    <Screen
      onRefresh={load}
      refreshing={loading}
      contentStyle={styles.content}
      footer={
        <PrimaryButton
          label="Nouvelle collection"
          icon="add"
          onPress={() => setCreating(true)}
        />
      }
    >
      {error ? <ErrorBanner message={error} /> : null}

      {!loading && items.length === 0 ? (
        <StateView
          kind="empty_collection"
          message="Regroupe tes couleurs, palettes et créations : « Idées de sneakers », « Palette de ma chambre »…"
        />
      ) : null}

      {items.map((collection) => (
        <Card
          key={collection.id}
          onPress={() =>
            router.push({ pathname: "/collections/[id]", params: { id: collection.id } })
          }
          onLongPress={() => setSelected(collection)}
          accessibilityLabel={collection.name}
        >
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={[type.subheading, { color: theme.text }]} numberOfLines={1}>
                {collection.name}
              </Text>
              <Text style={[type.caption, { color: theme.subtext }]}>
                {collection.items.length} élément{collection.items.length > 1 ? "s" : ""}
              </Text>
            </View>
            <Ionicons
              name={collection.is_public ? "globe-outline" : "lock-closed-outline"}
              size={16}
              color={theme.subtext}
            />
          </View>
        </Card>
      ))}

      <Text style={[type.caption, styles.hint, { color: theme.subtext }]}>
        Appui long sur une collection pour la renommer, la dupliquer ou la supprimer.
      </Text>

      <Sheet
        visible={creating}
        onClose={() => setCreating(false)}
        title="Nouvelle collection"
        footer={<PrimaryButton label="Créer" onPress={onCreate} loading={busy} />}
      >
        <Field
          label="Nom"
          placeholder="Ex. : Inspiration automne"
          value={draftName}
          onChangeText={setDraftName}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={onCreate}
        />
      </Sheet>

      <Sheet
        visible={renaming !== null}
        onClose={() => setRenaming(null)}
        title="Renommer la collection"
        footer={<PrimaryButton label="Renommer" onPress={onRenameConfirm} loading={busy} />}
      >
        <Field
          label="Nom"
          value={renameDraft}
          onChangeText={setRenameDraft}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={onRenameConfirm}
        />
      </Sheet>

      <Sheet
        visible={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ""}
        subtitle={selected?.is_public ? "Publique" : "Privée"}
      >
        {selected ? (
          <>
            <PrimaryButton
              label="Renommer"
              icon="create-outline"
              variant="secondary"
              onPress={() => {
                setRenameDraft(selected.name);
                setRenaming(selected);
                setSelected(null);
              }}
            />
            <PrimaryButton
              label="Dupliquer"
              icon="copy-outline"
              variant="secondary"
              loading={busy}
              onPress={async () => {
                setBusy(true);
                try {
                  const copy = await duplicateCollection(selected, user.id);
                  setItems((previous) => [{ ...copy, items: selected.items }, ...previous]);
                  setSelected(null);
                } catch {
                  setError("La duplication a échoué.");
                } finally {
                  setBusy(false);
                }
              }}
            />
            <PrimaryButton
              label={selected.is_public ? "Rendre privée" : "Rendre publique"}
              icon={selected.is_public ? "lock-closed-outline" : "globe-outline"}
              variant="secondary"
              loading={busy}
              onPress={async () => {
                const next = !selected.is_public;
                setBusy(true);
                try {
                  await setCollectionVisibility(selected.id, next);
                  setItems((previous) =>
                    previous.map((entry) =>
                      entry.id === selected.id ? { ...entry, is_public: next } : entry,
                    ),
                  );
                  setSelected((current) => (current ? { ...current, is_public: next } : current));
                } catch {
                  setError("Le changement de visibilité a échoué.");
                } finally {
                  setBusy(false);
                }
              }}
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

const styles = StyleSheet.create({
  content: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowText: { flex: 1, gap: 2 },
  hint: { textAlign: "center", paddingTop: spacing.sm },
});
