import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { EmptyState } from "../src/components/EmptyState";
import { useRecentColors } from "../src/context/RecentColorsContext";
import { compareColors } from "../src/domain/compare";
import { simulateAll } from "../src/domain/colorVision";
import { hexToRgb, isValidHex, normalizeHex } from "../src/lib/color";
import { spacing, useTheme } from "../src/theme";

/**
 * Compare two colors (spec §9).
 *
 * Reports the components of the difference, not just one number: a designer
 * needs to know *whether* to change lightness or hue, which a single ΔE₀₀
 * cannot say.
 */
export default function CompareScreen() {
  const theme = useTheme();
  const { a } = useLocalSearchParams<{ a?: string }>();
  const { colors: recent } = useRecentColors();

  const initialA = a && isValidHex(a) ? normalizeHex(a) : recent[0]?.hex ?? null;
  const [colorA, setColorA] = useState<string | null>(initialA);
  const [colorB, setColorB] = useState<string | null>(recent[1]?.hex ?? null);
  const [picking, setPicking] = useState<"a" | "b">("b");

  const comparison = useMemo(
    () => (colorA && colorB ? compareColors(hexToRgb(colorA), hexToRgb(colorB)) : null),
    [colorA, colorB],
  );

  const onPick = (hex: string) => {
    Haptics.selectionAsync();
    if (picking === "a") setColorA(hex);
    else setColorB(hex);
  };

  if (recent.length === 0) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <EmptyState
          title="Rien à comparer pour l'instant"
          subtitle="Scanne au moins deux couleurs pour les comparer ici."
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.pair}>
        <ColorSlot
          label="Couleur A"
          hex={colorA}
          selected={picking === "a"}
          onPress={() => setPicking("a")}
          theme={theme}
        />
        <ColorSlot
          label="Couleur B"
          hex={colorB}
          selected={picking === "b"}
          onPress={() => setPicking("b")}
          theme={theme}
        />
      </View>

      <Text style={[styles.hint, { color: theme.subtext }]}>
        Touche un emplacement, puis choisis une couleur ci-dessous.
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {recent.map((entry) => (
            <Pressable
              key={entry.hex}
              onPress={() => onPick(entry.hex)}
              accessibilityRole="button"
              accessibilityLabel={`Choisir ${entry.hex}`}
              style={[styles.swatch, { backgroundColor: entry.hex, borderColor: theme.border }]}
            />
          ))}
        </View>
      </ScrollView>

      {comparison ? (
        <>
          <View style={[styles.card, { borderColor: theme.border }]}>
            <Text style={[styles.verdict, { color: theme.text }]}>{comparison.summary}</Text>
          </View>

          <View style={[styles.metrics, { borderColor: theme.border }]}>
            <Metric label="ΔE2000" value={String(comparison.deltaE2000)} theme={theme} />
            <Metric label="ΔE76" value={String(comparison.deltaE76)} theme={theme} />
            <Metric
              label="Luminosité"
              value={signed(comparison.lightnessDelta)}
              theme={theme}
            />
            <Metric label="Saturation" value={signed(comparison.chromaDelta)} theme={theme} />
            <Metric label="Teinte" value={`${comparison.hueDelta}°`} theme={theme} />
            <Metric
              label="Contraste"
              value={`${comparison.contrast.ratio}:1 · ${comparison.contrast.normalText.toUpperCase()}`}
              theme={theme}
            />
          </View>

          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Vision des couleurs
          </Text>
          <Text style={[styles.hint, { color: theme.subtext }]}>
            Comment ces deux couleurs apparaissent selon différentes déficiences.
          </Text>

          {simulateAll(hexToRgb(colorA!)).map((sim, index) => {
            const simB = simulateAll(hexToRgb(colorB!))[index];
            return (
              <View key={sim.type} style={styles.simRow}>
                <Text style={[styles.simLabel, { color: theme.subtext }]} numberOfLines={1}>
                  {sim.label}
                </Text>
                <View style={[styles.simSwatch, { backgroundColor: rgbCss(sim.simulated) }]} />
                <View style={[styles.simSwatch, { backgroundColor: rgbCss(simB.simulated) }]} />
              </View>
            );
          })}
        </>
      ) : (
        <Text style={[styles.hint, { color: theme.subtext }]}>
          Choisis deux couleurs pour voir la comparaison.
        </Text>
      )}
    </ScrollView>
  );
}

function ColorSlot({
  label,
  hex,
  selected,
  onPress,
  theme,
}: {
  label: string;
  hex: string | null;
  selected: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label}${hex ? `, ${hex}` : ", vide"}`}
      style={[
        styles.slot,
        {
          backgroundColor: hex ?? theme.surface,
          borderColor: selected ? theme.accent : theme.border,
          borderWidth: selected ? 3 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <Text style={[styles.slotLabel, { color: theme.subtext }]}>{label}</Text>
      <Text style={[styles.slotHex, { color: theme.subtext }]}>
        {hex ? hex.toUpperCase() : "—"}
      </Text>
    </Pressable>
  );
}

function Metric({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricLabel, { color: theme.subtext }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const signed = (value: number) => (value > 0 ? `+${value}` : String(value));
const rgbCss = (rgb: { r: number; g: number; b: number }) => `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", padding: spacing.lg },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  pair: { flexDirection: "row", gap: spacing.sm },
  slot: {
    flex: 1,
    height: 120,
    borderRadius: 18,
    padding: spacing.sm,
    justifyContent: "flex-end",
  },
  slotLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  slotHex: { fontSize: 12, fontVariant: ["tabular-nums"] },
  row: { flexDirection: "row", gap: spacing.xs },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: spacing.xs,
  },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: spacing.md },
  verdict: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  metrics: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: spacing.sm,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  metric: { width: "50%", padding: spacing.sm, gap: 2 },
  metricLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.4 },
  metricValue: { fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginTop: spacing.sm },
  hint: { fontSize: 12, lineHeight: 17 },
  simRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  simLabel: { fontSize: 12, flex: 1 },
  simSwatch: { width: 56, height: 32, borderRadius: 8 },
});
