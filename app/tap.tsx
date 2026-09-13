import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";

import { ErrorBanner } from "../src/components/ErrorBanner";
import { Screen } from "../src/components/Screen";
import { StateView } from "../src/components/StateView";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { useRecentColors } from "../src/context/RecentColorsContext";
import { readableTextColor } from "../src/domain/contrast";
import { decodeImageToRgba, analyzeDecodedImage } from "../src/lib/extractColor";
import { spacing, useTheme } from "../src/theme";
import type { AnalyzeColorResult } from "../src/color-engine/pipeline/analyzeColor";

/**
 * Tap-to-Color (spec §8) with a magnified readout (§7).
 *
 * The photo is decoded **once** into pixels; each tap then re-analyses a small
 * region from that same buffer in memory. Re-decoding the file on every tap
 * would make the interaction feel sluggish and would burn battery for no gain.
 */
export default function TapScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const { add: addRecentColor } = useRecentColors();

  const decoded = useRef<{ rgba: Uint8Array; width: number; height: number } | null>(null);
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [result, setResult] = useState<AnalyzeColorResult | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!uri) {
        setError("Aucune image reçue.");
        setStatus("error");
        return;
      }
      try {
        const image = await decodeImageToRgba(uri);
        if (cancelled) return;
        decoded.current = image;
        setStatus("ready");
      } catch {
        if (!cancelled) {
          setError("Impossible de charger cette image.");
          setStatus("error");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [uri]);

  const sampleAt = useCallback((x: number, y: number) => {
    const image = decoded.current;
    if (!image) return;
    try {
      // Sampling is synchronous and fast on a 96px buffer, so the readout
      // updates within the same frame as the tap.
      setResult(analyzeDecodedImage(image, { x, y }));
      setPoint({ x, y });
      Haptics.selectionAsync();
    } catch {
      setError("Cette zone n'a pas pu être analysée.");
    }
  }, []);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setLayout({ width, height });
  };

  if (status === "loading") {
    return (
      <Screen center>
        <StateView kind="loading" message="Préparation de l’image…" />
      </Screen>
    );
  }

  if (status === "error") {
    return (
      <Screen center>
        <StateView
          kind="invalid_image"
          message={error ?? undefined}
          onRetry={() => router.back()}
          retryLabel="Choisir une autre image"
        />
      </Screen>
    );
  }

  const swatchHex = result?.dominantColor.hex;
  const readable = swatchHex
    ? readableTextColor(result!.dominantColor.rgb)
    : { r: 0, g: 0, b: 0 };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Pressable
        style={styles.imageWrap}
        onLayout={onLayout}
        onPress={(event) => {
          if (layout.width === 0 || layout.height === 0) return;
          sampleAt(
            clamp01(event.nativeEvent.locationX / layout.width),
            clamp01(event.nativeEvent.locationY / layout.height),
          );
        }}
        accessibilityRole="button"
        accessibilityLabel="Toucher l'image pour analyser cette zone"
      >
        <Image source={{ uri }} style={styles.image} resizeMode="contain" />

        {point && swatchHex ? (
          <View
            pointerEvents="none"
            style={[
              styles.loupe,
              {
                left: point.x * layout.width - LOUPE_SIZE / 2,
                top: point.y * layout.height - LOUPE_SIZE - 12,
                backgroundColor: swatchHex,
              },
            ]}
          >
            <Text style={[styles.loupeText, { color: rgbCss(readable) }]}>
              {swatchHex.toUpperCase()}
            </Text>
          </View>
        ) : null}
      </Pressable>

      {error ? <ErrorBanner message={error} /> : null}

      <View style={styles.readout}>
        {result ? (
          <>
            <View style={styles.readoutRow}>
              <View style={[styles.swatch, { backgroundColor: swatchHex }]} />
              <View style={styles.readoutText}>
                <Text style={[styles.hex, { color: theme.text }]}>
                  {swatchHex?.toUpperCase()}
                </Text>
                <Text style={[styles.meta, { color: theme.subtext }]}>
                  RGB {result.rgb.r} {result.rgb.g} {result.rgb.b} · Lab{" "}
                  {result.lab.L.toFixed(0)} {result.lab.a.toFixed(0)} {result.lab.b.toFixed(0)}
                </Text>
                <Text style={[styles.meta, { color: theme.subtext }]}>
                  Fiabilité {Math.round(result.confidence * 100)} % · ±{result.uncertainty} ΔE00
                </Text>
              </View>
            </View>

            <PrimaryButton
              label="Utiliser cette couleur"
              onPress={() => {
                if (!swatchHex) return;
                addRecentColor({
                  hex: swatchHex,
                  scannedAt: new Date().toISOString(),
                  confidence: result.confidence,
                });
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                router.back();
              }}
            />
          </>
        ) : (
          <Text style={[styles.hint, { color: theme.subtext }]}>
            Touche n&apos;importe quelle zone de la photo pour en analyser la couleur.
          </Text>
        )}
      </View>
    </View>
  );
}

const LOUPE_SIZE = 72;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const rgbCss = (rgb: { r: number; g: number; b: number }) => `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  imageWrap: { flex: 1, margin: spacing.md, borderRadius: 20, overflow: "hidden" },
  image: { width: "100%", height: "100%" },
  loupe: {
    position: "absolute",
    width: LOUPE_SIZE,
    height: LOUPE_SIZE,
    borderRadius: LOUPE_SIZE / 2,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  loupeText: { fontSize: 11, fontWeight: "700", fontVariant: ["tabular-nums"] },
  readout: { padding: spacing.md, gap: spacing.md },
  readoutRow: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  swatch: { width: 64, height: 64, borderRadius: 16 },
  readoutText: { flex: 1, gap: 2 },
  hex: { fontSize: 20, fontWeight: "700", fontVariant: ["tabular-nums"] },
  meta: { fontSize: 12 },
  hint: { fontSize: 13, textAlign: "center", paddingVertical: spacing.lg },
});
