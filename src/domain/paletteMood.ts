import { hexToLch } from "../objects/renderer/shading";
import { contrastRatio } from "./contrast";
import { hexToRgb } from "../lib/color";

/**
 * Aesthetic reading of a palette — ColorLens page 7.
 *
 * The spec asks the app to say whether a palette is "chaleureuse", "luxueuse",
 * "sportive" and so on, and to suggest what it is good for. That could be
 * invented, and inventing it is what most apps do. Here every judgement is
 * scored from **measured properties** of the palette — mean lightness, mean
 * chroma, how far apart the colors sit, whether the hues are warm or cool, how
 * much contrast the set contains — and every result carries the reason it was
 * chosen, so the user can disagree with the reasoning rather than being asked
 * to trust a label.
 *
 * This is the honest version of the feature: it is not a language model's
 * impression, and it does not claim to be taste. It is a description of what
 * the numbers say.
 */

export type MoodId =
  | "warm"
  | "natural"
  | "luxurious"
  | "sporty"
  | "futuristic"
  | "soft"
  | "minimal"
  | "energetic"
  | "vintage";

export const MOOD_LABEL_FR: Record<MoodId, string> = {
  warm: "Chaleureuse",
  natural: "Naturelle",
  luxurious: "Luxueuse",
  sporty: "Sportive",
  futuristic: "Futuriste",
  soft: "Douce",
  minimal: "Minimaliste",
  energetic: "Énergique",
  vintage: "Vintage",
};

export type PaletteMetrics = {
  /** Mean L* across the palette. */
  meanLightness: number;
  /** Mean C* across the palette. */
  meanChroma: number;
  /** Range of L* — how much tonal contrast the set carries. */
  lightnessSpread: number;
  /** Range of C*. */
  chromaSpread: number;
  /**
   * How spread the hues are, 0–180 degrees. Computed as the largest gap
   * between adjacent hues subtracted from 360, which is the standard way to
   * measure angular spread without being fooled by the 0/360 wrap.
   */
  hueSpread: number;
  /** Share of colors in the warm arc, 0–1. */
  warmShare: number;
  /** Highest WCAG contrast ratio between any two colors in the palette. */
  maxContrast: number;
};

export function paletteMetrics(palette: string[]): PaletteMetrics {
  const coordinates = palette.map((hex) => hexToLch(hex));
  const lightnesses = coordinates.map((entry) => entry.L);
  const chromas = coordinates.map((entry) => entry.C);

  // Hue is only meaningful where there is chroma to carry it; including
  // near-greys would make every palette look hue-spread.
  const hues = coordinates.filter((entry) => entry.C >= 8).map((entry) => entry.h);

  const mean = (values: number[]) =>
    values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;
  const spread = (values: number[]) =>
    values.length === 0 ? 0 : Math.max(...values) - Math.min(...values);

  let maxContrast = 1;
  for (let i = 0; i < palette.length; i++) {
    for (let j = i + 1; j < palette.length; j++) {
      const ratio = contrastRatio(hexToRgb(palette[i]), hexToRgb(palette[j]));
      if (ratio > maxContrast) maxContrast = ratio;
    }
  }

  const warm = hues.filter((h) => h < 110 || h >= 340).length;

  return {
    meanLightness: mean(lightnesses),
    meanChroma: mean(chromas),
    lightnessSpread: spread(lightnesses),
    chromaSpread: spread(chromas),
    hueSpread: angularSpread(hues),
    warmShare: hues.length === 0 ? 0 : warm / hues.length,
    maxContrast,
  };
}

/**
 * Angular spread of a set of hues, in degrees.
 *
 * Naively taking max minus min is wrong on a circle: hues at 350° and 10° are
 * 20° apart, not 340°. The correct measure is 360 minus the largest gap
 * between consecutive hues, which is invariant to where the wrap falls.
 */
function angularSpread(hues: number[]): number {
  if (hues.length < 2) return 0;
  const sorted = [...hues].sort((a, b) => a - b);
  let largestGap = 360 - sorted[sorted.length - 1] + sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    largestGap = Math.max(largestGap, sorted[i] - sorted[i - 1]);
  }
  return Math.min(360 - largestGap, 360);
}

export type MoodScore = {
  mood: MoodId;
  /** 0–1. Not a probability — a relative fit among the nine. */
  score: number;
  /** The measurements that produced it, for the user to judge. */
  reason: string;
};

/**
 * Scores all nine readings and returns them ranked.
 *
 * Each rule is a small set of measured conditions. Returning the full ranking
 * rather than a single winner matters: palettes are rarely one thing, and
 * showing the runner-up with its reason is more useful — and more honest —
 * than asserting a single label.
 */
export function paletteMoods(palette: string[]): MoodScore[] {
  if (palette.length === 0) return [];
  const m = paletteMetrics(palette);

  const scores: MoodScore[] = [
    {
      mood: "warm",
      score: m.warmShare * 0.75 + Math.min(m.meanChroma / 60, 1) * 0.25,
      reason: `${Math.round(m.warmShare * 100)} % des couleurs sont dans l'arc chaud.`,
    },
    {
      mood: "natural",
      // Earth palettes: mid lightness, restrained chroma, hues clustered in
      // the yellow-green-brown arc rather than spread across the wheel.
      score:
        band(m.meanChroma, 12, 38) * 0.4 +
        band(m.meanLightness, 35, 72) * 0.3 +
        (1 - Math.min(m.hueSpread / 180, 1)) * 0.3,
      reason: `Chroma moyen ${Math.round(m.meanChroma)}, teintes regroupées sur ${Math.round(m.hueSpread)}°.`,
    },
    {
      mood: "luxurious",
      // Restraint reads as expensive: dark, low chroma, little tonal noise.
      score:
        (1 - Math.min(m.meanLightness / 60, 1)) * 0.45 +
        (1 - Math.min(m.meanChroma / 50, 1)) * 0.35 +
        (1 - Math.min(m.hueSpread / 120, 1)) * 0.2,
      reason: `Luminosité moyenne ${Math.round(m.meanLightness)}, chroma faible, peu de teintes.`,
    },
    {
      mood: "sporty",
      // Vivid color against a big tonal jump — the white-and-one-bright-color
      // logic of athletic products.
      score:
        Math.min(m.meanChroma / 55, 1) * 0.4 +
        Math.min(m.lightnessSpread / 70, 1) * 0.35 +
        Math.min(m.maxContrast / 12, 1) * 0.25,
      reason: `Écart de luminosité ${Math.round(m.lightnessSpread)}, contraste maximal ${m.maxContrast.toFixed(1)}:1.`,
    },
    {
      mood: "futuristic",
      score:
        (1 - Math.min(m.meanLightness / 55, 1)) * 0.35 +
        Math.min(m.meanChroma / 60, 1) * 0.35 +
        (1 - m.warmShare) * 0.3,
      reason: `Fond sombre, chroma ${Math.round(m.meanChroma)}, dominante froide.`,
    },
    {
      mood: "soft",
      score:
        Math.min(Math.max(m.meanLightness - 60, 0) / 30, 1) * 0.5 +
        (1 - Math.min(m.meanChroma / 40, 1)) * 0.5,
      reason: `Luminosité haute (${Math.round(m.meanLightness)}) et chroma contenu.`,
    },
    {
      mood: "minimal",
      score:
        (1 - Math.min(m.meanChroma / 30, 1)) * 0.5 +
        (1 - Math.min(m.hueSpread / 90, 1)) * 0.3 +
        (1 - Math.min(m.chromaSpread / 40, 1)) * 0.2,
      reason: `Chroma moyen ${Math.round(m.meanChroma)}, une seule famille de teintes.`,
    },
    {
      mood: "energetic",
      score:
        Math.min(m.meanChroma / 65, 1) * 0.45 +
        Math.min(m.hueSpread / 160, 1) * 0.3 +
        Math.min(Math.max(m.meanLightness - 40, 0) / 40, 1) * 0.25,
      reason: `Chroma élevé et teintes réparties sur ${Math.round(m.hueSpread)}°.`,
    },
    {
      mood: "vintage",
      // Faded: mid-to-low chroma, warm bias, and crucially *low* contrast —
      // aged prints lose their blacks and their whites alike.
      score:
        band(m.meanChroma, 10, 34) * 0.35 +
        m.warmShare * 0.3 +
        (1 - Math.min(m.maxContrast / 9, 1)) * 0.35,
      reason: `Chroma modéré, dominante chaude, contraste maximal ${m.maxContrast.toFixed(1)}:1.`,
    },
  ];

  return scores
    .map((entry) => ({ ...entry, score: Math.max(0, Math.min(1, entry.score)) }))
    .sort((a, b) => b.score - a.score);
}

/** 1 inside [low, high], falling off linearly outside it. */
function band(value: number, low: number, high: number): number {
  if (value >= low && value <= high) return 1;
  const distance = value < low ? low - value : value - high;
  const width = (high - low) / 2 || 1;
  return Math.max(0, 1 - distance / width);
}

// ---------------------------------------------------------------------------
// Suggested uses
// ---------------------------------------------------------------------------

export type UseId =
  | "fashion"
  | "automotive"
  | "interior"
  | "branding"
  | "ui"
  | "photography"
  | "illustration"
  | "packaging"
  | "social";

export const USE_LABEL_FR: Record<UseId, string> = {
  fashion: "Mode",
  automotive: "Automobile",
  interior: "Décoration",
  branding: "Branding",
  ui: "UI/UX",
  photography: "Photographie",
  illustration: "Illustration",
  packaging: "Packaging",
  social: "Réseaux sociaux",
};

export type UseSuggestion = { use: UseId; reason: string };

/**
 * Which uses the palette actually supports, with the measurement behind each.
 *
 * Deliberately not a ranked list of all nine: a palette that cannot carry
 * readable text should not be "suggested for UI/UX" at position seven, it
 * should simply not be suggested. The requirements below are the real
 * constraints each medium imposes.
 */
export function suggestedUses(palette: string[]): UseSuggestion[] {
  if (palette.length === 0) return [];
  const m = paletteMetrics(palette);
  const suggestions: UseSuggestion[] = [];

  // Interfaces need a text/background pair that passes WCAG AA for body text.
  if (m.maxContrast >= 4.5) {
    suggestions.push({
      use: "ui",
      reason: `Contient une paire à ${m.maxContrast.toFixed(1)}:1 — suffisant pour du texte (WCAG AA).`,
    });
  }

  // A brand palette has to stay recognisable when reproduced badly, which
  // means the colors must be far apart in tone, not only in hue.
  if (m.lightnessSpread >= 30 && m.meanChroma >= 15) {
    suggestions.push({
      use: "branding",
      reason: `Écart tonal de ${Math.round(m.lightnessSpread)} points — les couleurs restent distinctes en niveaux de gris.`,
    });
  }

  if (m.meanChroma >= 30 && m.lightnessSpread >= 25) {
    suggestions.push({
      use: "social",
      reason: "Couleurs saturées et contrastées : elles tiennent dans un fil compressé.",
    });
  }

  if (m.meanChroma <= 40 && m.meanLightness >= 35 && m.meanLightness <= 80) {
    suggestions.push({
      use: "interior",
      reason: "Chroma contenu et luminosité moyenne — tenable sur de grandes surfaces.",
    });
  }

  if (m.meanChroma >= 20) {
    suggestions.push({
      use: "fashion",
      reason: "Assez de couleur pour se lire sur un vêtement.",
    });
  }

  if (m.meanLightness <= 60 && m.hueSpread <= 120) {
    suggestions.push({
      use: "automotive",
      reason: "Teintes resserrées et plutôt profondes, comme une gamme carrosserie.",
    });
  }

  if (m.meanChroma >= 25 && m.hueSpread >= 60) {
    suggestions.push({
      use: "illustration",
      reason: `Teintes réparties sur ${Math.round(m.hueSpread)}° — de quoi séparer des plans.`,
    });
  }

  if (m.maxContrast >= 3 && m.meanChroma >= 25) {
    suggestions.push({
      use: "packaging",
      reason: "Contraste et saturation suffisants pour ressortir en rayon.",
    });
  }

  if (m.meanChroma <= 35) {
    suggestions.push({
      use: "photography",
      reason: "Palette retenue : elle accompagne une image sans lutter contre elle.",
    });
  }

  return suggestions;
}
