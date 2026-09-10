import React from "react";
import { StyleSheet, View } from "react-native";

import { useTheme } from "../theme";

type Props = { hex: string; size?: number };

export function ColorSwatch({ hex, size = 120 }: Props) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`Aperçu de la couleur ${hex}`}
      style={[
        styles.swatch,
        { width: size, height: size, backgroundColor: hex, borderColor: theme.border },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  swatch: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
