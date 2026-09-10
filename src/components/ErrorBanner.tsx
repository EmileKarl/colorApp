import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { spacing, useTheme } from "../theme";

export function ErrorBanner({ message }: { message: string }) {
  const theme = useTheme();
  return (
    <View
      style={[styles.banner, { backgroundColor: theme.danger + "1a", borderColor: theme.danger }]}
      accessibilityRole="alert"
    >
      <Text style={[styles.text, { color: theme.danger }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  text: { fontSize: 14, fontWeight: "600" },
});
