import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { getAnalogous, getComplementary } from "../lib/color";
import { spacing, useTheme } from "../theme";

/** Complementary + analogous swatches for a scanned color — tap any one to copy its hex. */
export function HarmonyPalette({ hex }: { hex: string }) {
  const [analogousLeft, analogousRight] = getAnalogous(hex);
  const swatches = [
    { label: "Analogue", value: analogousLeft },
    { label: "Complémentaire", value: getComplementary(hex) },
    { label: "Analogue", value: analogousRight },
  ];

  return (
    <View style={styles.row}>
      {swatches.map((swatch, index) => (
        <HarmonySwatch key={`${swatch.value}-${index}`} label={swatch.label} hex={swatch.value} />
      ))}
    </View>
  );
}

function HarmonySwatch({ label, hex }: { label: string; hex: string }) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    await Haptics.selectionAsync();
    await Clipboard.setStringAsync(hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <Pressable
      onPress={onCopy}
      style={styles.swatchWrap}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${hex}, toucher pour copier`}
    >
      <View style={[styles.swatch, { backgroundColor: hex, borderColor: theme.border }]} />
      <Text style={[styles.label, { color: theme.subtext }]}>{label}</Text>
      <Text style={[styles.hex, { color: theme.text }]}>
        {copied ? "Copié !" : hex.toUpperCase()}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  swatchWrap: { flex: 1, alignItems: "center", gap: 4 },
  swatch: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 11 },
  hex: { fontSize: 11, fontVariant: ["tabular-nums"] },
});
