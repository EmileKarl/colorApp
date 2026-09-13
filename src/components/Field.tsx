import React from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";

import { radius, spacing, type, useTheme } from "../theme";

type Props = TextInputProps & {
  label?: string;
  /** Shown under the field — a hint, or a validation message when `invalid`. */
  hint?: string;
  invalid?: boolean;
};

/**
 * Text input with a label and a hint slot.
 *
 * Centralised so that every field in the app has the same height, radius and
 * focus affordance, and so that `accessibilityLabel` is never forgotten — a
 * placeholder alone disappears as soon as the user types, leaving a screen
 * reader with an unlabelled control.
 */
export function Field({ label, hint, invalid, style, ...rest }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      {label ? (
        <Text style={[type.label, { color: theme.subtext }]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={theme.subtext}
        accessibilityLabel={label ?? rest.placeholder}
        style={[
          styles.input,
          type.body,
          {
            color: theme.text,
            backgroundColor: theme.surface,
            borderColor: invalid ? theme.danger : theme.border,
          },
          style,
        ]}
        {...rest}
      />
      {hint ? (
        <Text style={[type.caption, { color: invalid ? theme.danger : theme.subtext }]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    minHeight: 48,
  },
});
