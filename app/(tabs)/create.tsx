import * as Haptics from "expo-haptics";
import React, { useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import ViewShot, { type ViewShotRef } from "react-native-view-shot";

import { EmptyState } from "../../src/components/EmptyState";
import { ErrorBanner } from "../../src/components/ErrorBanner";
import { PrimaryButton } from "../../src/components/PrimaryButton";
import { ShareCard } from "../../src/components/ShareCard";
import { useRecentColors } from "../../src/context/RecentColorsContext";
import { classifyColor } from "../../src/color-engine/classification/colorMatcher";
import { rgbToLab } from "../../src/color-engine/color-spaces/lab";
import { generatePalette } from "../../src/domain/palette";
import {
  EXPORT_QUALITY,
  EXPORT_QUALITY_LABELS,
  SOCIAL_FORMATS,
  TEMPLATES,
  type ExportQuality,
  type SocialFormat,
  type TemplateId,
} from "../../src/domain/socialFormats";
import { hexToRgb } from "../../src/lib/color";
import { spacing, useTheme } from "../../src/theme";

/**
 * Create Studio (spec §22-31).
 *
 * Scope is deliberately "fast creation", not a design tool: pick a color, a
 * template and a format, then export. The spec is explicit that this must not
 * become Canva, and an editor with free positioning would be both a much larger
 * build and a worse fit for the one-tap flow of §37.
 */
export default function CreateScreen() {
  const theme = useTheme();
  const { colors: recent } = useRecentColors();
  const shotRef = useRef<ViewShotRef>(null);

  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const [template, setTemplate] = useState<TemplateId>("minimal");
  const [format, setFormat] = useState<SocialFormat>(SOCIAL_FORMATS[0]);
  const [quality, setQuality] = useState<ExportQuality>("high");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const hex = selectedHex ?? recent[0]?.hex ?? null;
  const rgb = useMemo(() => (hex ? hexToRgb(hex) : null), [hex]);

  const name = useMemo(() => {
    if (!rgb) return "";
    return classifyColor(rgbToLab(rgb)).best?.reference.name ?? "Couleur sans nom";
  }, [rgb]);

  const palette = useMemo(
    () => (rgb ? generatePalette(rgb, "modern", 5) : undefined),
    [rgb],
  );

  const onExport = async () => {
    setError(null);
    setBusy(true);
    try {
      const uri = await shotRef.current?.capture?.();
      if (!uri) throw new Error("capture failed");

      const Sharing = await import("expo-sharing");
      if (await Sharing.isAvailableAsync()) {
        // The native share sheet covers saving to photos, Instagram, Pinterest
        // and the rest without the app needing per-platform integrations.
        await Sharing.shareAsync(uri, {
          mimeType: "image/png",
          dialogTitle: `Partager ${name}`,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError("Le partage n'est pas disponible sur cet appareil.");
      }
    } catch {
      setError("L'export a échoué. Réessaie.");
    } finally {
      setBusy(false);
    }
  };

  if (!hex || !rgb) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <EmptyState
          title="Rien à mettre en scène"
          subtitle="Scanne une couleur pour créer une carte partageable."
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text }]}>Créer</Text>
        <Text style={[styles.subtitle, { color: theme.subtext }]}>
          Une couleur, un modèle, un format — puis partage.
        </Text>
      </View>

      <ViewShot
        ref={shotRef}
        options={{ format: "png", quality: EXPORT_QUALITY[quality], width: format.width, height: format.height }}
      >
        <ShareCard
          hex={hex}
          rgb={rgb}
          name={name}
          template={template}
          format={format}
          palette={palette}
        />
      </ViewShot>

      <Picker
        title="Couleur"
        theme={theme}
        options={recent.map((entry) => entry.hex)}
        selected={hex}
        onSelect={setSelectedHex}
        renderSwatch
      />

      <Picker
        title="Modèle"
        theme={theme}
        options={TEMPLATES.map((entry) => entry.id)}
        labels={Object.fromEntries(TEMPLATES.map((entry) => [entry.id, entry.label]))}
        selected={template}
        onSelect={(value) => setTemplate(value as TemplateId)}
      />

      <Picker
        title="Format"
        theme={theme}
        options={SOCIAL_FORMATS.map((entry) => entry.id)}
        labels={Object.fromEntries(SOCIAL_FORMATS.map((entry) => [entry.id, entry.label]))}
        selected={format.id}
        onSelect={(value) =>
          setFormat(SOCIAL_FORMATS.find((entry) => entry.id === value) ?? SOCIAL_FORMATS[0])
        }
      />

      <Picker
        title="Qualité"
        theme={theme}
        options={Object.keys(EXPORT_QUALITY_LABELS)}
        labels={EXPORT_QUALITY_LABELS}
        selected={quality}
        onSelect={(value) => setQuality(value as ExportQuality)}
      />

      <Text style={[styles.hint, { color: theme.subtext }]}>
        Export en {format.width} × {format.height} px, PNG sans perte.
      </Text>

      {error ? <ErrorBanner message={error} /> : null}

      <PrimaryButton
        label={saved ? "Partagé ✓" : "Exporter et partager"}
        onPress={onExport}
        loading={busy}
      />
    </ScrollView>
  );
}

function Picker({
  title,
  options,
  labels,
  selected,
  onSelect,
  theme,
  renderSwatch,
}: {
  title: string;
  options: string[];
  labels?: Record<string, string>;
  selected: string;
  onSelect: (value: string) => void;
  theme: ReturnType<typeof useTheme>;
  renderSwatch?: boolean;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {options.map((option) => {
            const active = option === selected;
            const press = () => {
              Haptics.selectionAsync();
              onSelect(option);
            };

            if (renderSwatch) {
              return (
                <Pressable
                  key={option}
                  onPress={press}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Couleur ${option}`}
                  style={[
                    styles.swatch,
                    {
                      backgroundColor: option,
                      borderColor: active ? theme.accent : theme.border,
                      borderWidth: active ? 3 : StyleSheet.hairlineWidth,
                    },
                  ]}
                />
              );
            }

            return (
              <Pressable
                key={option}
                onPress={press}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? theme.accent : theme.surface,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text style={{ color: active ? theme.background : theme.text, fontSize: 13 }}>
                  {labels?.[option] ?? option}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  header: { gap: 4 },
  title: { fontSize: 26, fontWeight: "700" },
  subtitle: { fontSize: 13 },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  row: { flexDirection: "row", gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: spacing.xs,
  },
  swatch: { width: 44, height: 44, borderRadius: 12, marginRight: spacing.xs },
  hint: { fontSize: 12 },
});
