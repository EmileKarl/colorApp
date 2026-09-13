import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Card, SectionHeader } from "../src/components/Card";
import { Chip, ChipRow } from "../src/components/Chip";
import { Field } from "../src/components/Field";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { Screen } from "../src/components/Screen";
import { Slider } from "../src/components/Slider";
import { useRecentColors } from "../src/context/RecentColorsContext";
import {
  BRIGHTNESS_LABEL_FR,
  SATURATION_LABEL_FR,
  TEMPERATURE_LABEL_FR,
  colorFacts,
} from "../src/domain/colorFacts";
import {
  adjustChroma,
  adjustLightness,
  mixColors,
  pushMix,
  surpriseColor,
  tonalRamp,
  type MixEntry,
} from "../src/domain/colorMix";
import { isValidHex, normalizeHex } from "../src/lib/color";
import { monoFontFamily, radius, spacing, type, useLayout, useTheme } from "../src/theme";

/**
 * Color Lab — ColorLens page 8.
 *
 * Mix two colors, adjust the result, keep what you like. Everything runs on
 * the deterministic engine (§8): the mix is in CIELAB, the adjustments are in
 * LCh, and nothing here is a guess.
 */
export default function LabScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { width, gutter } = useLayout();
  const { colors: recent } = useRecentColors();

  const fallbackA = recent[0]?.hex ?? "#0047ab";
  const fallbackB = recent[1]?.hex ?? "#f2c200";

  const [a, setA] = useState(fallbackA);
  const [b, setB] = useState(fallbackB);
  const [ratio, setRatio] = useState(0.5);
  const [lightnessShift, setLightnessShift] = useState(0);
  const [chromaShift, setChromaShift] = useState(0);
  const [picking, setPicking] = useState<"a" | "b">("a");
  const [hexDraft, setHexDraft] = useState("");
  const [history, setHistory] = useState<MixEntry[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const mixed = useMemo(() => mixColors(a, b, ratio), [a, b, ratio]);
  const result = useMemo(
    () => adjustChroma(adjustLightness(mixed, lightnessShift), chromaShift),
    [mixed, lightnessShift, chromaShift],
  );
  const facts = useMemo(() => colorFacts(result), [result]);
  const ramp = useMemo(() => tonalRamp(result, 9), [result]);

  const swatchWidth = width - gutter * 2;

  const keep = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setHistory((previous) => pushMix(previous, { a, b, ratio, result }));
    setFavorites((previous) =>
      previous.includes(result) ? previous : [result, ...previous].slice(0, 12),
    );
  };

  const applyPicked = (hex: string) => {
    const normalized = normalizeHex(hex);
    if (picking === "a") setA(normalized);
    else setB(normalized);
  };

  const onCopy = async () => {
    await Clipboard.setStringAsync(result.toUpperCase());
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Screen contentStyle={styles.content}>
      <Card padded={false}>
        <View style={[styles.preview, { backgroundColor: result, width: swatchWidth }]} />
        <View style={styles.previewCaption}>
          <Text style={[type.title, styles.mono, { color: theme.text }]}>
            {result.toUpperCase()}
          </Text>
          <Text style={[type.caption, { color: theme.subtext }]}>
            {BRIGHTNESS_LABEL_FR[facts.brightness]} · {SATURATION_LABEL_FR[facts.saturation]} ·{" "}
            {TEMPERATURE_LABEL_FR[facts.temperature]}
          </Text>
          <Text style={[type.caption, styles.mono, { color: theme.subtext }]}>
            L* {facts.lightness} · C* {facts.chroma} · h {facts.hue}°
          </Text>
        </View>
      </Card>

      <View style={styles.section}>
        <SectionHeader title="Mélange" subtitle="Le mélange est calculé en CIELAB, pas en RGB" />
        <View style={styles.pairRow}>
          <Pressable
            onPress={() => setPicking("a")}
            accessibilityRole="button"
            accessibilityLabel={`Couleur A, ${a}`}
            accessibilityState={{ selected: picking === "a" }}
            style={[
              styles.pairSwatch,
              { backgroundColor: a, borderColor: picking === "a" ? theme.accent : theme.border },
            ]}
          />
          <Text style={[type.label, { color: theme.subtext }]}>A / B</Text>
          <Pressable
            onPress={() => setPicking("b")}
            accessibilityRole="button"
            accessibilityLabel={`Couleur B, ${b}`}
            accessibilityState={{ selected: picking === "b" }}
            style={[
              styles.pairSwatch,
              { backgroundColor: b, borderColor: picking === "b" ? theme.accent : theme.border },
            ]}
          />
        </View>
        <Slider
          label={`Ratio — ${Math.round((1 - ratio) * 100)} % A`}
          value={ratio}
          onChange={setRatio}
          format={(value) => `${Math.round(value * 100)} % B`}
          accentColor={result}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader
          title={`Choisir la couleur ${picking.toUpperCase()}`}
          subtitle="Depuis tes scans, ou au code hexadécimal"
        />
        <ChipRow>
          {recent.map((entry) => (
            <Chip
              key={entry.hex}
              label={entry.hex.toUpperCase()}
              swatch={entry.hex}
              selected={(picking === "a" ? a : b) === entry.hex}
              onPress={() => applyPicked(entry.hex)}
            />
          ))}
          <Chip
            label="Surprise"
            icon="dice-outline"
            onPress={() => {
              Haptics.selectionAsync();
              applyPicked(surpriseColor());
            }}
          />
        </ChipRow>
        <Field
          placeholder="#0047AB"
          value={hexDraft}
          onChangeText={setHexDraft}
          autoCapitalize="none"
          autoCorrect={false}
          invalid={hexDraft.length > 0 && !isValidHex(hexDraft)}
          hint={
            hexDraft.length > 0 && !isValidHex(hexDraft)
              ? "Six caractères hexadécimaux."
              : undefined
          }
          onSubmitEditing={() => {
            if (isValidHex(hexDraft)) applyPicked(hexDraft);
          }}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Ajuster" />
        <Slider
          label="Luminosité"
          value={lightnessShift}
          min={-40}
          max={40}
          step={1}
          onChange={setLightnessShift}
          format={(value) => (value > 0 ? `+${value.toFixed(0)}` : value.toFixed(0))}
          accentColor={result}
        />
        <Slider
          label="Saturation"
          value={chromaShift}
          min={-40}
          max={40}
          step={1}
          onChange={setChromaShift}
          format={(value) => (value > 0 ? `+${value.toFixed(0)}` : value.toFixed(0))}
          accentColor={result}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Déclinaison" subtitle="Neuf tons de la même teinte" />
        <View style={styles.ramp}>
          {ramp.map((hex) => (
            <Pressable
              key={hex}
              onPress={() => applyPicked(hex)}
              accessibilityRole="button"
              accessibilityLabel={`Utiliser ${hex}`}
              style={[styles.rampStep, { backgroundColor: hex }]}
            />
          ))}
        </View>
      </View>

      {favorites.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Gardées" subtitle="Touche pour réutiliser" />
          <ChipRow>
            {favorites.map((hex) => (
              <Chip
                key={hex}
                label={hex.toUpperCase()}
                swatch={hex}
                onPress={() => applyPicked(hex)}
              />
            ))}
          </ChipRow>
        </View>
      ) : null}

      {history.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Historique des mélanges" />
          <ChipRow>
            {history.map((entry) => (
              <Chip
                key={entry.result}
                label={entry.result.toUpperCase()}
                swatch={entry.result}
                onPress={() => {
                  setA(entry.a);
                  setB(entry.b);
                  setRatio(entry.ratio);
                  setLightnessShift(0);
                  setChromaShift(0);
                }}
              />
            ))}
          </ChipRow>
        </View>
      ) : null}

      <PrimaryButton label="Garder cette couleur" icon="bookmark-outline" onPress={keep} />
      <PrimaryButton
        label="Appliquer à un objet"
        icon="cube-outline"
        variant="secondary"
        onPress={() => router.push({ pathname: "/objects", params: { hex: result } })}
      />
      <PrimaryButton
        label={copied ? "Copié ✓" : "Copier le code"}
        icon="copy-outline"
        variant="secondary"
        onPress={onCopy}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  section: { gap: spacing.sm },
  preview: { height: 160 },
  previewCaption: { padding: spacing.md, gap: 2 },
  mono: { fontFamily: monoFontFamily },
  pairRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  pairSwatch: { flex: 1, height: 52, borderRadius: radius.md, borderWidth: 2 },
  ramp: { flexDirection: "row", gap: 2, borderRadius: radius.md, overflow: "hidden" },
  rampStep: { flex: 1, height: 48 },
});
