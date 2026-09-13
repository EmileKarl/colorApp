import { hexToLch } from "../objects/renderer/shading";
import { hexToRgb } from "../lib/color";

/**
 * Measured facts about a single color — ColorLens page 6.
 *
 * Everything here is derived arithmetically from the color itself. Nothing is
 * suggested, guessed or generated: §8 reserves exact colorimetric values for
 * the deterministic engine, and these are exactly that.
 */

// ---------------------------------------------------------------------------
// CMYK
// ---------------------------------------------------------------------------

export type Cmyk = { c: number; m: number; y: number; k: number };

/**
 * Naive sRGB → CMYK conversion, in percent.
 *
 * **This is an indication, not a printing value.** A real conversion needs an
 * ICC profile for the specific press, paper and ink set, because CMYK is a
 * device space: the same numbers produce visibly different colors on coated
 * and uncoated stock. This formula assumes no ink limit, no dot gain and no
 * black generation strategy, all of which a print shop's profile defines.
 *
 * It is still worth showing, because a designer comparing two colors wants to
 * know roughly how much ink separates them. The screen must say what it is —
 * see the caveat rendered next to it.
 */
export function rgbToCmyk(hex: string): Cmyk {
  const { r, g, b } = hexToRgb(hex);
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;
  const k = 1 - Math.max(rf, gf, bf);

  // Pure black: the chromatic channels are undefined (division by zero), and
  // zero is the only answer that round-trips.
  if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };

  return {
    c: Math.round(((1 - rf - k) / (1 - k)) * 100),
    m: Math.round(((1 - gf - k) / (1 - k)) * 100),
    y: Math.round(((1 - bf - k) / (1 - k)) * 100),
    k: Math.round(k * 100),
  };
}

export const CMYK_CAVEAT =
  "Conversion indicative : sans profil ICC, le rendu réel dépend de la presse, du papier et des encres.";

// ---------------------------------------------------------------------------
// Temperature
// ---------------------------------------------------------------------------

export type Temperature = "warm" | "cool" | "neutral";

export const TEMPERATURE_LABEL_FR: Record<Temperature, string> = {
  warm: "Chaude",
  cool: "Froide",
  neutral: "Neutre",
};

/**
 * Chroma below which a color has no meaningful temperature.
 *
 * A near-grey has a hue angle, but it is dominated by rounding: calling
 * #807e7d "warm" because its hue lands at 40° would be reading noise.
 */
export const NEUTRAL_CHROMA_LIMIT = 8;

/**
 * Warm, cool or neutral.
 *
 * A caveat worth stating plainly: correlated color temperature is defined for
 * *light sources*, not for surfaces. "Warm" and "cool" applied to a pigment
 * are a perceptual convention — reds and oranges recall fire, blues recall
 * water and shade — not a physical measurement. This function encodes that
 * convention, by hue angle in CIELAB, and does not pretend to be more.
 *
 * The boundaries sit near the yellow-green transition (around 110°) and the
 * magenta-red one (around 340°), which is where the convention's own
 * consensus lies.
 */
export function temperatureOf(hex: string): Temperature {
  const { C, h } = hexToLch(hex);
  if (C < NEUTRAL_CHROMA_LIMIT) return "neutral";
  // In CIELAB hue angles, 0° is red-magenta, 90° yellow, 180° green-cyan,
  // 270° blue. Warm spans the red→yellow arc; cool spans green→blue.
  if (h < 110 || h >= 340) return "warm";
  if (h >= 160 && h < 300) return "cool";
  // The two remaining arcs (yellow-green and blue-magenta) genuinely sit on
  // the fence, so they are reported as such rather than forced to a side.
  return "neutral";
}

// ---------------------------------------------------------------------------
// Plain-language descriptors
// ---------------------------------------------------------------------------

export type Brightness = "very_dark" | "dark" | "medium" | "light" | "very_light";
export type Saturation = "muted" | "soft" | "moderate" | "vivid" | "intense";

export const BRIGHTNESS_LABEL_FR: Record<Brightness, string> = {
  very_dark: "Très sombre",
  dark: "Sombre",
  medium: "Moyenne",
  light: "Claire",
  very_light: "Très claire",
};

export const SATURATION_LABEL_FR: Record<Saturation, string> = {
  muted: "Désaturée",
  soft: "Douce",
  moderate: "Modérée",
  vivid: "Vive",
  intense: "Intense",
};

/** Bands on L*, which is perceptually uniform — 50 really is the midpoint. */
export function brightnessOf(hex: string): Brightness {
  const { L } = hexToLch(hex);
  if (L < 20) return "very_dark";
  if (L < 40) return "dark";
  if (L < 65) return "medium";
  if (L < 85) return "light";
  return "very_light";
}

/**
 * Bands on C*.
 *
 * The ceiling is not 100: sRGB's most saturated colors reach about 130 in
 * chroma, and most real surfaces sit well below 60. The bands reflect what
 * actually occurs rather than an even split of an abstract range.
 */
export function saturationOf(hex: string): Saturation {
  const { C } = hexToLch(hex);
  if (C < 8) return "muted";
  if (C < 22) return "soft";
  if (C < 45) return "moderate";
  if (C < 75) return "vivid";
  return "intense";
}

export type ColorFacts = {
  hex: string;
  cmyk: Cmyk;
  temperature: Temperature;
  brightness: Brightness;
  saturation: Saturation;
  lightness: number;
  chroma: number;
  hue: number;
};

export function colorFacts(hex: string): ColorFacts {
  const { L, C, h } = hexToLch(hex);
  return {
    hex,
    cmyk: rgbToCmyk(hex),
    temperature: temperatureOf(hex),
    brightness: brightnessOf(hex),
    saturation: saturationOf(hex),
    lightness: Math.round(L * 10) / 10,
    chroma: Math.round(C * 10) / 10,
    hue: Math.round(h * 10) / 10,
  };
}
