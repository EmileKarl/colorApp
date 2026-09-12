import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import ViewShot, { type ViewShotRef } from "react-native-view-shot";

import { ColorSwatch } from "../src/components/ColorSwatch";
import { ConfidencePanel } from "../src/components/ConfidencePanel";
import { CodeRow } from "../src/components/CodeRow";
import { ErrorBanner } from "../src/components/ErrorBanner";
import { HarmonyPalette } from "../src/components/HarmonyPalette";
import { PrimaryButton } from "../src/components/PrimaryButton";
import { useAuth } from "../src/context/AuthContext";
import { saveColorToCollection } from "../src/lib/collectionApi";
import { createColor, findExistingColor, proposeColorName } from "../src/lib/communityApi";
import { analyzeImageColor } from "../src/lib/extractColor";
import type { AnalyzeColorResult } from "../src/color-engine/pipeline/analyzeColor";
import { FAMILY_LABEL_FR, getColorFamily, hexToRgb, nearestNamedColor, rgbToHsl } from "../src/lib/color";
import { STARTER_COLOR_NAMES } from "../src/data/starterColorNames";
import type { ColorRow } from "../src/types/database";
import { spacing, useTheme } from "../src/theme";

export default function ResultScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const shotRef = useRef<ViewShotRef>(null);

  const [hex, setHex] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeColorResult | null>(null);
  const [status, setStatus] = useState<"extracting" | "ready" | "error">("extracting");
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [communityColor, setCommunityColor] = useState<ColorRow | null>(null);
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
  }, [uri]);

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
      await saveColorToCollection({ userId: user.id, hex, label, sourceImageUrl: uri });
      setSaved(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setError("La sauvegarde a échoué. Vérifie ta connexion et réessaie.");
    } finally {
      setSaving(false);
    }
  }, [hex, label, uri, user, router]);

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
      let color = communityColor;
      if (!color) {
        color = await createColor({
          hex,
          family: getColorFamily(hexToRgb(hex)),
          discoveredBy: user.id,
        });
        setCommunityColor(color);
      }
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
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={[styles.loadingTitle, { color: theme.text }]}>Analyse de la couleur…</Text>
        <Text style={[styles.loadingHint, { color: theme.subtext }]}>
          Un bon éclairage naturel donne un résultat plus fiable.
        </Text>
      </View>
    );
  }

  if (status === "error" || !hex) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ErrorBanner message={error ?? "Une erreur est survenue."} />
        <PrimaryButton label="Retour" onPress={() => router.back()} variant="secondary" />
      </View>
    );
  }

  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb);
  const family = getColorFamily(rgb);
  const suggestedName = nearestNamedColor(hex, STARTER_COLOR_NAMES)?.name ?? "Couleur sans nom";

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
    >
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
        <CodeRow label="Famille" value={FAMILY_LABEL_FR[family]} />
      </View>

      {analysis ? <ConfidencePanel analysis={analysis} /> : null}

      <View style={styles.harmonySection}>
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Palette harmonieuse</Text>
        <HarmonyPalette hex={hex} />
      </View>

      <Text style={[styles.disclaimer, { color: theme.subtext }]}>
        Couleur estimée à partir d’une photo : l’éclairage, la balance des blancs et les reflets
        peuvent la faire varier. Pas une mesure colorimétrique professionnelle.
      </Text>

      <TextInput
        placeholder="Étiquette personnelle (optionnel)"
        placeholderTextColor={theme.subtext}
        value={label}
        onChangeText={setLabel}
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
      />

      <View style={[styles.proposeBox, { borderColor: theme.border }]}>
        <Text style={[styles.proposeTitle, { color: theme.text }]}>Proposer un nom</Text>
        <Text style={[styles.proposeHint, { color: theme.subtext }]}>
          Sera visible après validation par la modération, puis soumis au vote de la communauté.
        </Text>
        <TextInput
          placeholder="Ex. : Bleu lagon"
          placeholderTextColor={theme.subtext}
          value={proposedName}
          onChangeText={setProposedName}
          editable={!nameProposed}
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
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
          label={saved ? "Sauvegardée ✓" : "Sauvegarder"}
          onPress={onSave}
          loading={saving}
          disabled={saved}
        />
        <PrimaryButton label="Partager la carte" onPress={onShare} variant="secondary" />
      </View>
    </ScrollView>
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
