import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { appState, type AppStateKind } from "../domain/appStates";
import { radius, spacing, type, useTheme } from "../theme";
import { PrimaryButton } from "./PrimaryButton";

type IconName = keyof typeof Ionicons.glyphMap;

type Props = {
  kind: AppStateKind;
  /** Overrides the catalogue message when a screen knows something more precise. */
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  /** The "alternative" of §10, wired to something the user can actually do. */
  onAlternative?: () => void;
  alternativeLabel?: string;
};

/**
 * Renders one of the states catalogued in `domain/appStates.ts`.
 *
 * Progress states show a spinner and no buttons; failures show the corrective
 * action, a Retry button when retrying can help, and the alternative route
 * when the screen supplies one. That shape is §10's requirement — an
 * explanation, an action, a retry, an alternative — made structural rather
 * than left to each screen's discretion.
 */
export function StateView({
  kind,
  message,
  onRetry,
  retryLabel,
  onAlternative,
  alternativeLabel,
}: Props) {
  const theme = useTheme();
  const state = appState(kind);
  const accent =
    state.tone === "error" ? theme.danger : state.tone === "empty" ? theme.subtext : theme.accent;

  return (
    <View style={styles.container} accessibilityRole="summary" accessibilityLabel={state.title}>
      <View style={[styles.badge, { backgroundColor: theme.surfaceAlt }]}>
        {state.tone === "progress" ? (
          <ActivityIndicator color={accent} />
        ) : (
          <Ionicons name={state.icon as IconName} size={26} color={accent} />
        )}
      </View>

      <Text style={[type.heading, styles.text, { color: theme.text }]}>{state.title}</Text>
      <Text style={[type.body, styles.text, { color: theme.subtext }]}>
        {message ?? state.message}
      </Text>

      {state.action ? (
        <Text style={[type.caption, styles.text, { color: theme.subtext }]}>{state.action}</Text>
      ) : null}

      {state.retryable && onRetry ? (
        <View style={styles.button}>
          <PrimaryButton label={retryLabel ?? "Réessayer"} onPress={onRetry} />
        </View>
      ) : null}

      {state.alternative && onAlternative ? (
        <View style={styles.button}>
          <PrimaryButton
            label={alternativeLabel ?? "Autre solution"}
            onPress={onAlternative}
            variant="secondary"
          />
          <Text style={[type.caption, styles.text, { color: theme.subtext }]}>
            {state.alternative}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  text: { textAlign: "center" },
  button: { width: "100%", maxWidth: 320, gap: spacing.xs, marginTop: spacing.xs },
});
