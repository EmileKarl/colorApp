import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card, SectionHeader } from "../../src/components/Card";
import { Chip } from "../../src/components/Chip";
import { ErrorBanner } from "../../src/components/ErrorBanner";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { StateView } from "../../src/components/StateView";
import { useAuth } from "../../src/context/AuthContext";
import { buildColorStory } from "../../src/domain/colorStory";
import {
  fetchLikeCounts,
  getCreation,
  likeCreation,
  remixCreation,
  unlikeCreation,
} from "../../src/lib/creationApi";
import { builtinObject } from "../../src/objects/models";
import { parseProject, projectPalette } from "../../src/objects/project";
import { ObjectCanvas } from "../../src/objects/renderer/ObjectCanvas";
import { radius, spacing, type, useLayout, useTheme } from "../../src/theme";
import type { CreationRow } from "../../src/types/database";

/**
 * Public creation detail and remix — ColorLens page 22.
 *
 * Remix records lineage (`remixed_from`), which is what makes it attributable
 * back to the original author rather than an anonymous copy. The remix itself
 * lands private: republishing someone else's work on their behalf is exactly
 * what §11's "publication jamais automatique" is there to prevent.
 */
export default function PublicCreationScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { width, gutter } = useLayout();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [creation, setCreation] = useState<CreationRow | null>(null);
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const found = await getCreation(id);
      if (cancelled) return;
      if (!found) {
        setStatus("missing");
        return;
      }
      setCreation(found);
      setStatus("ready");
      const counts = await fetchLikeCounts([found.id]).catch(() => new Map<string, number>());
      if (!cancelled) setLikes(counts.get(found.id) ?? 0);
    }
    load().catch(() => {
      if (!cancelled) setStatus("missing");
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

  if (status === "missing" || !creation) {
    return (
      <Screen center>
        <StateView
          kind="object_unavailable"
          message="Cette création n’est plus disponible, ou elle est devenue privée."
          onRetry={() => router.replace({ pathname: "/creations/[id]", params: { id } })}
          onAlternative={() => router.replace("/(tabs)/explore")}
          alternativeLabel="Retour à Explorer"
        />
      </Screen>
    );
  }

  const model = builtinObject(creation.object_id);
  const project = model ? parseProject(creation.project_data, model) : null;
  const palette = model && project ? projectPalette(project, model) : [];
  const story = buildColorStory(palette, model?.name);
  const canvasWidth = width - gutter * 2;

  const onLike = async () => {
    if (!user) {
      router.push("/auth/sign-in");
      return;
    }
    const next = !liked;
    setLiked(next);
    setLikes((previous) => previous + (next ? 1 : -1));
    try {
      if (next) await likeCreation(user.id, creation.id);
      else await unlikeCreation(user.id, creation.id);
    } catch {
      setLiked(!next);
      setLikes((previous) => previous + (next ? -1 : 1));
    }
  };

  const onRemix = async () => {
    if (!user) {
      router.push("/auth/sign-in");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const remix = await remixCreation(creation, user.id);
      router.replace({
        pathname: "/studio/[id]",
        params: { id: remix.object_id, creation: remix.id },
      });
    } catch {
      setError("Le remix a échoué. Vérifie ta connexion et réessaie.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      contentStyle={styles.content}
      footer={
        <PrimaryButton label="Remixer" icon="git-branch-outline" onPress={onRemix} loading={busy} />
      }
    >
      <Card padded={false}>
        {model && project ? (
          <ObjectCanvas
            model={model}
            project={project}
            width={canvasWidth}
            height={Math.round(canvasWidth * 0.68)}
          />
        ) : (
          <View style={[styles.missing, { backgroundColor: theme.surfaceAlt }]}>
            <Ionicons name="cube-outline" size={24} color={theme.subtext} />
            <Text style={[type.caption, { color: theme.subtext }]}>Modèle indisponible</Text>
          </View>
        )}
      </Card>

      <View style={styles.header}>
        <Text style={[type.title, { color: theme.text }]}>{creation.name}</Text>
        <View style={styles.metaRow}>
          <Chip
            label={`${likes} j’aime`}
            icon={liked ? "heart" : "heart-outline"}
            selected={liked}
            onPress={onLike}
          />
          {model ? <Chip label={model.name} icon="cube-outline" /> : null}
          {creation.remixed_from ? <Chip label="Remix" icon="git-branch-outline" /> : null}
        </View>
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      {creation.description ? (
        <Text style={[type.body, { color: theme.subtext }]}>{creation.description}</Text>
      ) : null}

      {palette.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Palette" />
          <View style={styles.paletteStrip}>
            {palette.map((hex) => (
              <View key={hex} style={[styles.paletteStep, { backgroundColor: hex }]} />
            ))}
          </View>
          <PrimaryButton
            label="Appliquer cette palette"
            icon="color-filter-outline"
            variant="secondary"
            onPress={() => router.push({ pathname: "/objects", params: { hex: palette[0] } })}
          />
        </View>
      ) : null}

      {story ? (
        <View style={styles.section}>
          <SectionHeader title="Color Story" subtitle="Assemblée à partir des mesures" />
          <Text style={[type.body, { color: theme.subtext }]}>{story.description}</Text>
        </View>
      ) : null}

      {creation.tags.length > 0 ? (
        <View style={styles.metaRow}>
          {creation.tags.map((tag) => (
            <Chip key={tag} label={`#${tag}`} />
          ))}
        </View>
      ) : null}

      <Text style={[type.caption, { color: theme.subtext }]}>
        Le remix crée une copie privée sur ton compte, en gardant le lien vers l’original.
        Tu choisis ensuite si tu la publies.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  header: { gap: spacing.sm },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  section: { gap: spacing.sm },
  paletteStrip: { flexDirection: "row", height: 56, borderRadius: radius.md, overflow: "hidden" },
  paletteStep: { flex: 1 },
  missing: { height: 160, alignItems: "center", justifyContent: "center", gap: spacing.xs },
});
