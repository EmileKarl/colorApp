import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { spacing, useTheme } from "../theme";

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: theme.subtext }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", padding: spacing.xl, gap: spacing.xs },
  title: { fontSize: 16, fontWeight: "700", textAlign: "center" },
  subtitle: { fontSize: 14, textAlign: "center" },
});
