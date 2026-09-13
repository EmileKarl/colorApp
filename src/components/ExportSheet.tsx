import * as Clipboard from "expo-clipboard";
import { Directory, File, Paths } from "expo-file-system";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import {
  DATA_FORMAT_LABEL,
  IMAGE_FORMAT_HINT,
  IMAGE_FORMAT_LABEL,
  WEBP_UNAVAILABLE,
  dataFormatExtension,
  exportPalette,
  slugify,
  type DataExportFormat,
  type ExportPalette,
  type ImageExportFormat,
} from "../domain/colorExport";
import { monoFontFamily, radius, spacing, type, useTheme } from "../theme";
import { Chip } from "./Chip";
import { PrimaryButton } from "./PrimaryButton";
import { Sheet } from "./Sheet";

type Props = {
  visible: boolean;
  onClose: () => void;
  palette: ExportPalette;
  /** Captures the current view and returns a file URI. */
  onCaptureImage?: (format: ImageExportFormat) => Promise<string | undefined>;
};

const DATA_FORMATS: DataExportFormat[] = ["hex", "rgb", "hsl", "json", "css", "tokens", "svg"];
const IMAGE_FORMATS: ImageExportFormat[] = ["png", "jpg"];

/**
 * Export sheet — ColorLens page 19.
 *
 * Two halves: the image, and the data. The data half is the one that matters
 * to anyone actually building something with a color, and it is the half most
 * colour apps skip.
 *
 * Text is written to a real file and shared rather than pushed through the
 * share sheet as a string: a `.css` or `.json` arriving as a file can be
 * opened by the receiving app, where the same content as plain text usually
 * lands in a notes field.
 */
export function ExportSheet({ visible, onClose, palette, onCaptureImage }: Props) {
  const theme = useTheme();
  const [format, setFormat] = useState<DataExportFormat>("css");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const content = exportPalette(palette, format);

  const share = async (uri: string) => {
    const Sharing = await import("expo-sharing");
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
  };

  const onShareData = async () => {
    setBusy(true);
    setError(null);
    try {
      const name = `${slugify(palette.name)}.${dataFormatExtension(format)}`;
      const directory = new Directory(Paths.cache, "colorlens-exports");
      if (!directory.exists) directory.create({ intermediates: true });
      const file = new File(directory, name);
      // Overwrite rather than fail: exporting the same palette twice is the
      // normal case, not an error.
      if (file.exists) file.delete();
      file.create();
      file.write(content);
      await share(file.uri);
    } catch {
      setError("Le partage du fichier a échoué. Tu peux copier le contenu à la place.");
    } finally {
      setBusy(false);
    }
  };

  const onShareImage = async (imageFormat: ImageExportFormat) => {
    if (!onCaptureImage) return;
    setBusy(true);
    setError(null);
    try {
      const uri = await onCaptureImage(imageFormat);
      if (uri) await share(uri);
    } catch {
      setError("L’export de l’image a échoué.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Exporter" subtitle={palette.name}>
      {onCaptureImage ? (
        <View style={styles.section}>
          <Text style={[type.label, { color: theme.text }]}>Image</Text>
          <View style={styles.row}>
            {IMAGE_FORMATS.map((entry) => (
              <PrimaryButton
                key={entry}
                label={IMAGE_FORMAT_LABEL[entry]}
                size="sm"
                variant="secondary"
                loading={busy}
                onPress={() => onShareImage(entry)}
              />
            ))}
          </View>
          <Text style={[type.caption, { color: theme.subtext }]}>
            {IMAGE_FORMAT_HINT.png} · {WEBP_UNAVAILABLE}
          </Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[type.label, { color: theme.text }]}>Données</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {DATA_FORMATS.map((entry) => (
            <Chip
              key={entry}
              label={DATA_FORMAT_LABEL[entry]}
              selected={format === entry}
              onPress={() => setFormat(entry)}
            />
          ))}
        </ScrollView>

        {/* The content is shown, not just promised: the user can see exactly
            what they are about to copy. */}
        <ScrollView
          style={[styles.preview, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
          contentContainerStyle={styles.previewContent}
        >
          <Text style={[type.caption, styles.mono, { color: theme.text }]}>{content}</Text>
        </ScrollView>
      </View>

      {error ? <Text style={[type.caption, { color: theme.danger }]}>{error}</Text> : null}

      <PrimaryButton
        label={copied ? "Copié ✓" : "Copier"}
        icon="copy-outline"
        variant="secondary"
        onPress={async () => {
          await Clipboard.setStringAsync(content);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        }}
      />
      <PrimaryButton
        label="Partager le fichier"
        icon="share-outline"
        loading={busy}
        onPress={onShareData}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  row: { flexDirection: "row", gap: spacing.sm },
  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
  preview: {
    maxHeight: 180,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  previewContent: { padding: spacing.md },
  mono: { fontFamily: monoFontFamily },
});
