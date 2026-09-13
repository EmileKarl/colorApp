import { labToLch, labToRgb, rgbToLab } from "../color-engine/color-spaces/lab";
import { deltaE2000 } from "../color-engine/metrics/deltaE2000";
import { generateHarmony, type HarmonyScheme } from "./harmony";
import { findPaletteAccessibilityIssues } from "./colorVision";
import { checkContrast, readableTextColor } from "./contrast";
import type { RGB } from "../color-engine/types";

/**
 * Palette generation.
 *
 * A palette is more than a list of colors: to be usable it needs enough
 * separation between entries, a readable text color for each swatch, and an
 * honest note when it breaks down for color-blind viewers. All of that is
 * computed here so the UI only has to render it.
 */

/** Named styles from spec §11, each a curated combination of harmony schemes. */
export type PaletteStyle =
  | "minimal"
  | "luxury"
  | "nature"
  | "modern"
  | "pastel"
  | "bold"
  | "corporate"
  | "fashion"
  | "interior"
  | "digital";

export const PALETTE_STYLE_LABELS: Record<PaletteStyle, string> = {
  minimal: "Minimal",
  luxury: "Luxe",
  nature: "Nature",
  modern: "Moderne",
  pastel: "Pastel",
  bold: "Audacieux",
  corporate: "Corporate",
  fashion: "Mode",
  interior: "Intérieur",
  digital: "Digital",
};

/** Which harmony each style is built from, and how it is toned. */
const STYLE_RECIPES: Record<PaletteStyle, { scheme: HarmonyScheme; description: string }> = {
  minimal: { scheme: "minimal", description: "Neutres et un seul accent." },
  luxury: { scheme: "luxury", description: "Fonds profonds, accent lumineux." },
  nature: { scheme: "earth", description: "Ocres et verts, chroma contenu." },
  modern: { scheme: "split_complementary", description: "Contraste net, sans agressivité." },
  pastel: { scheme: "pastel", description: "Luminosité haute, chroma bas." },
  bold: { scheme: "vibrant", description: "Chroma poussé, fort impact." },
  corporate: { scheme: "monochromatic", description: "Une teinte déclinée, sobre et lisible." },
  fashion: { scheme: "analogous", description: "Teintes voisines, transitions douces." },
  interior: { scheme: "warm", description: "Tons chauds, ambiance habitée." },
  digital: { scheme: "triadic", description: "Trois teintes équilibrées, lisibles à l'écran." },
};

export type PaletteSwatch = {
  rgb: RGB;
  hex: string;
  /** Black or white, whichever reads on this swatch. */
  textColor: RGB;
  /** Contrast ratio of that text against the swatch. */
  textContrast: number;
  /** Share of the source image, 0–1. Only set for photo-derived palettes. */
  proportion?: number;
  /** Role in a photo-derived palette. */
  role?: PaletteRole;
};

export type PaletteRole = "dominant" | "secondary" | "accent" | "dark" | "light" | "neutral";

export type Palette = {
  swatches: PaletteSwatch[];
  /** Minimum ΔE₀₀ between any two swatches — how distinguishable the set is. */
  minSeparation: number;
  /**
   * Pairs that collapse together for color-blind viewers, if any. Empty means
   * the palette survives all simulated deficiencies.
   */
  accessibilityIssues: ReturnType<typeof findPaletteAccessibilityIssues>;
  style?: PaletteStyle;
  description?: string;
};

const toHex = (rgb: RGB) =>
  `#${[rgb.r, rgb.g, rgb.b]
    .map((v) => Math.min(255, Math.max(0, Math.round(v))).toString(16).padStart(2, "0"))
    .join("")}`;

/** Wraps raw colors into swatches with their derived display data. */
export function buildPalette(
  colors: RGB[],
  extras: { style?: PaletteStyle; description?: string; roles?: PaletteRole[]; proportions?: number[] } = {},
): Palette {
  const swatches: PaletteSwatch[] = colors.map((rgb, index) => {
    const textColor = readableTextColor(rgb);
    return {
      rgb,
      hex: toHex(rgb),
      textColor,
      textContrast: checkContrast(textColor, rgb).ratio,
      role: extras.roles?.[index],
      proportion: extras.proportions?.[index],
    };
  });

  return {
    swatches,
    minSeparation: minimumSeparation(colors),
    accessibilityIssues: findPaletteAccessibilityIssues(colors),
    style: extras.style,
    description: extras.description,
  };
}

/** Smallest perceptual gap between any two colors in a set. */
export function minimumSeparation(colors: RGB[]): number {
  if (colors.length < 2) return Infinity;
  const labs = colors.map((c) => rgbToLab(c));
  let min = Infinity;
  for (let i = 0; i < labs.length; i++) {
    for (let j = i + 1; j < labs.length; j++) {
      min = Math.min(min, deltaE2000(labs[i], labs[j]));
    }
  }
  return Math.round(min * 10) / 10;
}

/**
 * Generates a styled palette from a base color.
 *
 * @param base The scanned or chosen color.
 * @param style Which curated style to apply.
 * @param count Target swatch count (3, 5, 8 or 12 per the spec).
 * @returns A ready-to-render palette, always containing at least the base color.
 */
export function generatePalette(base: RGB, style: PaletteStyle, count = 5): Palette {
  const recipe = STYLE_RECIPES[style];
  const harmony = generateHarmony(base, recipe.scheme, count);

  const colors = expandToCount(harmony.colors, base, count);

  return buildPalette(colors, {
    style,
    description: `${recipe.description} ${harmony.rationale}`,
  });
}

/**
 * Grows or trims a color set to exactly `count` entries.
 *
 * Geometric harmonies have a fixed natural size (a triad has three colors), so
 * reaching 8 or 12 swatches means adding lightness variations of the colors
 * already chosen rather than inventing new hues — which would break the very
 * harmony the user picked.
 */
function expandToCount(colors: RGB[], base: RGB, count: number): RGB[] {
  if (colors.length >= count) return colors.slice(0, count);

  const result = [...colors];
  const sourceLch = colors.map((c) => labToLch(rgbToLab(c)));
  let index = 0;

  while (result.length < count) {
    const source = sourceLch[index % sourceLch.length];
    // Alternate lighter and darker variations around each source color.
    const round = Math.floor(index / sourceLch.length) + 1;
    const direction = index % 2 === 0 ? 1 : -1;
    const L = Math.min(94, Math.max(14, source.L + direction * 14 * round));
    result.push(labToRgb({ L, a: 0, b: 0 }));

    // Recompute properly in LCh so hue and chroma survive the lightness shift.
    result[result.length - 1] = labToRgb(
      lchToLabSafe({ L, C: source.C * (L > 80 || L < 25 ? 0.55 : 0.9), h: source.h }),
    );
    index++;
    if (index > count * 4) break; // safety: never loop forever
  }

  // Keep the base color present even after trimming.
  if (!result.some((c) => c.r === base.r && c.g === base.g && c.b === base.b)) {
    result[0] = base;
  }
  return result.slice(0, count);
}

function lchToLabSafe(lch: { L: number; C: number; h: number }) {
  const radians = (lch.h * Math.PI) / 180;
  return { L: lch.L, a: lch.C * Math.cos(radians), b: lch.C * Math.sin(radians) };
}

/** Supported swatch counts from spec §11. */
export const PALETTE_SIZES = [3, 5, 8, 12] as const;

/** Every style, in presentation order. */
export const ALL_PALETTE_STYLES: PaletteStyle[] = [
  "minimal",
  "modern",
  "bold",
  "pastel",
  "luxury",
  "nature",
  "corporate",
  "fashion",
  "interior",
  "digital",
];

/** Formats a palette for copy/paste in the requested notation. */
export function formatPalette(palette: Palette, format: "hex" | "rgb" | "hsl" | "lab"): string {
  return palette.swatches
    .map((swatch) => {
      const lab = rgbToLab(swatch.rgb);
      const lch = labToLch(lab);
      switch (format) {
        case "hex":
          return swatch.hex.toUpperCase();
        case "rgb":
          return `rgb(${swatch.rgb.r}, ${swatch.rgb.g}, ${swatch.rgb.b})`;
        case "hsl": {
          // Derived from LCh so the reported hue matches the perceptual hue the
          // rest of the app uses, rather than HSL's cruder geometry.
          return `hsl(${Math.round(lch.h)}, ${Math.round(lch.C)}%, ${Math.round(lab.L)}%)`;
        }
        case "lab":
          return `lab(${lab.L.toFixed(1)} ${lab.a.toFixed(1)} ${lab.b.toFixed(1)})`;
      }
    })
    .join("\n");
}
