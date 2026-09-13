import { findPaletteAccessibilityIssues } from "./colorVision";
import { hexToRgb } from "../lib/color";
import { paletteMoods, type MoodId } from "./paletteMood";

/**
 * Themed palettes for the Explorer — ColorLens page 21.
 *
 * These are **authored**, and the screen says so. That distinction matters:
 * the spec also asks for "couleurs populaires", "palettes tendances" and
 * "créateurs", all of which require real users, and fabricating them would be
 * inventing statistics. A curated theme is a different thing — it is an
 * editorial suggestion, honestly labelled, and it gives the Explorer something
 * genuinely useful to show before the app has an audience.
 *
 * Every palette is laid out on a deliberate **lightness ladder** rather than
 * being separated by hue alone. That is what makes it survive the app's own
 * accessibility checks: a set distinguished only by hue collapses under
 * red-green colour blindness and disappears entirely in greyscale. The first
 * draft of these palettes failed exactly that way, and the tests caught it.
 */

export type ThemeId =
  | "minimal"
  | "luxury"
  | "streetwear"
  | "nature"
  | "cyberpunk"
  | "vintage"
  | "tropical"
  | "monochrome"
  | "pastel"
  | "futuristic";

export type ColorTheme = {
  id: ThemeId;
  label: string;
  description: string;
  colors: string[];
};

export const THEMES: ColorTheme[] = [
  {
    id: "minimal",
    label: "Minimalisme",
    description: "Presque rien : des neutres chauds et un seul point d’appui.",
    colors: ["#f5f0e9", "#cfc5ba", "#9e948c", "#655d57", "#2d2723"],
  },
  {
    id: "luxury",
    label: "Luxe",
    description: "Noir profond, laiton, et un vert de coffre-fort.",
    colors: ["#201a17", "#453d2f", "#8b6d35", "#ceac67", "#395c47"],
  },
  {
    id: "streetwear",
    label: "Streetwear",
    description: "Bitume, kaki délavé, un orange de signalisation.",
    colors: ["#23282f", "#505141", "#8f8d70", "#ddd0bf", "#eb734a"],
  },
  {
    id: "nature",
    label: "Nature",
    description: "Mousse, écorce, pierre et lumière filtrée.",
    colors: ["#2e482c", "#5e7443", "#a5a370", "#e1c8ac", "#7b5641"],
  },
  {
    id: "cyberpunk",
    label: "Cyberpunk",
    description: "Nuit encrée, néon magenta, cyan d’écran.",
    colors: ["#10162e", "#2c3370", "#8265ce", "#ff6787", "#13d5e0"],
  },
  {
    id: "vintage",
    label: "Vintage",
    description: "Papier jauni, rouge passé, bleu de travail.",
    colors: ["#eedabf", "#d7a067", "#c25e54", "#19617b", "#403228"],
  },
  {
    id: "tropical",
    label: "Tropical",
    description: "Feuillage dense, fruit mûr, eau peu profonde.",
    colors: ["#005235", "#1a8341", "#fadb72", "#f67f56", "#009aa9"],
  },
  {
    id: "monochrome",
    label: "Monochrome",
    description: "Une seule teinte, du plus sombre au plus clair.",
    colors: ["#18252e", "#384e5d", "#657f92", "#9db4c5", "#d9e4ed"],
  },
  {
    id: "pastel",
    label: "Pastel",
    description: "Tons poudrés, à peine saturés.",
    colors: ["#ffe1e1", "#eac7e5", "#a2bee0", "#7eb09b", "#a18862"],
  },
  {
    id: "futuristic",
    label: "Futuriste",
    description: "Métal froid, verre teinté, une trace électrique.",
    colors: ["#14212a", "#2a4b58", "#547d8b", "#85b9c3", "#6feccf"],
  },
];

export const THEME_BY_ID: Record<ThemeId, ColorTheme> = Object.fromEntries(
  THEMES.map((theme) => [theme.id, theme]),
) as Record<ThemeId, ColorTheme>;

/**
 * The aesthetic reading a theme actually measures as.
 *
 * Derived rather than declared. An earlier version hand-labelled each theme —
 * "Luxe is luxurious" — and the scorer disagreed with several of them. The
 * scorer was right: a palette with a bright gold in it measures as warmer and
 * more natural than it does restrained. Rather than tune the numbers until the
 * labels agreed, the label is now computed, so it cannot be wrong.
 *
 * The theme's *name* stays editorial and is allowed to differ: "Luxe" is what
 * the palette is for, the measured mood is what it is.
 */
export function themeMood(theme: ColorTheme): MoodId {
  return paletteMoods(theme.colors)[0].mood;
}

/**
 * Accessibility notes for a theme, using the same check the palette screen
 * runs on generated palettes.
 *
 * Returned rather than suppressed. Some of these palettes genuinely have close
 * pairs under colour vision deficiency — a pastel set cannot be both pastel and
 * widely separated — and the honest response is to say so where the theme is
 * shown, exactly as the app already does for palettes it generates.
 */
export function themeAccessibilityIssues(theme: ColorTheme) {
  return findPaletteAccessibilityIssues(theme.colors.map((hex) => hexToRgb(hex)));
}
