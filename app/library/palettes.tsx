import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { EmptyState } from "../../src/components/EmptyState";
import { PaletteStrip } from "../../src/components/PaletteStrip";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { useRecentColors } from "../../src/context/RecentColorsContext";
import { hexToRgb } from "../../src/lib/color";
import {
  ALL_PALETTE_STYLES,
  PALETTE_SIZES,
  PALETTE_STYLE_LABELS,
  formatPalette,
  generatePalette,
  type PaletteStyle,
} from "../../src/domain/palette";
import { MOOD_LABEL_FR, USE_LABEL_FR, paletteMoods, suggestedUses } from "../../src/domain/paletteMood";
import { buildColorStory } from "../../src/domain/colorStory";
import { useRouter } from "expo-router";
import { ExportSheet } from "../../src/components/ExportSheet";
import { spacing, type, useTheme } from "../../src/theme";

/** Shown until the user has scanned anything, so the screen is never empty. */
const FALLBACK_BASE = "#c47a52";

export default function PalettesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { colors: recent } = useRecentColors();

  const [baseHex, setBaseHex] = useState<string | null>(null);
  const [style, setStyle] = useState<PaletteStyle>("modern");
  const [size, setSize] = useState<(typeof PALETTE_SIZES)[number]>(5);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const activeBase = baseHex ?? recent[0]?.hex ?? FALLBACK_BASE;

  const palette = useMemo(
    () => generatePalette(hexToRgb(activeBase), style, size),
    [activeBase, style, size],
  );

  const hexes = useMemo(() => palette.swatches.map((swatch) => swatch.hex), [palette]);

  // The aesthetic reading and the suggested uses of page 7. Both are scored
  // from the palette's own measurements, never invented — see
  // src/domain/paletteMood.ts for why that distinction matters.
  const moods = useMemo(() => paletteMoods(hexes), [hexes]);
  const uses = useMemo(() => suggestedUses(hexes), [hexes]);
  const story = useMemo(() => buildColorStory(hexes), [hexes]);

  const onCopy = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await Clipboard.setStringAsync(formatPalette(palette, "hex"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Palettes</Text>
        <Text style={[styles.subtitle, { color: theme.subtext }]}>
          Générées à partir d&apos;une couleur de base, en espace perceptuel.
        </Text>
      </View>

      <Section title="Couleur de base" theme={theme}>
        {recent.length === 0 ? (
          <Text style={[styles.hint, { color: theme.subtext }]}>
            Scanne une couleur pour l&apos;utiliser ici. En attendant, voici un exemple.
          </Text>
        ) : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.row}>
            {(recent.length > 0 ? recent.map((r) => r.hex) : [FALLBACK_BASE]).map((hex) => {
              const active = hex === activeBase;
              return (
                <Pressable
                  key={hex}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setBaseHex(hex);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Utiliser ${hex} comme couleur de base`}
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.baseSwatch,
                    {
                      backgroundColor: hex,
                      borderColor: active ? theme.accent : theme.border,
                      borderWidth: active ? 3 : StyleSheet.hairlineWidth,
                    },
                  ]}
                />
              );
            })}
          </View>
        </ScrollView>
      </Section>

      <Section title="Style" theme={theme}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.row}>
            {ALL_PALETTE_STYLES.map((option) => (
              <Chip
                key={option}
                label={PALETTE_STYLE_LABELS[option]}
                active={option === style}
                onPress={() => {
                  Haptics.selectionAsync();
                  setStyle(option);
                }}
                theme={theme}
              />
            ))}
          </View>
        </ScrollView>
      </Section>

      <Section title="Nombre de couleurs" theme={theme}>
        <View style={styles.row}>
          {PALETTE_SIZES.map((option) => (
            <Chip
              key={option}
              label={String(option)}
              active={option === size}
              onPress={() => {
                Haptics.selectionAsync();
                setSize(option);
              }}
              theme={theme}
            />
          ))}
        </View>
      </Section>

      <PaletteStrip palette={palette} />

      {palette.description ? (
        <Text style={[styles.hint, { color: theme.subtext }]}>{palette.description}</Text>
      ) : null}

      <Text style={[styles.metric, { color: theme.subtext }]}>
        Écart perceptuel minimal entre deux couleurs : {palette.minSeparation} ΔE00
      </Text>

      {palette.accessibilityIssues.length > 0 ? (
        <View style={[styles.warning, { borderColor: theme.border }]}>
          <Text style={[styles.warningTitle, { color: theme.text }]}>
            Accessibilité : {palette.accessibilityIssues.length} paire
            {palette.accessibilityIssues.length > 1 ? "s" : ""} à risque
          </Text>
          {palette.accessibilityIssues.slice(0, 3).map((issue) => (
            <Text
              key={`${issue.type}-${issue.pair[0]}-${issue.pair[1]}`}
              style={[styles.warningText, { color: theme.subtext }]}
            >
              • Couleurs {issue.pair[0] + 1} et {issue.pair[1] + 1} se confondent en{" "}
              {issue.label.toLowerCase()} ({issue.deltaE} ΔE00)
            </Text>
          ))}
        </View>
      ) : (
        <Text style={[styles.metric, { color: theme.success }]}>
          Palette distinguable sous toutes les déficiences visuelles simulées.
        </Text>
      )}

      <Text style={[styles.sectionTitle, { color: theme.text }]}>Interprétation</Text>
      <View style={styles.chipWrap}>
        {/* Read-only badges, not chips: these are a reading of the palette,
            not a control. §13 forbids anything that looks pressable but is not. */}
        {moods.slice(0, 3).map((entry, index) => (
          <View
            key={entry.mood}
            style={[
              styles.badge,
              {
                backgroundColor: index === 0 ? theme.accent : theme.surface,
                borderColor: theme.border,
              },
            ]}
          >
            <Text
              style={[type.label, { color: index === 0 ? theme.onAccent : theme.subtext }]}
            >
              {MOOD_LABEL_FR[entry.mood]}
            </Text>
          </View>
        ))}
      </View>
      {moods[0] ? (
        <Text style={[styles.hint, { color: theme.subtext }]}>
          {moods[0].reason} Cette lecture vient des mesures de la palette, pas d’une
          impression : tu peux ne pas être d’accord avec le raisonnement.
        </Text>
      ) : null}

      {uses.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Usages suggérés</Text>
          {uses.map((entry) => (
            <Text key={entry.use} style={[styles.metric, { color: theme.subtext }]}>
              • <Text style={{ color: theme.text }}>{USE_LABEL_FR[entry.use]}</Text> — {entry.reason}
            </Text>
          ))}
        </>
      ) : null}

      {story ? (
        <>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Color Story</Text>
          <Text style={[type.body, { color: theme.subtext }]}>{story.description}</Text>
          <Text style={[styles.metric, { color: theme.subtext }]}>
            Matériaux adaptés : {story.materials.join(", ")}
          </Text>
        </>
      ) : null}

      <PrimaryButton
        label="Appliquer cette palette à un objet"
        icon="cube-outline"
        onPress={() => router.push({ pathname: "/objects", params: { hex: activeBase } })}
      />

      <PrimaryButton
        label="Exporter"
        icon="share-outline"
        variant="secondary"
        onPress={() => setExporting(true)}
      />

      <PrimaryButton
        label={copied ? "Copiée ✓" : "Copier la palette"}
        onPress={onCopy}
        variant="secondary"
      />

      <ExportSheet
        visible={exporting}
        onClose={() => setExporting(false)}
        palette={{
          name: `${PALETTE_STYLE_LABELS[style]} ${size}`,
          colors: palette.swatches.map((swatch, index) => ({
            hex: swatch.hex,
            role: index === 0 ? "dominant" : index === palette.swatches.length - 1 ? "accent" : null,
          })),
        }}
      />

      {recent.length === 0 ? (
        <EmptyState
          title="Aucune couleur scannée"
          subtitle="Les palettes seront générées à partir de tes propres scans."
        />
      ) : null}
    </ScrollView>
  );
}

function Section({
  title,
  theme,
  children,
}: {
  title: string;
  theme: ReturnType<typeof useTheme>;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  theme,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.chip,
        {
          backgroundColor: active ? theme.accent : theme.surface,
          borderColor: theme.border,
        },
      ]}
    >
      <Text style={{ color: active ? theme.background : theme.text, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  header: { gap: 4 },
  title: { fontSize: 26, fontWeight: "700" },
  subtitle: { fontSize: 13 },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  row: { flexDirection: "row", gap: spacing.xs, flexWrap: "wrap" },
  baseSwatch: { width: 48, height: 48, borderRadius: 14, marginRight: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: spacing.xs,
  },
  hint: { fontSize: 12, lineHeight: 17 },
  metric: { fontSize: 12 },
  warning: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: spacing.md,
    gap: 4,
  },
  warningTitle: { fontSize: 13, fontWeight: "700" },
  warningText: { fontSize: 12, lineHeight: 17 },
});
