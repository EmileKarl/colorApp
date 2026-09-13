import { hexToRgb, normalizeHex, rgbToHsl } from "../lib/color";
import { hexToLch } from "../objects/renderer/shading";
import { rgbToCmyk } from "./colorFacts";

/**
 * Data export — ColorLens page 19, "exporter aussi : HEX, RGB, HSL, JSON, CSS,
 * variables de design".
 *
 * All of it is text generation from measured values, so all of it is testable
 * and none of it can drift from what the app displays.
 */

export type DataExportFormat = "hex" | "rgb" | "hsl" | "json" | "css" | "tokens" | "svg";

export const DATA_FORMAT_LABEL: Record<DataExportFormat, string> = {
  hex: "HEX",
  rgb: "RGB",
  hsl: "HSL",
  json: "JSON",
  css: "CSS",
  tokens: "Variables de design",
  svg: "SVG",
};

export type ExportPalette = {
  name: string;
  colors: { hex: string; role?: string | null }[];
};

/**
 * Turns a palette name into a valid identifier for CSS and token files.
 *
 * Accents are stripped rather than escaped: `--bleu-cobalt` works everywhere,
 * `--bleu-cobàlt` is legal CSS but breaks a surprising number of build tools
 * that assume ASCII identifiers.
 */
export function slugify(value: string): string {
  const withoutAccents = value.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const slug = withoutAccents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // An identifier cannot start with a digit in CSS, and an empty name must
  // still produce something usable rather than `--`.
  if (slug.length === 0) return "palette";
  return /^[0-9]/.test(slug) ? `c-${slug}` : slug;
}

export function exportPalette(palette: ExportPalette, format: DataExportFormat): string {
  const colors = palette.colors.map((entry) => ({
    ...entry,
    hex: normalizeHex(entry.hex),
  }));
  const slug = slugify(palette.name);

  switch (format) {
    case "hex":
      return colors.map((entry) => entry.hex.toUpperCase()).join("\n");

    case "rgb":
      return colors
        .map((entry) => {
          const { r, g, b } = hexToRgb(entry.hex);
          return `rgb(${r}, ${g}, ${b})`;
        })
        .join("\n");

    case "hsl":
      return colors
        .map((entry) => {
          const { h, s, l } = rgbToHsl(hexToRgb(entry.hex));
          return `hsl(${h}, ${s}%, ${l}%)`;
        })
        .join("\n");

    case "json":
      return JSON.stringify(
        {
          name: palette.name,
          colors: colors.map((entry) => {
            const rgb = hexToRgb(entry.hex);
            const hsl = rgbToHsl(rgb);
            const lch = hexToLch(entry.hex);
            return {
              hex: entry.hex,
              role: entry.role ?? null,
              rgb,
              hsl,
              // Rounded to one decimal: the extra precision is below what the
              // measurement can justify, and noisy in a file people read.
              lch: {
                l: Math.round(lch.L * 10) / 10,
                c: Math.round(lch.C * 10) / 10,
                h: Math.round(lch.h * 10) / 10,
              },
              cmyk: rgbToCmyk(entry.hex),
            };
          }),
        },
        null,
        2,
      );

    case "css":
      return [
        ":root {",
        ...colors.map((entry, index) => {
          const name = entry.role ? slugify(entry.role) : `${index + 1}`;
          return `  --${slug}-${name}: ${entry.hex};`;
        }),
        "}",
      ].join("\n");

    case "tokens":
      // W3C design-token draft shape: what Figma, Style Dictionary and most
      // token pipelines consume.
      return JSON.stringify(
        {
          [slug]: Object.fromEntries(
            colors.map((entry, index) => [
              entry.role ? slugify(entry.role) : `${index + 1}`,
              { $type: "color", $value: entry.hex },
            ]),
          ),
        },
        null,
        2,
      );

    case "svg": {
      // A swatch strip, so the palette can be dropped into a design tool that
      // reads vectors rather than pixels.
      const width = 100;
      const height = 100;
      const step = width / Math.max(colors.length, 1);
      const rects = colors
        .map(
          (entry, index) =>
            `  <rect x="${(index * step).toFixed(3)}" y="0" width="${step.toFixed(3)}" height="${height}" fill="${entry.hex}"/>`,
        )
        .join("\n");
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">\n${rects}\n</svg>`;
    }
  }
}

/** File extension for a data export, for naming a shared file. */
export function dataFormatExtension(format: DataExportFormat): string {
  switch (format) {
    case "json":
    case "tokens":
      return "json";
    case "css":
      return "css";
    case "svg":
      return "svg";
    default:
      return "txt";
  }
}

// ---------------------------------------------------------------------------
// Image formats
// ---------------------------------------------------------------------------

export type ImageExportFormat = "png" | "jpg";

export const IMAGE_FORMAT_LABEL: Record<ImageExportFormat, string> = {
  png: "PNG",
  jpg: "JPG",
};

export const IMAGE_FORMAT_HINT: Record<ImageExportFormat, string> = {
  png: "Sans perte, fond transparent possible. Fichier plus lourd.",
  jpg: "Plus léger, sans transparence. Recompresse légèrement les couleurs.",
};

/**
 * WebP is not offered, and that is a limitation rather than an omission.
 *
 * `react-native-view-shot` — the only screen-capture module available inside
 * Expo Go — encodes to PNG, JPG and WebM only. Offering a WebP button that
 * silently produced a PNG would be worse than not offering it, so the export
 * sheet says this instead.
 */
export const WEBP_UNAVAILABLE =
  "WebP n’est pas disponible : le module de capture inclus dans Expo Go n’encode qu’en PNG et JPG.";
