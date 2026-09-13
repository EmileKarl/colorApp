import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";

import { Card, SectionHeader } from "../../src/components/Card";
import { Chip } from "../../src/components/Chip";
import { ErrorBanner } from "../../src/components/ErrorBanner";
import { Field } from "../../src/components/Field";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { StateView } from "../../src/components/StateView";
import { useAuth } from "../../src/context/AuthContext";
import { saveCreation } from "../../src/lib/creationApi";
import { builtinObject } from "../../src/objects/models";
import { parseProject, projectPalette } from "../../src/objects/project";
import { spacing, type, useTheme } from "../../src/theme";

/**
 * Save a creation — ColorLens page 18.
 *
 * Public/private is a switch that starts off, and the copy says so plainly:
 * §11 requires that publication is never automatic, and a default-on toggle
 * with a quiet label is the usual way that requirement gets broken.
 */
export default function SaveCreationScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { id, project: projectJson } = useLocalSearchParams<{ id: string; project: string }>();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const model = builtinObject(id);
  const project = useMemo(() => {
    if (!model || !projectJson) return null;
    try {
      return parseProject(JSON.parse(projectJson), model);
    } catch {
      return null;
    }
  }, [model, projectJson]);

  const palette = useMemo(
    () => (project && model ? projectPalette(project, model) : []),
    [project, model],
  );

  if (!user) {
    return (
      <Screen center>
        <StateView kind="signed_out" />
        <PrimaryButton label="Se connecter" onPress={() => router.push("/auth/sign-in")} />
      </Screen>
    );
  }

  if (!model || !project) {
    return (
      <Screen center>
        <StateView kind="save_failed" message="Cette création n’a pas pu être relue." onRetry={() => router.back()} retryLabel="Retour au Studio" />
      </Screen>
    );
  }

  const addTag = () => {
    const tag = tagDraft.trim().toLowerCase().replace(/^#/, "");
    if (tag.length === 0 || tags.includes(tag) || tags.length >= 8) return;
    setTags((previous) => [...previous, tag]);
    setTagDraft("");
  };

  const onSave = async () => {
    setError(null);
    if (name.trim().length === 0) {
      setError("Donne un nom à ta création.");
      return;
    }
    setBusy(true);
    try {
      await saveCreation({
        userId: user.id,
        objectId: model.id,
        name,
        description,
        projectData: project,
        tags,
        isPublic,
      });
      // Back past the save screen to the Studio the user came from, so they
      // can keep editing rather than being dumped somewhere new.
      router.back();
    } catch {
      setError("L’enregistrement a échoué. Vérifie ta connexion et réessaie.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      contentStyle={styles.content}
      footer={<PrimaryButton label="Enregistrer" onPress={onSave} loading={busy} />}
    >
      <Card>
        <Text style={[type.subheading, { color: theme.text }]}>{model.name}</Text>
        <View style={styles.palette}>
          {palette.map((hex) => (
            <View key={hex} style={[styles.swatch, { backgroundColor: hex }]} />
          ))}
        </View>
      </Card>

      <Field
        label="Nom de la création"
        placeholder="Ex. : Sneaker coucher de soleil"
        value={name}
        onChangeText={setName}
        returnKeyType="next"
      />

      <Field
        label="Description"
        placeholder="Optionnel"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
        style={styles.multiline}
      />

      <View style={styles.section}>
        <SectionHeader title="Tags" subtitle="Jusqu’à 8, pour retrouver la création plus tard" />
        <View style={styles.wrap}>
          {tags.map((tag) => (
            <Chip
              key={tag}
              label={`#${tag}`}
              icon="close"
              onPress={() => setTags((previous) => previous.filter((entry) => entry !== tag))}
            />
          ))}
        </View>
        <Field
          placeholder="streetwear, été, minimal…"
          value={tagDraft}
          onChangeText={setTagDraft}
          autoCapitalize="none"
          returnKeyType="done"
          onSubmitEditing={addTag}
        />
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      <View style={[styles.publicRow, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <View style={styles.publicText}>
          <Text style={[type.subheading, { color: theme.text }]}>Rendre publique</Text>
          <Text style={[type.caption, { color: theme.subtext }]}>
            Privée par défaut. Publique, elle apparaîtra dans Explorer et pourra être remixée
            par d’autres. Tu peux revenir dessus à tout moment.
          </Text>
        </View>
        <Switch
          value={isPublic}
          onValueChange={setIsPublic}
          accessibilityLabel="Rendre la création publique"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  section: { gap: spacing.sm },
  palette: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.sm },
  swatch: { flex: 1, height: 32, borderRadius: 8 },
  multiline: { minHeight: 88, textAlignVertical: "top" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  publicRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  publicText: { flex: 1, gap: 2 },
});
