import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { radius, spacing, type, useTheme } from "../theme";

type IconName = keyof typeof Ionicons.glyphMap;

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  /** Paints the chip in a captured color — used for family and palette filters. */
  swatch?: string;
  disabled?: boolean;
};

/**
 * Capsule control (§5, "boutons en capsule").
 *
 * Selection is signalled by fill *and* by `accessibilityState`, never by color
 * alone — §5 forbids conveying information through color only.
 */
export function Chip({ label, selected, onPress, icon, swatch, disabled }: ChipProps) {
  const theme = useTheme();
  const background = selected ? theme.accent : theme.surface;
  const foreground = selected ? theme.onAccent : theme.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected), disabled: Boolean(disabled) }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: background,
          borderColor: selected ? theme.accent : theme.border,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {swatch ? <View style={[styles.swatch, { backgroundColor: swatch }]} /> : null}
      {icon ? <Ionicons name={icon} size={14} color={foreground} /> : null}
      <Text style={[type.label, { color: foreground }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Horizontally scrollable chip row.
 *
 * Filters are always scrollable rather than wrapped: a wrapping row silently
 * changes the height of the screen as options are added, which pushes content
 * around. §13 requires lists to be scrollable.
 */
export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    // 36 pt tall with the label's line height — inside the 44 pt touch target
    // once the row's vertical padding is counted.
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 220,
  },
  swatch: { width: 14, height: 14, borderRadius: radius.pill },
  row: { gap: spacing.sm, paddingVertical: spacing.xs, paddingRight: spacing.md },
});
