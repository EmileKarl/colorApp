import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card, SectionHeader } from "../../src/components/Card";
import { Chip } from "../../src/components/Chip";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Screen } from "../../src/components/Screen";
import { StateView } from "../../src/components/StateView";
import { MATERIALS } from "../../src/domain/materials";
import { useRecentObjects } from "../../src/hooks/useRecentObjects";
import { loadObject } from "../../src/lib/objectApi";
import { CATEGORY_ICON, CATEGORY_LABEL_FR } from "../../src/objects/models";
import { applyColor, createProject } from "../../src/objects/project";
import { ObjectCanvas } from "../../src/objects/renderer/ObjectCanvas";
import type { ObjectModel } from "../../src/objects/types";
import { radius, spacing, type, useLayout, useTheme } from "../../src/theme";

type IconName = keyof typeof Ionicons.glyphMap;

/** Object detail — ColorLens page 10. */
export default function ObjectDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { width, gutter } = useLayout();
  const { id, hex } = useLocalSearchParams<{ id: string; hex?: string }>();
  const { rememberObject } = useRecentObjects();

  const [model, setModel] = useState<ObjectModel | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let cancelled = false;
    loadObject(id)
      .then((result) => {
        if (cancelled) return;
        setModel(result);
        setStatus(result ? "ready" : "missing");
      })
      .catch(() => {
        if (!cancelled) setStatus("missing");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const project = useMemo(() => {
    if (!model) return null;
    const base = createProject(model);
    return hex ? applyColor(base, model, hex) : base;
  }, [model, hex]);

  if (status === "loading") {
    return (
      <Screen center>
        <StateView kind="loading" />
      </Screen>
    );
  }

  if (status === "missing" || !model || !project) {
    return (
      <Screen center>
        <StateView
          kind="object_unavailable"
          onRetry={() => router.replace({ pathname: "/objects/[id]", params: { id, hex } })}
          onAlternative={() => router.replace({ pathname: "/objects", params: { hex } })}
          alternativeLabel="Choisir un autre objet"
        />
      </Screen>
    );
  }

  const canvasWidth = Math.min(width - gutter * 2, 520);
  const materials = new Set(
    model.zones.flatMap((zone) => zone.allowedMaterials ?? [zone.defaultMaterial]),
  );

  const openStudio = () => {
    rememberObject(model.id);
    router.push({ pathname: "/studio/[id]", params: { id: model.id, hex } });
  };

  return (
    <Screen
      contentStyle={styles.content}
      footer={<PrimaryButton label="Utiliser ce modèle" icon="color-wand-outline" onPress={openStudio} />}
    >
      <Card padded={false}>
        <ObjectCanvas
          model={model}
          project={project}
          width={canvasWidth}
          height={Math.round(canvasWidth * 0.75)}
        />
      </Card>

      <View style={styles.header}>
        <Text style={[type.title, { color: theme.text }]}>{model.name}</Text>
        <View style={styles.metaRow}>
          <Chip
            label={CATEGORY_LABEL_FR[model.category]}
            icon={CATEGORY_ICON[model.category] as IconName}
          />
          <Chip label={model.kind === "vector" ? "Vectoriel · hors ligne" : "Photographique"} />
          <Chip label={model.model3dUrl ? "3D disponible" : "2D"} />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader
          title="Zones personnalisables"
          subtitle={`${model.zones.length} zones que tu peux colorer séparément`}
        />
        {model.zones.map((zone) => (
          <View
            key={zone.id}
            style={[styles.zoneRow, { borderColor: theme.border, backgroundColor: theme.surface }]}
          >
            <View style={[styles.zoneSwatch, { backgroundColor: zone.defaultColor }]} />
            <View style={styles.zoneText}>
              <Text style={[type.subheading, { color: theme.text }]} numberOfLines={1}>
                {zone.label}
              </Text>
              <Text style={[type.caption, { color: theme.subtext }]} numberOfLines={1}>
                {MATERIALS[zone.defaultMaterial].label}
                {zone.allowedMaterials && zone.allowedMaterials.length > 1
                  ? ` · ${zone.allowedMaterials.length} matériaux possibles`
                  : ""}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Matériaux disponibles" />
        <View style={styles.metaRow}>
          {[...materials].map((entry) => (
            <Chip key={entry} label={MATERIALS[entry].label} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Vues" />
        <Text style={[type.body, { color: theme.subtext }]}>
          {model.views.length > 0
            ? model.views.join(" · ")
            : "Une seule vue pour ce modèle. La rotation 360° arrivera avec les modèles 3D."}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  header: { gap: spacing.sm },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  section: { gap: spacing.sm },
  zoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  zoneSwatch: { width: 32, height: 32, borderRadius: radius.sm },
  zoneText: { flex: 1, gap: 2 },
});
