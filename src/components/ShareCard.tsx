import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { labToLch, rgbToLab } from "../color-engine/color-spaces/lab";
import { readableTextColor } from "../domain/contrast";
import type { Palette } from "../domain/palette";
import type { SocialFormat, TemplateId } from "../domain/socialFormats";
import type { RGB } from "../color-engine/types";

/**
 * The shareable card (spec §24).
 *
 * Every template picks its text color by measurement rather than assumption, so
 * a card generated from a pale yellow stays as readable as one from navy. That
 * is the §5 adaptive rule applied to exported content, where getting it wrong
 * is permanent — the image outlives the app session.
 */
export type ShareCardProps = {
  hex: string;
  rgb: RGB;
  name: string;
  template: TemplateId;
  format: SocialFormat;
  palette?: Palette;
  /** Optional measurement details, shown by the "science" template. */
  measurement?: { confidence: number; uncertainty: number };
  /** Brand line shown at the foot of the card. */
  brand?: string;
};

export function ShareCard({
  hex,
  rgb,
  name,
  template,
  format,
  palette,
  measurement,
  brand = "COLOR CODE",
}: ShareCardProps) {
  const ink = rgbCss(readableTextColor(rgb));
  const lab = rgbToLab(rgb);
  const lch = labToLch(lab);

  // The preview is laid out by aspect ratio; the capture step scales it up to
  // the format's real pixel size.
  const frame = [styles.frame, { aspectRatio: format.aspectRatio }];

  if (template === "minimal") {
    return (
      <View style={[frame, { backgroundColor: hex }]}>
        <View style={styles.minimalBody}>
          <Text style={[styles.minimalName, { color: ink }]}>{name}</Text>
          <Text style={[styles.minimalHex, { color: ink }]}>{hex.toUpperCase()}</Text>
        </View>
        <Text style={[styles.brand, { color: ink }]}>{brand}</Text>
      </View>
    );
  }

  if (template === "editorial") {
    return (
      <View style={[frame, { backgroundColor: hex }]}>
        <Text style={[styles.editorialEyebrow, { color: ink }]}>COULEUR</Text>
        <Text style={[styles.editorialName, { color: ink }]} numberOfLines={3}>
          {name}
        </Text>
        <View style={[styles.rule, { backgroundColor: ink }]} />
        <Text style={[styles.editorialMeta, { color: ink }]}>
          {hex.toUpperCase()}   ·   RGB {rgb.r} {rgb.g} {rgb.b}
        </Text>
        <Text style={[styles.brand, { color: ink }]}>{brand}</Text>
      </View>
    );
  }

  if (template === "science") {
    return (
      <View style={[frame, { backgroundColor: hex }]}>
        <Text style={[styles.editorialEyebrow, { color: ink }]}>MESURE</Text>
        <Text style={[styles.scienceName, { color: ink }]} numberOfLines={2}>
          {name}
        </Text>
        <View style={styles.scienceGrid}>
          <ScienceRow label="HEX" value={hex.toUpperCase()} ink={ink} />
          <ScienceRow label="RGB" value={`${rgb.r} ${rgb.g} ${rgb.b}`} ink={ink} />
          <ScienceRow
            label="LAB"
            value={`${lab.L.toFixed(0)} ${lab.a.toFixed(0)} ${lab.b.toFixed(0)}`}
            ink={ink}
          />
          <ScienceRow
            label="LCH"
            value={`${lch.L.toFixed(0)} ${lch.C.toFixed(0)} ${lch.h.toFixed(0)}°`}
            ink={ink}
          />
          {measurement ? (
            <ScienceRow
              label="FIABILITÉ"
              value={`${Math.round(measurement.confidence * 100)} % ±${measurement.uncertainty}`}
              ink={ink}
            />
          ) : null}
        </View>
        <Text style={[styles.brand, { color: ink }]}>{brand}</Text>
      </View>
    );
  }

  // palette
  return (
    <View style={[frame, { backgroundColor: hex }]}>
      <Text style={[styles.minimalName, { color: ink }]}>{name}</Text>
      <Text style={[styles.minimalHex, { color: ink }]}>{hex.toUpperCase()}</Text>
      {palette ? (
        <View style={styles.paletteRow}>
          {palette.swatches.map((swatch, index) => (
            <View
              key={`${swatch.hex}-${index}`}
              style={[styles.paletteCell, { backgroundColor: swatch.hex }]}
            />
          ))}
        </View>
      ) : null}
      <Text style={[styles.brand, { color: ink }]}>{brand}</Text>
    </View>
  );
}

function ScienceRow({ label, value, ink }: { label: string; value: string; ink: string }) {
  return (
    <View style={styles.scienceRow}>
      <Text style={[styles.scienceLabel, { color: ink }]}>{label}</Text>
      <Text style={[styles.scienceValue, { color: ink }]}>{value}</Text>
    </View>
  );
}

const rgbCss = (rgb: RGB) => `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

const styles = StyleSheet.create({
  frame: { width: "100%", padding: 28, justifyContent: "space-between", borderRadius: 4 },
  minimalBody: { flex: 1, justifyContent: "center", gap: 6 },
  minimalName: { fontSize: 30, fontWeight: "700" },
  minimalHex: { fontSize: 15, fontVariant: ["tabular-nums"], letterSpacing: 1 },
  editorialEyebrow: { fontSize: 11, fontWeight: "700", letterSpacing: 3 },
  editorialName: { fontSize: 42, fontWeight: "800", lineHeight: 46, marginTop: 10 },
  rule: { height: 2, width: 64, marginVertical: 16, opacity: 0.7 },
  editorialMeta: { fontSize: 13, fontVariant: ["tabular-nums"], letterSpacing: 0.5 },
  scienceName: { fontSize: 26, fontWeight: "700", marginTop: 8 },
  scienceGrid: { gap: 6, marginTop: 12 },
  scienceRow: { flexDirection: "row", justifyContent: "space-between" },
  scienceLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 1.4, opacity: 0.85 },
  scienceValue: { fontSize: 13, fontVariant: ["tabular-nums"] },
  paletteRow: { flexDirection: "row", height: 56, borderRadius: 10, overflow: "hidden", marginTop: 14 },
  paletteCell: { flex: 1 },
  brand: { fontSize: 10, fontWeight: "700", letterSpacing: 2.4, opacity: 0.85 },
});
