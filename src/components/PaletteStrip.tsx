import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ROLE_LABELS } from "../domain/photoPalette";
import type { Palette } from "../domain/palette";
import { spacing, useTheme } from "../theme";

/**
 * Renders a palette as proportional bands.
 *
 * When proportions are present (photo-derived palettes) each band is sized to
 * its real share of the image, so the strip *is* the data rather than a
 * decoration. Otherwise bands are equal.
 *
 * Text on each band uses the swatch's precomputed readable color, so labels
 * stay legible on any background — the color-adaptive rule of spec §5.
 */
export function PaletteStrip({ palette }: { palette: Palette }) {
  const theme = useTheme();
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  const hasProportions = palette.swatches.some((swatch) => swatch.proportion !== undefined);

  const onCopy = async (hex: string) => {
    await Haptics.selectionAsync();
    await Clipboard.setStringAsync(hex.toUpperCase());
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex((current) => (current === hex ? null : current)), 1400);
  };

  return (
    <View style={[styles.strip, { borderColor: theme.border }]}>
      {palette.swatches.map((swatch, index) => {
        const textColor = `rgb(${swatch.textColor.r}, ${swatch.textColor.g}, ${swatch.textColor.b})`;
        const share = swatch.proportion;

        return (
          <Pressable
            key={`${swatch.hex}-${index}`}
            onPress={() => onCopy(swatch.hex)}
            accessibilityRole="button"
            accessibilityLabel={
              `${swatch.hex}` +
              (swatch.role ? `, ${ROLE_LABELS[swatch.role]}` : "") +
              (share !== undefined ? `, ${Math.round(share * 100)} pour cent` : "") +
              ", toucher pour copier"
            }
            style={[
              styles.band,
              {
                backgroundColor: swatch.hex,
                // Proportional sizing when the data supports it, equal otherwise.
                flex: hasProportions ? Math.max(0.08, share ?? 0.08) : 1,
              },
            ]}
          >
            <View style={styles.bandContent}>
              {swatch.role ? (
                <Text style={[styles.role, { color: textColor }]} numberOfLines={1}>
                  {ROLE_LABELS[swatch.role]}
                </Text>
              ) : null}
              <Text style={[styles.hex, { color: textColor }]} numberOfLines={1}>
                {copiedHex === swatch.hex ? "Copié" : swatch.hex.toUpperCase()}
              </Text>
              {share !== undefined ? (
                <Text style={[styles.share, { color: textColor }]} numberOfLines={1}>
                  {Math.round(share * 100)}%
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 132,
  },
  band: { justifyContent: "flex-end", padding: spacing.xs, minWidth: 34 },
  bandContent: { gap: 1 },
  role: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  hex: { fontSize: 10, fontVariant: ["tabular-nums"] },
  share: { fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
