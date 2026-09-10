import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { EmptyState } from "../../src/components/EmptyState";
import { ErrorBanner } from "../../src/components/ErrorBanner";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { spacing, useTheme } from "../../src/theme";

export default function ScanScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const goToResult = (uri: string) => {
    router.push({ pathname: "/result", params: { uri } });
  };

  const onCapture = async () => {
    if (!cameraRef.current) return;
    setError(null);
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.6 });
      if (photo?.uri) goToResult(photo.uri);
    } catch {
      setError("La capture a échoué. Réessaie.");
    } finally {
      setBusy(false);
    }
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
    return <EmptyState title="Chargement des permissions…" />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <EmptyState
          title="Autorisation caméra requise"
          subtitle="Color Code a besoin d'accéder à la caméra pour scanner une couleur. Tu peux aussi choisir une photo existante."
        />
        <View style={styles.actions}>
          <PrimaryButton label="Autoriser la caméra" onPress={requestPermission} />
          <PrimaryButton
            label="Choisir une photo"
            onPress={onPickFromGallery}
            variant="secondary"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      {error ? <ErrorBanner message={error} /> : null}
      <View style={styles.actions}>
        <PrimaryButton label="Scanner la couleur" onPress={onCapture} loading={busy} />
        <PrimaryButton
          label="Depuis la galerie"
          onPress={onPickFromGallery}
          variant="secondary"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1, borderRadius: 24, margin: spacing.md, overflow: "hidden" },
  actions: { padding: spacing.md, gap: spacing.sm },
});
