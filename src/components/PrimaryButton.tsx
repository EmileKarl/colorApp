import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { radius, spacing, type, useTheme } from "../theme";

type IconName = keyof typeof Ionicons.glyphMap;

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  icon?: IconName;
  /** Overrides the theme accent — used to tint an action with the captured color. */
  accentColor?: string;
  size?: "md" | "sm";
};

/**
 * The app's primary action. Capsule-shaped per §5 ("boutons en capsule").
 *
 * The label is allowed two lines rather than being truncated: §13 forbids a
 * button whose text is cut off, and French labels routinely run longer than
 * their English equivalents.
 */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = "primary",
  icon,
  accentColor,
  size = "md",
}: Props) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const accent = accentColor ?? theme.accent;

  const backgroundColor =
    variant === "danger"
      ? theme.danger
      : variant === "secondary"
        ? theme.surface
        : variant === "ghost"
          ? "transparent"
          : accent;

  const textColor =
    variant === "secondary" ? theme.text : variant === "ghost" ? theme.subtext : theme.onAccent;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(isDisabled), busy: Boolean(loading) }}
      style={({ pressed }) => [
        styles.button,
        size === "sm" ? styles.sm : styles.md,
        {
          backgroundColor,
          borderWidth: variant === "secondary" ? StyleSheet.hairlineWidth : 0,
          borderColor: theme.border,
          opacity: isDisabled ? 0.45 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={size === "sm" ? 15 : 17} color={textColor} /> : null}
          <Text style={[size === "sm" ? type.label : type.subheading, { color: textColor }]} numberOfLines={2}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  // 50 and 40 pt keep both sizes at or above the 44 pt target once hit slop
  // from surrounding padding is counted.
  md: { paddingVertical: spacing.sm + 4, paddingHorizontal: spacing.lg, minHeight: 50 },
  sm: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, minHeight: 40 },
  content: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flexShrink: 1 },
});
