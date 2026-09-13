import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import ViewShot, { type ViewShotRef } from "react-native-view-shot";

import { ColorSwatch } from "../src/components/ColorSwatch";
import { ColorLab } from "../src/components/ColorLab";
import { ConfidencePanel } from "../src/components/ConfidencePanel";
import { CodeRow } from "../src/components/CodeRow";
import { ErrorBanner } from "../src/components/ErrorBanner";
import { HarmonyPalette } from "../src/components/HarmonyPalette";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { useAuth } from "../src/context/AuthContext";
import { useRecentColors } from "../src/context/RecentColorsContext";
import { saveColor } from "../src/lib/colorApi";
import { createColor, findExistingColor, proposeColorName } from "../src/lib/communityApi";
import { analyzeImageColor } from "../src/lib/extractColor";
import type { AnalyzeColorResult } from "../src/color-engine/pipeline/analyzeColor";
import { rgbToHsv } from "../src/color-engine/color-spaces/hsv";
import { FAMILY_LABEL_FR, getColorFamily, hexToRgb, nearestNamedColor, rgbToHsl } from "../src/lib/color";
import { STARTER_COLOR_NAMES } from "../src/data/starterColorNames";
import type { CommunityColorRow } from "../src/types/database";
import {
  BRIGHTNESS_LABEL_FR,
  CMYK_CAVEAT,
  SATURATION_LABEL_FR,
  TEMPERATURE_LABEL_FR,
  colorFacts,
} from "../src/domain/colorFacts";
import { spacing, useTheme } from "../src/theme";
import { Field } from "../src/components/Field";
import { Screen } from "../src/components/Screen";
import { StateView } from "../src/components/StateView";

export default function ResultScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { add: addRecentColor } = useRecentColors();
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const shotRef = useRef<ViewShotRef>(null);

  const [hex, setHex] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeColorResult | null>(null);
  const [status, setStatus] = useState<"extracting" | "ready" | "error">("extracting");
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [communityColor, setCommunityColor] = useState<CommunityColorRow | null>(null);
  const [proposedName, setProposedName] = useState("");
  const [proposing, setProposing] = useState(false);
  const [nameProposed, setNameProposed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!uri) {
        setError("Aucune image reçue.");
        setStatus("error");
        return;
      }
      try {
        // Analyse the original capture directly. An intermediate JPEG
        // round-trip here would compress the very values we are measuring;
        // the engine does its own lossless downscale internally.
        const measurement = await analyzeImageColor(uri);
        if (cancelled) return;
        const extracted = measurement.dominantColor.hex;
        setHex(extracted);
        setAnalysis(measurement);
        // Record locally so palettes, compare and history work offline and
        // without an account — the cloud collection stays a separate opt-in.
        addRecentColor({
          hex: extracted,
          scannedAt: new Date().toISOString(),
          confidence: measurement.confidence,
        });
        setStatus("ready");

        try {
          const match = await findExistingColor(extracted);
          if (!cancelled && match) setCommunityColor(match);
        } catch {
          // Community lookup is a nice-to-have here; a failed network call
          // must never block showing the user their scanned color.
        }
      } catch {
        if (!cancelled) {
          setError("Impossible d'analyser cette image. Réessaie avec un meilleur éclairage.");
          setStatus("error");
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // addRecentColor is stable (memoized in the provider), so listing it here
    // does not re-trigger the analysis.
  }, [uri, addRecentColor]);

  const onSave = useCallback(async () => {
    if (!hex) return;
    if (!user) {
      Alert.alert(
        "Connexion requise",
        "Crée un compte gratuit pour sauvegarder tes couleurs dans le cloud.",
        [
          { text: "Plus tard", style: "cancel" },
          { text: "Se connecter", onPress: () => router.push("/auth/sign-in") },
        ],
      );
      return;
    }
    setSaving(true);
    try {
      await saveColor({
        userId: user.id,
        hex,
        name: label,
        sourceType: "camera",
        sourceImageUrl: uri,
        uncertainty: analysis?.uncertainty,
      });
      setSaved(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError("La sauvegarde a échoué. Vérifie ta connexion et réessaie.");
    } finally {
      setSaving(false);
    }
  }, [hex, label, uri, user, router, analysis]);

  const onProposeName = useCallback(async () => {
    if (!hex) return;
    if (!user) {
      Alert.alert(
        "Connexion requise",
        "Connecte-toi pour proposer un nom à la communauté.",
        [
          { text: "Plus tard", style: "cancel" },
          { text: "Se connecter", onPress: () => router.push("/auth/sign-in") },
        ],
      );
      return;
    }
    const name = proposedName.trim();
    if (name.length < 2 || name.length > 40) {
      setError("Le nom doit contenir entre 2 et 40 caractères.");
      return;
    }
    setProposing(true);
    setError(null);
    try {
      const color =
        communityColor ??
        (await createColor({
          hex,
          family: getColorFamily(hexToRgb(hex)),
          discoveredBy: user.id,
        }));
      if (!communityColor) setCommunityColor(color);
      await proposeColorName({ colorId: color.id, name, proposedBy: user.id });
      setNameProposed(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError(
        "La proposition a échoué. Ce nom existe peut-être déjà, ou la limite horaire de propositions est atteinte.",
      );
    } finally {
      setProposing(false);
    }
  }, [hex, proposedName, communityColor, user, router]);

  const onShare = useCallback(async () => {
    try {
      const shareUri = await shotRef.current?.capture();
      if (!shareUri) return;
      const Sharing = await import("expo-sharing");
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(shareUri);
      }
    } catch {
      setError("Le partage a échoué sur cet appareil.");
    }
  }, []);

  if (status === "extracting") {
    return (
      <Screen center>
        <StateView kind="analyzing" />
      </Screen>
    );
  }

  if (status === "error" || !hex) {
    return (
      <Screen center>
        <StateView
          kind="analysis_failed"
          message={error ?? undefined}
          onRetry={() => router.back()}
          retryLabel="Choisir une autre image"
          onAlternative={() => router.push({ pathname: "/tap", params: { uri } })}
          alternativeLabel="Choisir une autre zone"
        />
      </Screen>
    );
  }

  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb);
  const family = getColorFamily(rgb);
  const suggestedName = nearestNamedColor(hex, STARTER_COLOR_NAMES)?.name ?? "Couleur sans nom";
  const facts = colorFacts(hex);
  const hsv = rgbToHsv(rgb);

  return (
    <Screen contentStyle={styles.content}>
      <ViewShot ref={shotRef} options={{ format: "png", quality: 0.9 }}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <ColorSwatch hex={hex} size={140} />
          <Text style={[styles.name, { color: theme.text }]}>{suggestedName}</Text>
          <Text style={[styles.hex, { color: theme.subtext }]}>{hex.toUpperCase()}</Text>
          <Text style={[styles.brand, { color: theme.subtext }]}>Color Code</Text>
        </View>
      </ViewShot>

      {communityColor ? (
        <Text style={[styles.note, { color: theme.subtext }]}>
          Une couleur très proche existe déjà dans la communauté ({communityColor.hex}). Tu peux
          proposer un nom supplémentaire pour elle ci-dessous.
        </Text>
      ) : (
        <Text style={[styles.note, { color: theme.subtext }]}>
          Cette couleur n’a pas encore été découverte par la communauté — sois la première
          personne à lui proposer un nom !
        </Text>
      )}

      <View style={[styles.codes, { borderColor: theme.border }]}>
        <CodeRow label="HEX" value={hex.toUpperCase()} />
        <CodeRow label="RGB" value={`rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`} />
        <CodeRow label="HSL" value={`hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`} />
        <CodeRow
          label="HSV"
          value={`hsv(${Math.round(hsv.h)}, ${Math.round(hsv.s * 100)}%, ${Math.round(hsv.v * 100)}%)`}
        />
        {/* LCh, not HSV: hue angle, chroma and L* are the perceptual
            coordinates the engine measures in, and mislabelling them as HSV
            would mean a designer copying the wrong numbers. */}
        <CodeRow
          label="LCh"
          value={`L* ${facts.lightness} · C* ${facts.chroma} · h ${facts.hue}°`}
        />
        <CodeRow
          label="CMYK"
          value={`${facts.cmyk.c} / ${facts.cmyk.m} / ${facts.cmyk.y} / ${facts.cmyk.k}`}
        />
        <CodeRow label="Famille" value={FAMILY_LABEL_FR[family]} />
        <CodeRow label="Température" value={TEMPERATURE_LABEL_FR[facts.temperature]} />
        <CodeRow label="Luminosité" value={BRIGHTNESS_LABEL_FR[facts.brightness]} />
        <CodeRow label="Saturation" value={SATURATION_LABEL_FR[facts.saturation]} />
      </View>

      <Text style={[styles.disclaimer, { color: theme.subtext }]}>{CMYK_CAVEAT}</Text>

      {analysis ? <ConfidencePanel analysis={analysis} /> : null}

      {analysis ? <ColorLab result={analysis} /> : null}

      <View style={styles.harmonySection}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Palette harmonieuse</Text>
        <HarmonyPalette hex={hex} />
      </View>

      <Text style={[styles.disclaimer, { color: theme.subtext }]}>
        Couleur estimée à partir d’une photo : l’éclairage, la balance des blancs et les reflets
        peuvent la faire varier. Pas une mesure colorimétrique professionnelle.
      </Text>

      <Field
        label="Étiquette personnelle"
        placeholder="Optionnel — ex. « mur du salon »"
        value={label}
        onChangeText={setLabel}
      />

      <View style={[styles.proposeBox, { borderColor: theme.border }]}>
        <Text style={[styles.proposeTitle, { color: theme.text }]}>Proposer un nom</Text>
        <Text style={[styles.proposeHint, { color: theme.subtext }]}>
          Sera visible après validation par la modération, puis soumis au vote de la communauté.
        </Text>
        <Field
          placeholder="Ex. : Bleu lagon"
          value={proposedName}
          onChangeText={setProposedName}
          editable={!nameProposed}
        />
        <PrimaryButton
          label={nameProposed ? "Nom envoyé pour modération ✓" : "Envoyer la proposition"}
          onPress={onProposeName}
          loading={proposing}
          disabled={nameProposed}
          variant="secondary"
        />
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      <View style={styles.actions}>
        <PrimaryButton
          label="Appliquer à un objet"
          icon="cube-outline"
          onPress={() => router.push({ pathname: "/objects", params: { hex } })}
        />
        <PrimaryButton
          label={saved ? "Sauvegardée ✓" : "Sauvegarder"}
          onPress={onSave}
          loading={saving}
          disabled={saved}
          variant="secondary"
        />
        <PrimaryButton label="Partager la carte" onPress={onShare} variant="secondary" />
        <PrimaryButton
          label="Choisir une autre zone de la photo"
          onPress={() => router.push({ pathname: "/tap", params: { uri } })}
          variant="secondary"
        />
        <PrimaryButton
          label="Comparer avec une autre couleur"
          onPress={() => router.push({ pathname: "/compare", params: { a: hex } })}
          variant="secondary"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  content: { padding: spacing.md, gap: spacing.md },
  card: {
    alignItems: "center",
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  name: { fontSize: 20, fontWeight: "700" },
  hex: { fontSize: 14, fontVariant: ["tabular-nums"] },
  brand: { fontSize: 11, letterSpacing: 1, marginTop: spacing.sm, textTransform: "uppercase" },
  note: { fontSize: 13, textAlign: "center" },
  codes: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  disclaimer: { fontSize: 12, textAlign: "center", paddingHorizontal: spacing.sm },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: spacing.md,
    fontSize: 15,
  },
  actions: { gap: spacing.sm, paddingBottom: spacing.xl },
  proposeBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  proposeTitle: { fontSize: 15, fontWeight: "700" },
  proposeHint: { fontSize: 12 },
  harmonySection: { gap: spacing.sm },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  loadingTitle: { fontSize: 15, fontWeight: "600" },
  loadingHint: { fontSize: 12, textAlign: "center", paddingHorizontal: spacing.lg },
});
