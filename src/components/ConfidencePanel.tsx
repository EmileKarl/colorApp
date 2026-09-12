import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { AnalyzeColorResult } from "../color-engine/pipeline/analyzeColor";
import { spacing, useTheme } from "../theme";

/**
 * Shows how much the measurement can be trusted, and why.
 *
 * This panel is the user-facing half of the engine's central promise: a color
 * is never presented as a bare fact. Showing the uncertainty and the concrete
 * reasons it grew is what separates an honest measurement tool from one that
 * invents precision.
 */
export function ConfidencePanel({ analysis }: { analysis: AnalyzeColorResult }) {
  const theme = useTheme();
  const percent = Math.round(analysis.confidence * 100);
  const level = confidenceLevel(analysis.confidence);

  const levelColor =
    level === "high" ? theme.success : level === "medium" ? theme.text : theme.danger;

  return (
    <View style={[styles.container, { borderColor: theme.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Fiabilité de la mesure</Text>
        <Text style={[styles.percent, { color: levelColor }]}>{percent} %</Text>
      </View>

      <View style={[styles.barTrack, { backgroundColor: theme.border }]}>
        <View style={[styles.barFill, { width: `${percent}%`, backgroundColor: levelColor }]} />
      </View>

      <Text style={[styles.uncertainty, { color: theme.subtext }]}>
        Marge d&apos;erreur estimée : ±{analysis.uncertainty} ΔE00
        {analysis.uncertainty <= 3
          ? " (limite de ce qu'une caméra sans référence peut affirmer)"
          : ""}
      </Text>

      {analysis.confidenceDetail.limitations.length > 0 ? (
        <View style={styles.limitations}>
          {analysis.confidenceDetail.limitations.slice(0, 2).map((limitation) => (
            <Text key={limitation} style={[styles.limitation, { color: theme.subtext }]}>
              • {limitation}
            </Text>
          ))}
        </View>
      ) : null}

      {analysis.lighting.method !== "none" && analysis.lighting.castStrength > 0.02 ? (
        <Text style={[styles.lighting, { color: theme.subtext }]}>
          Éclairage {toneLabel(analysis.lighting.tone)} détecté et compensé.
        </Text>
      ) : null}
    </View>
  );
}

function confidenceLevel(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.7) return "high";
  if (confidence >= 0.45) return "medium";
  return "low";
}

function toneLabel(tone: "warm" | "cool" | "neutral"): string {
  if (tone === "warm") return "chaud";
  if (tone === "cool") return "froid";
  return "neutre";
}

const styles = StyleSheet.create({
  container: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 15, fontWeight: "700" },
  percent: { fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] },
  barTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 3 },
  uncertainty: { fontSize: 12 },
  limitations: { gap: 2 },
  limitation: { fontSize: 12, lineHeight: 17 },
  lighting: { fontSize: 12, fontStyle: "italic" },
});
