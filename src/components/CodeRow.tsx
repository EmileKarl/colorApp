import * as Clipboard from "expo-clipboard";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { spacing, useTheme } from "../theme";

type Props = { label: string; value: string };

/** A labeled, tap-to-copy code row (HEX / RGB / HSL / …). */
export function CodeRow({ label, value }: Props) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    await Clipboard.setStringAsync(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Pressable
      onPress={onCopy}
      accessibilityRole="button"
      accessibilityLabel={`Copier ${label} : ${value}`}
      style={({ pressed }) => [
        styles.row,
        { borderColor: theme.border, opacity: pressed ? 0.6 : 1 },
      ]}
    >
      <Text style={[styles.label, { color: theme.subtext }]}>{label}</Text>
      <View style={styles.valueWrap}>
        <Text style={[styles.value, { color: theme.text }]}>{value}</Text>
        <Text style={[styles.hint, { color: theme.subtext }]}>
          {copied ? "Copié !" : "Toucher pour copier"}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 14, fontWeight: "600" },
  valueWrap: { alignItems: "flex-end" },
  value: { fontSize: 16, fontVariant: ["tabular-nums"] },
  hint: { fontSize: 11, marginTop: 2 },
});
