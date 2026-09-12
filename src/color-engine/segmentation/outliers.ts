import { deltaE2000 } from "../metrics/deltaE2000";
import type { Lab } from "../types";

/**
 * Robust outlier rejection.
 *
 * A real-world patch is never uniform: there is a specular highlight, a shadow
 * edge, a stray background pixel. Those are not the color — they are
 * contamination, and a mean happily swallows them. Everything here uses
 * *robust* statistics (median-based), which stay accurate even when a
 * substantial minority of the data is garbage.
 */

/** Statistical method used to decide what counts as an outlier. */
export type OutlierMethod = "mad" | "iqr";

/**
 * Median of a numeric array.
 *
 * @returns The 50th percentile (mean of the two central values for even
 * lengths). Throws on an empty array rather than returning a misleading 0.
 */
export function median(values: number[]): number {
  if (values.length === 0) throw new Error("median of an empty array");
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Linear-interpolated percentile.
 *
 * @param p Percentile in 0–1 (0.25 = first quartile).
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) throw new Error("percentile of an empty array");
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * Math.min(1, Math.max(0, p));
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

/**
 * Median Absolute Deviation.
 *
 * Formula: MAD = median(|xᵢ − median(x)|)
 *
 * @returns MAD in the same units as the input. Unlike a standard deviation,
 * a single extreme value cannot inflate it — its breakdown point is 50%.
 */
export function medianAbsoluteDeviation(values: number[]): number {
  const med = median(values);
  return median(values.map((v) => Math.abs(v - med)));
}

/**
 * Robust standard-deviation estimate derived from the MAD.
 *
 * Formula: σ̂ = 1.4826 · MAD
 *
 * The constant makes σ̂ a consistent estimator of σ for normally distributed
 * data (1/Φ⁻¹(0.75) ≈ 1.4826).
 */
export function robustSigma(values: number[]): number {
  return 1.4826 * medianAbsoluteDeviation(values);
}

/**
 * Flags outliers using the modified z-score (Iglewicz & Hoaglin, 1993).
 *
 * Formula: Mᵢ = 0.6745·(xᵢ − median) / MAD, outlier when |Mᵢ| > threshold.
 *
 * @param threshold Default 3.5, the value recommended by Iglewicz & Hoaglin.
 * @returns Boolean mask, true where the value is an outlier.
 * Limits: when MAD = 0 (more than half the values identical — common in a
 * uniform patch) the z-score is undefined; we then treat only values differing
 * from the median at all as outliers, which is the conservative reading.
 */
export function madOutlierMask(values: number[], threshold = 3.5): boolean[] {
  const med = median(values);
  const mad = medianAbsoluteDeviation(values);

  if (mad === 0) {
    return values.map((v) => v !== med);
  }
  return values.map((v) => Math.abs((0.6745 * (v - med)) / mad) > threshold);
}

/**
 * Flags outliers using Tukey's fences.
 *
 * Formula: outside [Q1 − k·IQR, Q3 + k·IQR] with IQR = Q3 − Q1.
 *
 * @param k Default 1.5 (Tukey's "outlier" fence; 3.0 marks "far out" points).
 */
export function iqrOutlierMask(values: number[], k = 1.5): boolean[] {
  const q1 = percentile(values, 0.25);
  const q3 = percentile(values, 0.75);
  const iqr = q3 - q1;
  const low = q1 - k * iqr;
  const high = q3 + k * iqr;
  return values.map((v) => v < low || v > high);
}

/**
 * Removes contaminating pixels from a Lab patch.
 *
 * Applies the chosen univariate test independently to L*, a* and b*, then
 * drops a pixel if any channel flags it. Running the test per channel catches
 * both lightness contamination (highlights, shadows) and hue contamination
 * (a background object of a different color).
 *
 * @param samples Lab pixels from the region of interest.
 * @param method "mad" (default, more robust) or "iqr".
 * @returns The surviving samples. If filtering would remove more than half the
 * data — a sign the patch is genuinely multi-colored rather than contaminated —
 * the original set is returned unchanged and the caller should let clustering,
 * not filtering, resolve it.
 */
export function filterOutliers(samples: Lab[], method: OutlierMethod = "mad"): Lab[] {
  if (samples.length < 4) return samples;

  const mask = method === "mad" ? madOutlierMask : iqrOutlierMask;
  const flagL = mask(samples.map((s) => s.L));
  const flagA = mask(samples.map((s) => s.a));
  const flagB = mask(samples.map((s) => s.b));

  const kept = samples.filter((_, i) => !flagL[i] && !flagA[i] && !flagB[i]);
  return kept.length >= samples.length / 2 ? kept : samples;
}

/**
 * Removes samples perceptually far from the patch's median color.
 *
 * Complements {@link filterOutliers}: the per-channel test can miss a pixel
 * that is moderately off on all three axes at once, which ΔE₀₀ catches because
 * it measures the *perceptual* distance rather than per-axis deviation.
 *
 * @param maxDeltaE Pixels beyond this ΔE₀₀ from the median color are dropped.
 * Default 10 — roughly "clearly a different color" to an observer.
 */
export function filterByPerceptualDistance(samples: Lab[], maxDeltaE = 10): Lab[] {
  if (samples.length < 4) return samples;

  const center: Lab = {
    L: median(samples.map((s) => s.L)),
    a: median(samples.map((s) => s.a)),
    b: median(samples.map((s) => s.b)),
  };

  const kept = samples.filter((s) => deltaE2000(s, center) <= maxDeltaE);
  return kept.length >= samples.length / 2 ? kept : samples;
}
