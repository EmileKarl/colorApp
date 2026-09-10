import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";

import { spacing, useTheme } from "../theme";

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger";
};

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = "primary",
}: Props) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const backgroundColor =
    variant === "danger" ? theme.danger : variant === "secondary" ? theme.surface : theme.accent;
  const textColor =
    variant === "secondary" ? theme.text : theme.background;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderWidth: variant === "secondary" ? StyleSheet.hairlineWidth : 0,
          borderColor: theme.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  label: { fontSize: 16, fontWeight: "700" },
});
