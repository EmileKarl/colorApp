import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, type CameraType } from "expo-camera";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Screen } from "../../src/components/Screen";
import { StateView } from "../../src/components/StateView";
import { ErrorBanner } from "../../src/components/ErrorBanner";
import { spacing, useTheme } from "../../src/theme";

export default function ScanScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<CameraType>("back");
  const [torchOn, setTorchOn] = useState(false);

  const goToResult = (uri: string) => {
    router.push({ pathname: "/result", params: { uri } });
  };

  const onCapture = async () => {
    if (!cameraRef.current) return;
    setError(null);
    setBusy(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6 });
      if (photo?.uri) goToResult(photo.uri);
    } catch {
      setError("La capture a échoué. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  const onToggleFacing = () => {
    Haptics.selectionAsync();
    setFacing((prev) => (prev === "back" ? "front" : "back"));
    setTorchOn(false); // front cameras don't have a torch
  };

  const onToggleTorch = () => {
    Haptics.selectionAsync();
    setTorchOn((prev) => !prev);
  };

  const onPickFromGallery = async () => {
    setError(null);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setError("Autorisation galerie refusée.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      goToResult(result.assets[0].uri);
    }
  };

  if (!permission) {
    return (
      <Screen center>
        <StateView kind="loading" message="Vérification des autorisations…" />
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen center>
        <StateView
          kind="camera_denied"
          onRetry={requestPermission}
          retryLabel="Autoriser la caméra"
          onAlternative={onPickFromGallery}
          alternativeLabel="Choisir une photo"
        />
      </Screen>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.cameraWrap}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing={facing}
          enableTorch={facing === "back" && torchOn}
        />
        {/* Marks the area extractDominantColor actually samples (the centered
            40% square), so what the user aims at is what gets measured. */}
        <View style={styles.reticleLayer} pointerEvents="none">
          <View style={styles.reticle} />
        </View>

        <View style={styles.overlayControls} pointerEvents="box-none">
          {facing === "back" ? (
            <Pressable
              onPress={onToggleTorch}
              accessibilityRole="button"
              accessibilityLabel={torchOn ? "Éteindre la lampe" : "Allumer la lampe"}
              style={[styles.overlayButton, { backgroundColor: theme.surface + "cc" }]}
            >
              <Ionicons
                name={torchOn ? "flash" : "flash-outline"}
                size={22}
                color={theme.text}
              />
            </Pressable>
          ) : (
            <View style={styles.overlayButton} />
          )}
          <Pressable
            onPress={onToggleFacing}
            accessibilityRole="button"
            accessibilityLabel="Changer de caméra"
            style={[styles.overlayButton, { backgroundColor: theme.surface + "cc" }]}
          >
            <Ionicons name="camera-reverse-outline" size={22} color={theme.text} />
          </Pressable>
        </View>
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      <View style={styles.actions}>
        <View style={styles.shutterRow}>
          <Pressable
            onPress={onPickFromGallery}
            accessibilityRole="button"
            accessibilityLabel="Choisir une photo depuis la galerie"
            style={[styles.galleryButton, { borderColor: theme.border }]}
          >
            <Ionicons name="images-outline" size={22} color={theme.text} />
          </Pressable>

          <Pressable
            onPress={onCapture}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Scanner la couleur"
            style={({ pressed }) => [
              styles.shutter,
              { borderColor: theme.accent, opacity: busy ? 0.5 : pressed ? 0.8 : 1 },
            ]}
          >
            <View style={[styles.shutterInner, { backgroundColor: theme.accent }]} />
          </Pressable>

          <View style={styles.galleryButton} />
        </View>
        <Text style={[styles.hint, { color: theme.subtext }]}>
          {busy
            ? "Analyse en cours…"
            : "Place la couleur dans le carré, puis appuie sur le déclencheur"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  cameraWrap: { flex: 1, margin: spacing.md, borderRadius: 24, overflow: "hidden" },
  camera: { flex: 1 },
  reticleLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  reticle: {
    width: "40%",
    aspectRatio: 1,
    maxWidth: 180,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
  },
  overlayControls: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    gap: spacing.sm,
  },
  overlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  actions: { padding: spacing.md, gap: spacing.sm, alignItems: "center" },
  shutterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: { width: 60, height: 60, borderRadius: 30 },
  galleryButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { fontSize: 12, textAlign: "center" },
});
