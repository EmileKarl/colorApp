import { labToLch, lchToLab, rgbToLab, labToRgb } from "../color-engine/color-spaces/lab";
import type { LCh, RGB } from "../color-engine/types";

/**
 * Harmony engine.
 *
 * Colors are rotated and adjusted in **LCh**, not HSL. HSL's "lightness" is a
 * crude average of RGB extremes, so rotating hue in HSL silently changes how
 * light a color *looks*: a rotation from yellow to blue at constant HSL
 * lightness produces two colors a human sees as wildly different in brightness.
 * LCh is derived from CIELAB, so holding L* constant genuinely holds perceived
 * lightness constant, and a generated scheme stays balanced.
 *
 * Layer note: this is the domain layer. It depends on the color engine for the
 * math and knows nothing about React — which keeps it testable in Node.
 */

export type HarmonyScheme =
  | "complementary"
  | "analogous"
  | "triadic"
  | "split_complementary"
  | "tetradic"
  | "square"
  | "monochromatic"
  | "neutral"
  | "warm"
  | "cool"
  | "pastel"
  | "vibrant"
  | "earth"
  | "luxury"
  | "minimal";

export type HarmonyResult = {
  scheme: HarmonyScheme;
  /** Human-facing label. */
  label: string;
  /** The generated colors, base color first. */
  colors: RGB[];
  /** Why this scheme looks the way it does, for the UI to explain itself. */
  rationale: string;
};

/** Rotates hue by `degrees`, keeping L* and C* — and therefore perceived lightness. */
function rotateHue(lch: LCh, degrees: number): LCh {
  return { ...lch, h: ((lch.h + degrees) % 360 + 360) % 360 };
}

/** Clamps chroma and lightness into ranges that stay inside the sRGB gamut. */
function adjust(lch: LCh, options: { L?: number; C?: number }): LCh {
  return {
    L: clamp(options.L ?? lch.L, 0, 100),
    C: Math.max(0, options.C ?? lch.C),
    h: lch.h,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const toRgb = (lch: LCh): RGB => labToRgb(lchToLab(lch));

/**
 * Generates a harmony scheme from a base color.
 *
 * @param base The scanned or chosen color.
 * @param scheme Which relationship to build.
 * @param count Desired number of colors. Geometric schemes have a natural size
 * and ignore values below it; gradient-style schemes (monochromatic, the mood
 * families) honour it.
 * @returns The scheme, with the base color always first so the UI can show
 * what everything is derived from.
 *
 * Limits: generated colors are clamped into the sRGB gamut, so a very
 * saturated base can produce a scheme slightly less saturated than the pure
 * geometry would suggest. That is preferable to returning colors a screen
 * cannot display.
 */
export function generateHarmony(
  base: RGB,
  scheme: HarmonyScheme,
  count = 5,
): HarmonyResult {
  const lch = labToLch(rgbToLab(base));

  switch (scheme) {
    case "complementary":
      return {
        scheme,
        label: "Complémentaire",
        colors: [base, toRgb(rotateHue(lch, 180))],
        rationale: "Teinte opposée sur la roue : contraste maximal.",
      };

    case "analogous":
      return {
        scheme,
        label: "Analogue",
        colors: [
          toRgb(rotateHue(lch, -30)),
          base,
          toRgb(rotateHue(lch, 30)),
          ...(count > 3 ? [toRgb(rotateHue(lch, -60)), toRgb(rotateHue(lch, 60))] : []),
        ].slice(0, Math.max(3, count)),
        rationale: "Teintes voisines : harmonie douce, faible tension.",
      };

    case "triadic":
      return {
        scheme,
        label: "Triadique",
        colors: [base, toRgb(rotateHue(lch, 120)), toRgb(rotateHue(lch, 240))],
        rationale: "Trois teintes équidistantes : équilibré et vivant.",
      };

    case "split_complementary":
      return {
        scheme,
        label: "Complémentaire divisé",
        colors: [base, toRgb(rotateHue(lch, 150)), toRgb(rotateHue(lch, 210))],
        rationale: "Contraste de la complémentaire, mais moins agressif.",
      };

    case "tetradic":
      return {
        scheme,
        label: "Tétradique",
        colors: [
          base,
          toRgb(rotateHue(lch, 60)),
          toRgb(rotateHue(lch, 180)),
          toRgb(rotateHue(lch, 240)),
        ],
        rationale: "Deux paires complémentaires : riche, à doser.",
      };

    case "square":
      return {
        scheme,
        label: "Carré",
        colors: [
          base,
          toRgb(rotateHue(lch, 90)),
          toRgb(rotateHue(lch, 180)),
          toRgb(rotateHue(lch, 270)),
        ],
        rationale: "Quatre teintes équidistantes : très contrasté.",
      };

    case "monochromatic":
      return {
        scheme,
        label: "Monochrome",
        colors: lightnessRamp(lch, count),
        rationale: "Une seule teinte, déclinée en luminosité.",
      };

    case "neutral":
      return {
        scheme,
        label: "Neutre",
        colors: lightnessRamp(adjust(lch, { C: Math.min(lch.C, 6) }), count),
        rationale: "Chroma réduit au minimum : base calme et polyvalente.",
      };

    case "warm":
      return {
        scheme,
        label: "Chaud",
        colors: towardHue(lch, 50, count),
        rationale: "Teintes tirées vers l'orangé : ambiance chaleureuse.",
      };

    case "cool":
      return {
        scheme,
        label: "Froid",
        colors: towardHue(lch, 230, count),
        rationale: "Teintes tirées vers le bleu : ambiance apaisée.",
      };

    case "pastel":
      return {
        scheme,
        label: "Pastel",
        colors: analogousWith(lch, count, (c) => adjust(c, { L: 86, C: Math.min(c.C, 22) })),
        rationale: "Luminosité haute et chroma bas : doux et aéré.",
      };

    case "vibrant":
      return {
        scheme,
        label: "Vif",
        colors: analogousWith(lch, count, (c) => adjust(c, { L: 58, C: Math.max(c.C, 60) })),
        rationale: "Chroma poussé : saturé et affirmé.",
      };

    case "earth":
      return {
        scheme,
        label: "Terre",
        colors: towardHue(adjust(lch, { C: Math.min(lch.C, 30) }), 60, count, 0.5),
        rationale: "Teintes ocre et brunes, chroma contenu : naturel.",
      };

    case "luxury":
      return {
        scheme,
        label: "Luxe",
        colors: [
          toRgb(adjust(lch, { L: 16, C: Math.min(lch.C, 18) })),
          toRgb(adjust(lch, { L: 28, C: Math.min(lch.C, 26) })),
          base,
          toRgb(adjust(rotateHue(lch, 40), { L: 72, C: 38 })),
          toRgb(adjust(lch, { L: 92, C: 6 })),
        ].slice(0, Math.max(3, count)),
        rationale: "Fonds profonds et un accent lumineux : contraste sobre.",
      };

    case "minimal":
      return {
        scheme,
        label: "Minimal",
        colors: [
          toRgb(adjust(lch, { L: 96, C: 3 })),
          toRgb(adjust(lch, { L: 78, C: 5 })),
          base,
          toRgb(adjust(lch, { L: 24, C: 5 })),
        ].slice(0, Math.max(3, count)),
        rationale: "Presque neutre, la couleur de base comme unique accent.",
      };
  }
}

/** Even lightness ramp at constant hue, avoiding pure black and white. */
function lightnessRamp(lch: LCh, count: number): RGB[] {
  const steps = Math.max(2, count);
  const min = 20;
  const max = 92;
  return Array.from({ length: steps }, (_, i) => {
    const L = min + ((max - min) * i) / (steps - 1);
    // Chroma has to fall off near the ends: no highly saturated color exists at
    // L* 92, so holding C* constant would push the result out of gamut and the
    // ramp would visibly flatten at the top.
    const falloff = 1 - Math.abs(L - 55) / 60;
    return toRgb(adjust(lch, { L, C: lch.C * Math.max(0.25, falloff) }));
  });
}

/** Pulls hues toward a target (warm/cool/earth families) without discarding the base. */
function towardHue(lch: LCh, targetHue: number, count: number, strength = 0.65): RGB[] {
  const steps = Math.max(3, count);
  return Array.from({ length: steps }, (_, i) => {
    const t = steps === 1 ? 0 : i / (steps - 1);
    const pulled = shortestHueLerp(lch.h, targetHue, strength * t);
    const L = 30 + 50 * t;
    return toRgb({ L, C: lch.C * (1 - 0.25 * t), h: pulled });
  });
}

/** Spreads analogous hues, then applies a per-color transform (pastel, vibrant…). */
function analogousWith(lch: LCh, count: number, transform: (c: LCh) => LCh): RGB[] {
  const steps = Math.max(3, count);
  const span = 60;
  return Array.from({ length: steps }, (_, i) => {
    const offset = -span / 2 + (span * i) / (steps - 1);
    return toRgb(transform(rotateHue(lch, offset)));
  });
}

/**
 * Interpolates between two hues the short way around the circle.
 *
 * Interpolating 350° toward 10° linearly would sweep backwards through the
 * entire wheel; taking the shorter arc keeps the transition perceptually direct.
 */
function shortestHueLerp(from: number, to: number, t: number): number {
  let delta = ((to - from) % 360 + 540) % 360 - 180;
  return ((from + delta * t) % 360 + 360) % 360;
}

/** Every scheme, in the order the UI should present them. */
export const ALL_HARMONY_SCHEMES: HarmonyScheme[] = [
  "complementary",
  "analogous",
  "triadic",
  "split_complementary",
  "tetradic",
  "square",
  "monochromatic",
  "neutral",
  "warm",
  "cool",
  "pastel",
  "vibrant",
  "earth",
  "luxury",
  "minimal",
];
