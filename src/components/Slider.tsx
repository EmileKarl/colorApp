import NativeSlider from "@react-native-community/slider";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { monoFontFamily, spacing, type, useTheme } from "../theme";

type Props = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Renders the current value, e.g. `(v) => `${Math.round(v * 100)} %``. */
  format?: (value: number) => string;
  accentColor?: string;
  disabled?: boolean;
};

/**
 * Labelled slider used for mix ratios, material parameters and render settings.
 *
 * The value is always displayed as text next to the label: §5 forbids
 * conveying information by position or color alone, and a bare track gives a
 * user no way to know they are at 0.62 rather than 0.6.
 */
export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  format,
  accentColor,
  disabled,
}: Props) {
  const theme = useTheme();
  const accent = accentColor ?? theme.accent;
  const display = format ? format(value) : value.toFixed(2);

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      <View style={styles.header}>
        <Text style={[type.label, { color: theme.text }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[type.caption, styles.value, { color: theme.subtext }]}>{display}</Text>
      </View>
      <NativeSlider
        value={value}
        onValueChange={onChange}
        minimumValue={min}
        maximumValue={max}
        step={step}
        disabled={disabled}
        minimumTrackTintColor={accent}
        maximumTrackTintColor={theme.border}
        thumbTintColor={accent}
        accessibilityLabel={label}
        accessibilityValue={{ now: value, min, max, text: display }}
        style={styles.slider}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 2 },
  disabled: { opacity: 0.45 },
  header: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  // Monospace keeps the number from shifting the layout as digits change width.
  value: { fontFamily: monoFontFamily },
  slider: { width: "100%", height: 36 },
});
