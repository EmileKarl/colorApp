import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card, SectionHeader } from "../../src/components/Card";
import { Chip, ChipRow } from "../../src/components/Chip";
import { ErrorBanner } from "../../src/components/ErrorBanner";
import { Screen } from "../../src/components/Screen";
import { StateView } from "../../src/components/StateView";
import { MOOD_LABEL_FR } from "../../src/domain/paletteMood";
import { THEMES, themeAccessibilityIssues, themeMood } from "../../src/domain/themes";
import { listPublicCreations } from "../../src/lib/creationApi";
import { fetchTopRankedNames } from "../../src/lib/communityApi";
import { FAMILY_LABEL_FR } from "../../src/lib/color";
import { builtinObject } from "../../src/objects/models";
import { parseProject } from "../../src/objects/project";
import { ObjectCanvas } from "../../src/objects/renderer/ObjectCanvas";
import { monoFontFamily, radius, spacing, type, useLayout, useTheme } from "../../src/theme";
import type { ColorNameRankingRow, CreationRow } from "../../src/types/database";

type Section = "themes" | "creations" | "names";

/**
 * Explorer — ColorLens page 21.
 *
 * Three sections, and the difference between them is deliberate:
 *
 * - **Themes** are authored palettes. They always have something to show, and
 *   the screen says they are curated rather than dressing them up as trends.
 * - **Creations** are real public creations from real users. Empty until there
 *   are users, and the empty state says exactly that.
 * - **Names** is the community voted-name leaderboard, kept from the previous
 *   product rather than deleted (§13 forbids removing a working feature
 *   without justification).
 *
 * What is *not* here: "couleurs populaires", "palettes tendances", "créateurs"
 * and "défis". All four need an audience the app does not have, and filling
 * them with invented numbers would be fabricating statistics.
 */
export default function ExploreScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { width, gutter, columns } = useLayout();

  const [section, setSection] = useState<Section>("themes");
  const [creations, setCreations] = useState<CreationRow[]>([]);
  const [names, setNames] = useState<ColorNameRankingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [publicCreations, ranked] = await Promise.all([
        listPublicCreations(30).catch(() => [] as CreationRow[]),
        fetchTopRankedNames(30).catch(() => [] as ColorNameRankingRow[]),
      ]);
      setCreations(publicCreations);
      setNames(ranked);
    } catch {
      setError("Impossible de charger le contenu partagé.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const themeCardWidth = useMemo(
    () => (width - gutter * 2 - spacing.sm * (Math.min(columns, 2) - 1)) / Math.min(columns, 2),
    [width, gutter, columns],
  );

  return (
    <Screen onRefresh={load} refreshing={loading} contentStyle={styles.content}>
      <Text style={[type.title, { color: theme.text }]}>Explorer</Text>

      <ChipRow>
        <Chip label="Thèmes" selected={section === "themes"} onPress={() => setSection("themes")} />
        <Chip
          label="Créations"
          selected={section === "creations"}
          onPress={() => setSection("creations")}
        />
        <Chip
          label="Noms votés"
          selected={section === "names"}
          onPress={() => setSection("names")}
        />
      </ChipRow>

      {error ? <ErrorBanner message={error} /> : null}

      {section === "themes" ? (
        <>
          <SectionHeader
            title="Collections thématiques"
            subtitle="Palettes composées par ColorLens, pas des tendances mesurées"
          />
          <View style={styles.grid}>
            {THEMES.map((entry) => {
              const issues = themeAccessibilityIssues(entry);
              return (
                <Card
                  key={entry.id}
                  padded={false}
                  style={{ width: themeCardWidth }}
                  onPress={() =>
                    router.push({ pathname: "/objects", params: { hex: entry.colors[2] } })
                  }
                  accessibilityLabel={`Thème ${entry.label}`}
                >
                  <View style={styles.themeStrip}>
                    {entry.colors.map((hex) => (
                      <View key={hex} style={[styles.themeStep, { backgroundColor: hex }]} />
                    ))}
                  </View>
                  <View style={styles.themeCaption}>
                    <Text style={[type.subheading, { color: theme.text }]} numberOfLines={1}>
                      {entry.label}
                    </Text>
                    <Text style={[type.caption, { color: theme.subtext }]} numberOfLines={2}>
                      {entry.description}
                    </Text>
                    <Text style={[type.caption, { color: theme.subtext }]}>
                      Lecture mesurée : {MOOD_LABEL_FR[themeMood(entry)]}
                    </Text>
                    {issues.length > 0 ? (
                      // Shown, not hidden: the app warns about generated
                      // palettes that confuse, so it must be as honest about
                      // its own.
                      <Text style={[type.caption, { color: theme.warning }]} numberOfLines={2}>
                        {issues.length} paire{issues.length > 1 ? "s" : ""} proche
                        {issues.length > 1 ? "s" : ""} en vision daltonienne
                      </Text>
                    ) : null}
                  </View>
                </Card>
              );
            })}
          </View>
        </>
      ) : null}

      {section === "creations" ? (
        <>
          <SectionHeader title="Créations publiques" subtitle="Partagées par les utilisateurs" />
          {loading ? <StateView kind="loading" /> : null}
          {!loading && creations.length === 0 ? (
            <StateView
              kind="empty_list"
              message="Aucune création publique pour l'instant. Les tendances et les créateurs populaires apparaîtront ici quand il y aura des utilisateurs — on ne fabriquera pas de chiffres en attendant."
              onAlternative={() => router.push("/objects")}
              alternativeLabel="Créer la première"
            />
          ) : null}
          {creations.map((creation) => (
            <PublicCreationCard
              key={creation.id}
              creation={creation}
              width={width - gutter * 2}
              onPress={() =>
                router.push({ pathname: "/creations/[id]", params: { id: creation.id } })
              }
            />
          ))}
        </>
      ) : null}

      {section === "names" ? (
        <>
          <SectionHeader
            title="Noms de couleurs votés"
            subtitle="Proposés par la communauté, modérés puis classés"
          />
          {loading ? <StateView kind="loading" /> : null}
          {!loading && names.length === 0 ? (
            <StateView
              kind="empty_list"
              message="Aucun nom approuvé pour l'instant. Scanne une couleur et propose-lui un nom."
              onAlternative={() => router.push("/(tabs)/scan")}
              alternativeLabel="Scanner une couleur"
            />
          ) : null}
          {names.map((entry) => (
            <Card key={entry.color_name_id}>
              <View style={styles.nameRow}>
                <View style={[styles.swatch, { backgroundColor: entry.hex }]} />
                <View style={styles.rowText}>
                  <Text style={[type.subheading, { color: theme.text }]} numberOfLines={1}>
                    {entry.name}
                  </Text>
                  <Text style={[type.caption, styles.mono, { color: theme.subtext }]}>
                    {entry.hex.toUpperCase()} · {FAMILY_LABEL_FR[entry.family]}
                  </Text>
                </View>
                <Text style={[type.label, { color: theme.subtext }]}>
                  {entry.score > 0 ? `+${entry.score}` : entry.score}
                </Text>
              </View>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function PublicCreationCard({
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
        <ObjectCanvas model={model} project={project} width={width} height={Math.round(width * 0.58)} />
      ) : null}
      <View style={styles.themeCaption}>
        <Text style={[type.subheading, { color: theme.text }]} numberOfLines={1}>
          {creation.name}
        </Text>
        {creation.tags.length > 0 ? (
          <Text style={[type.caption, { color: theme.subtext }]} numberOfLines={1}>
            {creation.tags.map((tag) => `#${tag}`).join(" ")}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  themeStrip: { flexDirection: "row", height: 72 },
  themeStep: { flex: 1 },
  themeCaption: { padding: spacing.md, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  swatch: { width: 40, height: 40, borderRadius: radius.md },
  rowText: { flex: 1, gap: 2 },
  mono: { fontFamily: monoFontFamily },
});
