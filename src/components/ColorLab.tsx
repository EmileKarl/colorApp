import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  DETAIL_LEVEL_LABELS,
  buildLabSections,
  type DetailLevel,
} from "../domain/detailLevel";
import type { AnalyzeColorResult } from "../color-engine/pipeline/analyzeColor";
import { spacing, useTheme } from "../theme";

const LEVELS: DetailLevel[] = ["basic", "advanced", "expert"];

/**
 * Color Lab (spec §44/§45).
 *
 * Everything shown here was already computed during the scan, so switching to
 * Expert costs nothing — it only reveals data the engine produced anyway.
 * That matters for trust: an advanced user can inspect the illuminant gains and
 * estimator spread rather than taking the headline number on faith.
 */
export function ColorLab({ result }: { result: AnalyzeColorResult }) {
  const theme = useTheme();
  const [level, setLevel] = useState<DetailLevel>("basic");
  const sections = buildLabSections(result, level);

  return (
    <View style={styles.container}>
      <View style={styles.levels}>
        {LEVELS.map((option) => {
          const active = option === level;
          return (
            <Pressable
              key={option}
              onPress={() => {
                Haptics.selectionAsync();
                setLevel(option);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.levelChip,
                {
                  backgroundColor: active ? theme.accent : theme.surface,
                  borderColor: theme.border,
                },
              ]}
            >
              <Text style={{ color: active ? theme.background : theme.text, fontSize: 13 }}>
                {DETAIL_LEVEL_LABELS[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {sections.map((section) => (
        <View key={section.title} style={[styles.section, { borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.subtext }]}>{section.title}</Text>
          {section.rows.map((row, index) => (
            <View key={`${row.label}-${index}`} style={styles.row}>
              <Text style={[styles.label, { color: theme.subtext }]}>{row.label}</Text>
              <View style={styles.valueWrap}>
                <Text style={[styles.value, { color: theme.text }]}>{row.value}</Text>
                {row.hint ? (
                  <Text style={[styles.hint, { color: theme.subtext }]}>{row.hint}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  levels: { flexDirection: "row", gap: spacing.xs },
  levelChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  row: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
  label: { fontSize: 12, width: 110 },
  valueWrap: { flex: 1, gap: 1 },
  value: { fontSize: 13, fontVariant: ["tabular-nums"] },
  hint: { fontSize: 11, lineHeight: 15 },
});
