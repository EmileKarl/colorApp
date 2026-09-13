import { labToLch, rgbToLab } from "../color-engine/color-spaces/lab";
import { hueDistance } from "../color-engine/color-spaces/hsv";
import { deltaE2000 } from "../color-engine/metrics/deltaE2000";
import { deltaE76 } from "../color-engine/metrics/deltaE76";
import { checkContrast, type ContrastResult } from "./contrast";
import type { RGB } from "../color-engine/types";

/**
 * Color comparison.
 *
 * Reports *why* two colors differ, not just how much. A single ΔE₀₀ number
 * cannot tell a designer whether to adjust lightness or hue; splitting the
 * difference into its lightness, chroma and hue components can.
 */

export type SimilarityVerdict =
  | "identical"
  | "imperceptible"
  | "very_close"
  | "close"
  | "different"
  | "very_different";

export type ComparisonResult = {
  deltaE2000: number;
  deltaE76: number;
  /** Signed L* difference, B − A. Positive means B is lighter. */
  lightnessDelta: number;
  /** Signed C* difference, B − A. Positive means B is more colorful. */
  chromaDelta: number;
  /** Unsigned hue angle difference in degrees, 0–180. */
  hueDelta: number;
  verdict: SimilarityVerdict;
  /** Plain-language summary of the dominant difference. */
  summary: string;
  /** WCAG contrast between the two, for using them together. */
  contrast: ContrastResult;
};

/**
 * ΔE₀₀ bands used for the verdict.
 *
 * ~1 is the just-noticeable difference for a trained observer under controlled
 * viewing; 2–3 is where casual observers start to see a difference; beyond 10
 * most people would call them different colors outright.
 */
const VERDICT_BANDS: { max: number; verdict: SimilarityVerdict; label: string }[] = [
  { max: 0.01, verdict: "identical", label: "Identiques" },
  { max: 1, verdict: "imperceptible", label: "Différence imperceptible" },
  { max: 2.3, verdict: "very_close", label: "Très proches" },
  { max: 5, verdict: "close", label: "Proches" },
  { max: 10, verdict: "different", label: "Différentes" },
  { max: Infinity, verdict: "very_different", label: "Très différentes" },
];

/**
 * Compares two colors across every dimension the app reports.
 *
 * @param a First color.
 * @param b Second color.
 * @returns Component-wise differences plus an overall verdict.
 * Note: ΔE₀₀ is symmetric, and so is this result — the signed lightness and
 * chroma deltas are the only direction-dependent values, and they are
 * documented as B − A.
 */
export function compareColors(a: RGB, b: RGB): ComparisonResult {
  const labA = rgbToLab(a);
  const labB = rgbToLab(b);
  const lchA = labToLch(labA);
  const lchB = labToLch(labB);

  const dE = deltaE2000(labA, labB);
  const lightnessDelta = labB.L - labA.L;
  const chromaDelta = lchB.C - lchA.C;

  // Hue is meaningless for near-neutral colors: the angle between two grays is
  // dominated by noise in a* and b*, so report 0 rather than a random number.
  const hueMeaningful = lchA.C > 5 && lchB.C > 5;
  const hueDelta = hueMeaningful ? hueDistance(lchA.h, lchB.h) : 0;

  const band = VERDICT_BANDS.find((entry) => dE <= entry.max)!;

  return {
    deltaE2000: round(dE),
    deltaE76: round(deltaE76(labA, labB)),
    lightnessDelta: round(lightnessDelta),
    chromaDelta: round(chromaDelta),
    hueDelta: round(hueDelta),
    verdict: band.verdict,
    summary: describeDifference(band.label, lightnessDelta, chromaDelta, hueDelta, hueMeaningful),
    contrast: checkContrast(a, b),
  };
}

/**
 * Names the dominant axis of difference.
 *
 * The three components are on different scales (L* spans 100, hue spans 180°),
 * so they are normalised before being compared — otherwise hue would almost
 * always appear to dominate.
 */
function describeDifference(
  label: string,
  lightnessDelta: number,
  chromaDelta: number,
  hueDelta: number,
  hueMeaningful: boolean,
): string {
  const normalised = {
    lightness: Math.abs(lightnessDelta) / 100,
    chroma: Math.abs(chromaDelta) / 130,
    hue: hueMeaningful ? hueDelta / 180 : 0,
  };

  const dominant = (Object.keys(normalised) as (keyof typeof normalised)[]).reduce((best, key) =>
    normalised[key] > normalised[best] ? key : best,
  );

  if (normalised[dominant] < 0.005) return `${label}.`;

  switch (dominant) {
    case "lightness":
      return `${label} — surtout une différence de luminosité (${lightnessDelta > 0 ? "B plus claire" : "B plus foncée"}).`;
    case "chroma":
      return `${label} — surtout une différence de saturation (${chromaDelta > 0 ? "B plus vive" : "B plus terne"}).`;
    case "hue":
      return `${label} — surtout une différence de teinte (${Math.round(hueDelta)}°).`;
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Ranks candidates by perceptual closeness to a target.
 *
 * Used by "find colors close to this" (spec §43) and by community
 * deduplication, both of which need a perceptual ordering rather than an RGB one.
 *
 * @param limit Maximum results to return.
 */
export function rankByCloseness<T extends { rgb: RGB }>(
  target: RGB,
  candidates: T[],
  limit = 10,
): (T & { deltaE: number })[] {
  const targetLab = rgbToLab(target);
  return candidates
    .map((candidate) => ({
      ...candidate,
      deltaE: round(deltaE2000(targetLab, rgbToLab(candidate.rgb))),
    }))
    .sort((x, y) => x.deltaE - y.deltaE)
    .slice(0, limit);
}
