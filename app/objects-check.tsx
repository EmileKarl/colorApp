import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card, SectionHeader } from "../src/components/Card";
import { Chip, ChipRow } from "../src/components/Chip";
import { Screen } from "../src/components/Screen";
import { ALL_LIGHTINGS, ALL_MATERIALS } from "../src/domain/materials";
import { BUILTIN_OBJECTS } from "../src/objects/models";
import { applyColor, createProject, setZone } from "../src/objects/project";
import { ObjectCanvas } from "../src/objects/renderer/ObjectCanvas";
import type { LightingId, MaterialId, ProjectData } from "../src/objects/types";
import { monoFontFamily, spacing, type, useLayout, useTheme } from "../src/theme";

/**
 * Skia verification screen.
 *
 * This exists because nothing in this project has ever run on a real device.
 * Before the Studio is built on top of Skia it is worth five minutes to
 * confirm, on an actual iPhone, that: the canvas renders at all inside Expo
 * Go; recoloring is instant rather than janky; and the shading reads as volume
 * rather than as flat shapes.
 *
 * If Skia does not hold up here, that is far cheaper to discover now than
 * after the Studio, the variants and the before/after comparison are built on
 * it. Reachable from Profil.
 */

const TEST_COLORS = ["#c4302b", "#0047ab", "#f2c200", "#1e824c", "#7a3fbf", "#111111", "#f5f3ee"];

export default function ObjectsCheckScreen() {
  const theme = useTheme();
  const { width, gutter } = useLayout();
  const [color, setColor] = useState(TEST_COLORS[0]);
  const [lighting, setLighting] = useState<LightingId>("studio");
  const [bodyMaterial, setBodyMaterial] = useState<MaterialId | null>(null);

  const canvasWidth = Math.min(width - gutter * 2 - spacing.md * 2, 520);
  const canvasHeight = Math.round(canvasWidth * 0.72);

  const projects = useMemo<Record<string, ProjectData>>(() => {
    const result: Record<string, ProjectData> = {};
    for (const model of BUILTIN_OBJECTS) {
      let project = applyColor(createProject(model, { lighting }), model, color);
      if (bodyMaterial) {
        const body = model.zones.find((zone) => zone.role === "body");
        // Materials are per-zone and constrained per zone, so a material that
        // makes no sense for this object's body is simply skipped rather than
        // forced on it.
        if (body && (!body.allowedMaterials || body.allowedMaterials.includes(bodyMaterial))) {
          project = setZone(project, body.id, { material: bodyMaterial });
        }
      }
      result[model.id] = project;
    }
    return result;
  }, [color, lighting, bodyMaterial]);

  return (
    <Screen contentStyle={styles.content}>
      <Text style={[type.body, { color: theme.subtext }]}>
        Écran de vérification : change la couleur, le matériau et l’éclairage. Ce qu’il faut
        regarder — le rendu doit être immédiat, et l’objet doit garder son volume (ombres et
        reflets) quelle que soit la couleur.
      </Text>

      <View style={styles.section}>
        <SectionHeader title="Couleur" />
        <ChipRow>
          {TEST_COLORS.map((entry) => (
            <Chip
              key={entry}
              label={entry.toUpperCase()}
              swatch={entry}
              selected={entry === color}
              onPress={() => setColor(entry)}
            />
          ))}
        </ChipRow>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Matériau du corps" />
        <ChipRow>
          <Chip label="Par défaut" selected={bodyMaterial === null} onPress={() => setBodyMaterial(null)} />
          {ALL_MATERIALS.map((entry) => (
            <Chip
              key={entry.id}
              label={entry.label}
              selected={entry.id === bodyMaterial}
              onPress={() => setBodyMaterial(entry.id)}
            />
          ))}
        </ChipRow>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Éclairage" />
        <ChipRow>
          {ALL_LIGHTINGS.map((entry) => (
            <Chip
              key={entry.id}
              label={entry.label}
              selected={entry.id === lighting}
              onPress={() => setLighting(entry.id)}
            />
          ))}
        </ChipRow>
      </View>

      {BUILTIN_OBJECTS.map((model) => (
        <Card key={model.id} padded={false}>
          <ObjectCanvas
            model={model}
            project={projects[model.id]}
            width={canvasWidth}
            height={canvasHeight}
          />
          <View style={styles.caption}>
            <Text style={[type.subheading, { color: theme.text }]}>{model.name}</Text>
            <Text style={[type.caption, styles.mono, { color: theme.subtext }]}>
              {model.zones.length} zones · {model.kind}
            </Text>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  section: { gap: spacing.xs },
  caption: { padding: spacing.md, gap: 2 },
  mono: { fontFamily: monoFontFamily },
});
