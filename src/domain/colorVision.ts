import { deltaE2000 } from "../color-engine/metrics/deltaE2000";
import { linearToRgb, rgbToLinear } from "../color-engine/color-spaces/srgb";
import { rgbToLab } from "../color-engine/color-spaces/lab";
import type { RGB } from "../color-engine/types";

/**
 * Color vision deficiency simulation.
 *
 * Roughly 8% of men and 0.5% of women have some form of color vision
 * deficiency, so "these two colors are clearly different" is not a universal
 * statement. This module makes that concrete: it shows what a palette actually
 * looks like to someone with each common deficiency, and measures how much
 * information is lost.
 */

export type ColorVisionType =
  | "normal"
  | "protanopia"
  | "deuteranopia"
  | "tritanopia"
  | "achromatopsia";

export const COLOR_VISION_LABELS: Record<ColorVisionType, string> = {
  normal: "Vision normale",
  protanopia: "Protanopie (rouge)",
  deuteranopia: "Deutéranopie (vert)",
  tritanopia: "Tritanopie (bleu)",
  achromatopsia: "Achromatopsie (aucune couleur)",
};

/**
 * Machado, Oliveira & Fernandes (2009) simulation matrices, severity 1.0.
 *
 * These operate on **linear** RGB. Applying them to gamma-encoded values — the
 * easy mistake — produces a visibly wrong simulation, which would be worse than
 * none at all for an accessibility tool.
 *
 * Each row sums to 1, so white maps to white; that invariant is asserted in the
 * tests and is a quick way to catch a transcription error in the constants.
 */
const SIMULATION_MATRICES: Record<
  Exclude<ColorVisionType, "normal" | "achromatopsia">,
  readonly (readonly [number, number, number])[]
> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

/**
 * Simulates how a color appears under a given color vision deficiency.
 *
 * @param rgb The original color, 0–255 per channel.
 * @param type Which deficiency to simulate. "normal" returns the input.
 * @returns The simulated color, clamped into the sRGB gamut.
 *
 * Limits: dichromacy models are approximations of a continuum — real anomalous
 * trichromacy (the far more common milder form) sits between normal vision and
 * these full-dichromat simulations. Treat the output as "worst realistic case",
 * which is the right bar for an accessibility check.
 */
export function simulateColorVision(rgb: RGB, type: ColorVisionType): RGB {
  if (type === "normal") return rgb;

  if (type === "achromatopsia") {
    // Luminance-preserving grayscale, computed in linear light so the result
    // matches perceived brightness rather than a naive channel average.
    const linear = rgbToLinear(rgb);
    const y = 0.2126 * linear.r + 0.7152 * linear.g + 0.0722 * linear.b;
    return linearToRgb({ r: y, g: y, b: y });
  }

  const matrix = SIMULATION_MATRICES[type];
  const linear = rgbToLinear(rgb);
  const apply = (row: readonly [number, number, number]) =>
    Math.min(1, Math.max(0, row[0] * linear.r + row[1] * linear.g + row[2] * linear.b));

  return linearToRgb({ r: apply(matrix[0]), g: apply(matrix[1]), b: apply(matrix[2]) });
}

export type VisionComparison = {
  type: ColorVisionType;
  label: string;
  simulated: RGB;
  /** ΔE₀₀ between the original and the simulation: how much the color shifts. */
  shift: number;
};

/** Simulates a color under every deficiency, for a side-by-side view. */
export function simulateAll(rgb: RGB): VisionComparison[] {
  const originalLab = rgbToLab(rgb);
  return (
    ["protanopia", "deuteranopia", "tritanopia", "achromatopsia"] as ColorVisionType[]
  ).map((type) => {
    const simulated = simulateColorVision(rgb, type);
    return {
      type,
      label: COLOR_VISION_LABELS[type],
      simulated,
      shift: Math.round(deltaE2000(originalLab, rgbToLab(simulated)) * 10) / 10,
    };
  });
}

export type PaletteAccessibilityIssue = {
  type: ColorVisionType;
  label: string;
  /** Indices of the two palette colors that become hard to tell apart. */
  pair: [number, number];
  /** Their ΔE₀₀ under this deficiency. */
  deltaE: number;
};

/**
 * ΔE₀₀ below which two colors in a palette are treated as indistinguishable.
 *
 * Set well above the just-noticeable difference: a palette whose colors are
 * only *barely* separable for someone with a deficiency is still a failure in
 * practice, since palettes are read at a glance, not compared side by side.
 */
export const PALETTE_CONFUSION_THRESHOLD = 8;

/**
 * Finds pairs in a palette that collapse together under any deficiency.
 *
 * This is the actionable half of the simulator: rather than only showing what a
 * palette looks like, it names the specific pairs that stop being
 * distinguishable — which is what a designer needs in order to fix it.
 *
 * @returns One entry per problematic (deficiency, pair) combination, worst first.
 */
export function findPaletteAccessibilityIssues(palette: RGB[]): PaletteAccessibilityIssue[] {
  const issues: PaletteAccessibilityIssue[] = [];
  const types: ColorVisionType[] = [
    "protanopia",
    "deuteranopia",
    "tritanopia",
    "achromatopsia",
  ];

  for (const type of types) {
    const simulated = palette.map((color) => rgbToLab(simulateColorVision(color, type)));
    for (let i = 0; i < simulated.length; i++) {
      for (let j = i + 1; j < simulated.length; j++) {
        const distance = deltaE2000(simulated[i], simulated[j]);
        if (distance < PALETTE_CONFUSION_THRESHOLD) {
          issues.push({
            type,
            label: COLOR_VISION_LABELS[type],
            pair: [i, j],
            deltaE: Math.round(distance * 10) / 10,
          });
        }
      }
    }
  }

  return issues.sort((a, b) => a.deltaE - b.deltaE);
}
