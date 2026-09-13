import React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { elevation, radius, spacing, type, useTheme } from "../theme";

type CardProps = {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** `flat` drops the shadow — for cards nested inside another surface. */
  variant?: "elevated" | "flat";
  accessibilityLabel?: string;
  padded?: boolean;
};

/**
 * The one card shape used across the app — §13 requires that "les cartes
 * doivent être cohérentes", which is only achievable if there is a single
 * implementation rather than a StyleSheet per screen.
 */
export function Card({
  children,
  onPress,
  onLongPress,
  style,
  variant = "elevated",
  accessibilityLabel,
  padded = true,
}: CardProps) {
  const theme = useTheme();
  const base: StyleProp<ViewStyle> = [
    styles.card,
    padded && styles.padded,
    {
      backgroundColor: theme.surface,
      borderColor: theme.border,
    },
    variant === "elevated" && { ...elevation.card, shadowColor: theme.shadow },
    style,
  ];

  if (!onPress && !onLongPress) return <View style={base}>{children}</View>;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

/**
 * Section title with an optional trailing action.
 *
 * Takes a `title`/`action` pair rather than free children so that every
 * section on every screen lands on the same type ramp — the "hiérarchie
 * typographique claire" of §5.
 */
export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionText}>
        <Text style={[type.heading, { color: theme.text }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[type.caption, { color: theme.subtext }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={[type.label, { color: theme.subtext }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  padded: { padding: spacing.md },
  pressed: { opacity: 0.75 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  // flexShrink lets a long title wrap instead of pushing the action off-screen,
  // which §13 lists as a defect ("aucun bouton ne doit être coupé").
  sectionText: { flexShrink: 1, gap: 2 },
});
