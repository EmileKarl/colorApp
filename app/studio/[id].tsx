import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ViewShot, { type ViewShotRef } from "react-native-view-shot";

import { Chip, ChipRow } from "../../src/components/Chip";
import { ErrorBanner } from "../../src/components/ErrorBanner";
import { Field } from "../../src/components/Field";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { Sheet } from "../../src/components/Sheet";
import { Slider } from "../../src/components/Slider";
import { StateView } from "../../src/components/StateView";
import { useRecentColors } from "../../src/context/RecentColorsContext";
import { BeforeAfter } from "../../src/components/BeforeAfter";
import { ALL_LIGHTINGS, MATERIALS } from "../../src/domain/materials";
import {
  ADJUSTMENTS,
  VARIANTS,
  applyAdjustment,
  applyVariant,
  sourceColorOf,
} from "../../src/domain/variants";
import { generatePalette } from "../../src/domain/palette";
import { useUndoable } from "../../src/hooks/useUndoable";
import { hexToRgb, isValidHex, normalizeHex } from "../../src/lib/color";
import { getCreation } from "../../src/lib/creationApi";
import { loadObject } from "../../src/lib/objectApi";
import {
  applyColor,
  applyPalette,
  createProject,
  parseProject,
  resetProject,
  setZone,
} from "../../src/objects/project";
import { ObjectCanvas } from "../../src/objects/renderer/ObjectCanvas";
import type { LightingId, MaterialId, ObjectModel, ProjectData } from "../../src/objects/types";
import { monoFontFamily, radius, spacing, type, useLayout, useTheme } from "../../src/theme";

type Panel = "color" | "variant" | "zone" | "material" | "render";

/**
 * Color Studio — ColorLens pages 11, 12 and 13.
 *
 * The layout follows the spec's own description: a top bar, a large preview,
 * and a tool area underneath. The tool area is a single panel that switches
 * rather than a stack of collapsible sections, because the preview is the
 * point — every pixel spent on permanently-visible controls is a pixel not
 * spent on the thing the user is judging.
 *
 * Editing goes through `useUndoable`, so undo and redo cover every change
 * including slider drags, which coalesce into one history entry per drag.
 */
export default function StudioScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, gutter } = useLayout();
  const { id, hex, creation: creationId } = useLocalSearchParams<{
    id: string;
    hex?: string;
    creation?: string;
  }>();
  const { colors: recentColors } = useRecentColors();
  const shotRef = useRef<ViewShotRef>(null);

  const [model, setModel] = useState<ObjectModel | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing">("loading");
  const [panel, setPanel] = useState<Panel>("color");
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hexDraft, setHexDraft] = useState("");
  const [showLighting, setShowLighting] = useState(false);
  const [comparing, setComparing] = useState(false);
  /**
   * The state the Studio opened with, kept for the before/after comparison
   * (page 17). It is the baseline the user is actually asking about — "what
   * did this look like before I started" — rather than the immediately
   * previous edit, which is what undo already covers.
   */
  const [baseline, setBaseline] = useState<ProjectData | null>(null);

  const history = useUndoable<ProjectData | null>(null);
  const project = history.state;

  useEffect(() => {
    let cancelled = false;

    async function open() {
      const result = await loadObject(id);
      if (cancelled) return;
      if (!result) {
        setStatus("missing");
        return;
      }

      let opening = createProject(result);
      if (creationId) {
        // Reopening a saved creation. A stored project that cannot be parsed
        // falls back to a fresh one rather than failing the whole screen —
        // the user keeps the object, and loses only the old edits.
        try {
          const creation = await getCreation(creationId);
          const restored = creation ? parseProject(creation.project_data, result) : null;
          if (restored) opening = restored;
        } catch {
          // Offline, or the row is gone. A fresh project is still usable.
        }
      } else if (hex && isValidHex(hex)) {
        opening = applyColor(opening, result, hex);
      }

      if (cancelled) return;
      history.reset(opening);
      setBaseline(opening);
      setModel(result);
      setSelectedZone(result.zones.find((zone) => zone.role === "body")?.id ?? result.zones[0].id);
      setStatus("ready");
    }

    open().catch(() => {
      if (!cancelled) setStatus("missing");
    });

    return () => {
      cancelled = true;
    };
    // `history.reset` is stable; re-running on it would reload the model and
    // discard the user's edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, hex, creationId]);

  const edit = useCallback(
    (update: (current: ProjectData) => ProjectData, coalesce?: string) => {
      history.set((current) => (current ? update(current) : current), coalesce);
    },
    [history],
  );

  /**
   * The palette the "Palette" action applies: harmonies generated from the
   * currently selected zone's color, so it always relates to what the user is
   * looking at rather than to some earlier state.
   */
  const suggestedPalette = useMemo(() => {
    if (!project || !selectedZone) return [];
    const source = project.zones[selectedZone]?.color;
    if (!source || !isValidHex(source)) return [];
    return generatePalette(hexToRgb(source), "modern", 5).swatches.map((swatch) => swatch.hex);
  }, [project, selectedZone]);

  if (status === "loading") {
    return <StateView kind="loading" />;
  }

  if (status === "missing" || !model || !project) {
    return (
      <StateView
        kind="object_unavailable"
        onRetry={() => router.replace({ pathname: "/studio/[id]", params: { id, hex } })}
        onAlternative={() => router.replace({ pathname: "/objects", params: { hex } })}
        alternativeLabel="Choisir un autre objet"
      />
    );
  }

  const zone = selectedZone ? model.zones.find((entry) => entry.id === selectedZone) : undefined;
  const zoneState = selectedZone ? project.zones[selectedZone] : undefined;
  const canvasWidth = Math.min(width - gutter * 2, 520);
  const canvasHeight = Math.round(canvasWidth * 0.72);

  const applyToZone = (color: string) => {
    if (!selectedZone) return;
    Haptics.selectionAsync();
    edit((current) => setZone(current, selectedZone, { color: normalizeHex(color) }));
  };

  const onExport = async () => {
    setError(null);
    try {
      const uri = await shotRef.current?.capture();
      if (!uri) return;
      const Sharing = await import("expo-sharing");
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    } catch {
      setError("L’export a échoué sur cet appareil.");
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {/* Top bar (page 11): back, model name, undo/redo, reset. */}
      <View style={[styles.topBar, { paddingHorizontal: gutter, borderBottomColor: theme.border }]}>
        <IconButton icon="chevron-back" label="Retour" onPress={() => router.back()} />
        <Text style={[type.subheading, styles.title, { color: theme.text }]} numberOfLines={1}>
          {model.name}
        </Text>
        <IconButton
          icon="arrow-undo-outline"
          label="Annuler"
          onPress={history.undo}
          disabled={!history.canUndo}
        />
        <IconButton
          icon="arrow-redo-outline"
          label="Rétablir"
          onPress={history.redo}
          disabled={!history.canRedo}
        />
        <IconButton
          icon={comparing ? "contract-outline" : "git-compare-outline"}
          label={comparing ? "Quitter la comparaison" : "Comparer avant/après"}
          onPress={() => setComparing((previous) => !previous)}
        />
        <IconButton
          icon="refresh-outline"
          label="Réinitialiser"
          onPress={() => edit((current) => resetProject(current, model))}
        />
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingHorizontal: gutter }]}>
        {comparing && baseline ? (
          <BeforeAfter
            width={canvasWidth}
            height={canvasHeight}
            before={
              <ObjectCanvas model={model} project={baseline} width={canvasWidth} height={canvasHeight} />
            }
            after={
              <ObjectCanvas model={model} project={project} width={canvasWidth} height={canvasHeight} />
            }
          />
        ) : (
          <ViewShot ref={shotRef} options={{ format: "png", quality: 1 }}>
            <ObjectCanvas
              model={model}
              project={project}
              width={canvasWidth}
              height={canvasHeight}
              emphasizeZone={panel === "zone" ? (selectedZone ?? undefined) : undefined}
            />
          </ViewShot>
        )}

        {error ? <ErrorBanner message={error} /> : null}

        {/* Panel switch. Labelled, not icon-only: §5 forbids conveying
            information by one channel alone. */}
        <View style={[styles.tabs, { backgroundColor: theme.surfaceAlt }]}>
          {(
            [
              ["color", "Couleur"],
              ["variant", "Variantes"],
              ["zone", "Zones"],
              ["material", "Matériau"],
              ["render", "Rendu"],
            ] as [Panel, string][]
          ).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => setPanel(value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: panel === value }}
              style={[
                styles.tab,
                panel === value && { backgroundColor: theme.surface },
              ]}
            >
              <Text
                style={[type.label, { color: panel === value ? theme.text : theme.subtext }]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {panel === "color" ? (
          <View style={styles.panel}>
            <Text style={[type.caption, { color: theme.subtext }]}>
              La couleur s’applique à la zone « {zone?.label ?? "—"} ».
            </Text>

            {recentColors.length > 0 ? (
              <>
                <Text style={[type.label, { color: theme.text }]}>Couleurs capturées</Text>
                <ChipRow>
                  {recentColors.map((entry) => (
                    <Chip
                      key={entry.hex}
                      label={entry.hex.toUpperCase()}
                      swatch={entry.hex}
                      selected={zoneState?.color === entry.hex}
                      onPress={() => applyToZone(entry.hex)}
                    />
                  ))}
                </ChipRow>
              </>
            ) : (
              <Text style={[type.caption, { color: theme.subtext }]}>
                Scanne une couleur pour la retrouver ici.
              </Text>
            )}

            <Text style={[type.label, { color: theme.text }]}>Harmonies de cette zone</Text>
            <ChipRow>
              {suggestedPalette.map((entry) => (
                <Chip key={entry} label={entry.toUpperCase()} swatch={entry} onPress={() => applyToZone(entry)} />
              ))}
            </ChipRow>
            <PrimaryButton
              label="Appliquer cette palette à tout l’objet"
              icon="color-filter-outline"
              variant="secondary"
              size="sm"
              onPress={() => edit((current) => applyPalette(current, model, suggestedPalette))}
            />

            <Field
              label="Code hexadécimal"
              placeholder="#0047AB"
              value={hexDraft}
              onChangeText={setHexDraft}
              autoCapitalize="none"
              autoCorrect={false}
              invalid={hexDraft.length > 0 && !isValidHex(hexDraft)}
              hint={
                hexDraft.length > 0 && !isValidHex(hexDraft)
                  ? "Six caractères hexadécimaux, par exemple #0047AB."
                  : undefined
              }
              onSubmitEditing={() => {
                if (isValidHex(hexDraft)) applyToZone(hexDraft);
              }}
            />
          </View>
        ) : null}

        {panel === "variant" ? (
          <View style={styles.panel}>
            <Text style={[type.caption, { color: theme.subtext }]}>
              Chaque variante recolore les zones existantes à partir de ta couleur. La forme,
              les volumes et les matériaux ne changent jamais.
            </Text>
            <View style={styles.wrap}>
              {VARIANTS.map((entry) => (
                <Chip
                  key={entry.id}
                  label={entry.label}
                  selected={project.variant === entry.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    edit((current) =>
                      applyVariant(current, model, entry, sourceColorOf(current, model)),
                    );
                  }}
                />
              ))}
            </View>
            <Text style={[type.caption, { color: theme.subtext }]}>
              {VARIANTS.find((entry) => entry.id === project.variant)?.description ??
                "Choisis une variante, ou ajuste ce que tu as déjà."}
            </Text>

            <Text style={[type.label, { color: theme.text }]}>Ajuster</Text>
            <View style={styles.wrap}>
              {ADJUSTMENTS.map((entry) => (
                <Chip
                  key={entry.id}
                  label={entry.label}
                  onPress={() => {
                    Haptics.selectionAsync();
                    edit((current) => applyAdjustment(current, model, entry));
                  }}
                />
              ))}
            </View>
            <Text style={[type.caption, { color: theme.subtext }]}>
              Les ajustements se cumulent : appuie deux fois pour aller deux fois plus loin.
            </Text>
          </View>
        ) : null}

        {panel === "zone" ? (
          <View style={styles.panel}>
            <Text style={[type.caption, { color: theme.subtext }]}>
              Touche une zone pour la sélectionner. Les autres sont estompées dans l’aperçu.
            </Text>
            {model.zones.map((entry) => {
              const state = project.zones[entry.id];
              const selected = entry.id === selectedZone;
              return (
                <Pressable
                  key={entry.id}
                  onPress={() => setSelectedZone(entry.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${entry.label}, ${state?.color ?? ""}`}
                  style={[
                    styles.zoneRow,
                    {
                      borderColor: selected ? theme.accent : theme.border,
                      backgroundColor: theme.surface,
                    },
                  ]}
                >
                  <View style={[styles.zoneSwatch, { backgroundColor: state?.color }]} />
                  <View style={styles.zoneText}>
                    <Text style={[type.subheading, { color: theme.text }]} numberOfLines={1}>
                      {entry.label}
                    </Text>
                    <Text style={[type.caption, styles.mono, { color: theme.subtext }]} numberOfLines={1}>
                      {state?.color.toUpperCase()} · {MATERIALS[state?.material ?? entry.defaultMaterial].label}
                    </Text>
                  </View>
                  {selected ? <Ionicons name="checkmark" size={18} color={theme.accent} /> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {panel === "material" && zone && zoneState ? (
          <View style={styles.panel}>
            <Text style={[type.caption, { color: theme.subtext }]}>
              Matériau de la zone « {zone.label} ».
            </Text>
            <View style={styles.wrap}>
              {(zone.allowedMaterials ?? (Object.keys(MATERIALS) as MaterialId[])).map((entry) => (
                <Chip
                  key={entry}
                  label={MATERIALS[entry].label}
                  selected={zoneState.material === entry}
                  onPress={() => edit((current) => setZone(current, zone.id, { material: entry }))}
                />
              ))}
            </View>
            <Slider
              label="Opacité"
              value={zoneState.opacity}
              onChange={(value) =>
                edit((current) => setZone(current, zone.id, { opacity: value }), `opacity-${zone.id}`)
              }
              format={(value) => `${Math.round(value * 100)} %`}
              accentColor={zoneState.color}
            />
          </View>
        ) : null}

        {panel === "render" ? (
          <View style={styles.panel}>
            <PrimaryButton
              label={`Éclairage : ${ALL_LIGHTINGS.find((entry) => entry.id === project.lighting)?.label}`}
              icon="sunny-outline"
              variant="secondary"
              size="sm"
              onPress={() => setShowLighting(true)}
            />
            <Slider
              label="Ombres"
              value={project.render.shadows}
              onChange={(value) => edit((c) => ({ ...c, render: { ...c.render, shadows: value } }), "shadows")}
              format={(value) => `${Math.round(value * 100)} %`}
            />
            <Slider
              label="Brillance"
              value={project.render.gloss}
              onChange={(value) => edit((c) => ({ ...c, render: { ...c.render, gloss: value } }), "gloss")}
              format={(value) => `${Math.round(value * 100)} %`}
            />
            <Slider
              label="Rugosité"
              value={project.render.roughness}
              onChange={(value) => edit((c) => ({ ...c, render: { ...c.render, roughness: value } }), "roughness")}
              format={(value) => `${Math.round(value * 100)} %`}
            />
            <Slider
              label="Intensité lumineuse"
              value={project.render.lightIntensity}
              onChange={(value) =>
                edit((c) => ({ ...c, render: { ...c.render, lightIntensity: value } }), "intensity")
              }
              format={(value) => `${Math.round(value * 100)} %`}
            />
            <Slider
              label="Contraste"
              value={project.render.contrast}
              min={-1}
              max={1}
              onChange={(value) => edit((c) => ({ ...c, render: { ...c.render, contrast: value } }), "contrast")}
              format={(value) => (value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2))}
            />
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingHorizontal: gutter,
            paddingBottom: insets.bottom + spacing.sm,
            backgroundColor: theme.surface,
            borderTopColor: theme.border,
          },
        ]}
      >
        <View style={styles.footerButton}>
          <PrimaryButton label="Exporter" icon="share-outline" variant="secondary" onPress={onExport} />
        </View>
        <View style={styles.footerButton}>
          <PrimaryButton
            label="Enregistrer"
            icon="bookmark-outline"
            onPress={() =>
              router.push({
                pathname: "/studio/save",
                params: { id: model.id, project: JSON.stringify(project) },
              })
            }
          />
        </View>
      </View>

      <Sheet
        visible={showLighting}
        onClose={() => setShowLighting(false)}
        title="Éclairage"
        subtitle="La lumière colore les reflets, jamais la couleur de l’objet elle-même."
      >
        {ALL_LIGHTINGS.map((entry) => (
          <Pressable
            key={entry.id}
            onPress={() => {
              edit((current) => ({ ...current, lighting: entry.id as LightingId }));
              setShowLighting(false);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: project.lighting === entry.id }}
            style={[
              styles.zoneRow,
              {
                borderColor: project.lighting === entry.id ? theme.accent : theme.border,
                backgroundColor: theme.surface,
              },
            ]}
          >
            <View style={[styles.zoneSwatch, { backgroundColor: entry.color }]} />
            <View style={styles.zoneText}>
              <Text style={[type.subheading, { color: theme.text }]}>{entry.label}</Text>
              <Text style={[type.caption, { color: theme.subtext }]}>
                Contraste {Math.round(entry.contrast * 100)} %
              </Text>
            </View>
            {project.lighting === entry.id ? (
              <Ionicons name="checkmark" size={18} color={theme.accent} />
            ) : null}
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        styles.iconButton,
        { opacity: disabled ? 0.3 : pressed ? 0.6 : 1 },
      ]}
    >
      <Ionicons name={icon} size={20} color={theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // flex: 1 lets a long model name shrink rather than pushing the undo and
  // redo buttons off the edge — §13 forbids a button being cut off.
  title: { flex: 1 },
  iconButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  body: { gap: spacing.md, paddingVertical: spacing.md, paddingBottom: spacing.xl },
  tabs: { flexDirection: "row", borderRadius: radius.pill, padding: 3 },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  panel: { gap: spacing.sm },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  zoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  zoneSwatch: { width: 34, height: 34, borderRadius: radius.sm },
  zoneText: { flex: 1, gap: 2 },
  mono: { fontFamily: monoFontFamily },
  footer: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerButton: { flex: 1 },
});
