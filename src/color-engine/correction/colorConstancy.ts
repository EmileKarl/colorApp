import { linearizeChannel, delinearizeChannel } from "../color-spaces/srgb";

/**
 * Color constancy — estimating and removing the color of the light.
 *
 * A white sheet under tungsten light produces orange pixels. Humans discount
 * the illuminant automatically; a camera's auto white balance tries and often
 * fails. This module estimates the illuminant from the pixels themselves and
 * divides it out, which is the single largest accuracy win available without
 * a physical reference chart.
 *
 * CRITICAL: every algorithm here operates on *linear* light. Running Gray World
 * on gamma-encoded values is a common and silent error — the gains come out
 * wrong because the encoding is non-linear, and the result looks plausible
 * while being measurably off.
 */

export type IlluminantEstimate = {
  /** Per-channel gains to divide the image by, normalized so that g = 1. */
  gains: { r: number; g: number; b: number };
  /** Which algorithm produced this estimate. */
  method: ColorConstancyMethod;
  /**
   * How far the estimated illuminant is from neutral, 0 = already neutral.
   * Large values mean a strong cast — and a correction worth distrusting if
   * the scene genuinely is dominated by one color.
   */
  castStrength: number;
};

export type ColorConstancyMethod = "gray_world" | "white_patch" | "shades_of_gray" | "none";

/**
 * Gray World (Buchsbaum, 1980).
 *
 * Assumption: averaged over a varied scene, reflectance is achromatic, so the
 * mean of the image *is* the illuminant.
 *
 * Formula: gain_c = mean(all channels) / mean(channel c)
 *
 * @param rgba Interleaved RGBA bytes.
 * @returns Gains to apply in linear light.
 * Limits: fails exactly when our use case is most common — a frame filled with
 * one saturated color. Scanning a red wall makes Gray World "correct" the red
 * away. This is why the engine weighs it against other estimators and against
 * how strongly it disagrees with them, rather than trusting it outright.
 */
export function grayWorld(rgba: Uint8Array): IlluminantEstimate {
  return shadesOfGray(rgba, 1, "gray_world");
}

/**
 * White Patch / max-RGB (Land's Retinex simplification).
 *
 * Assumption: the brightest value in each channel corresponds to a white
 * surface reflecting the illuminant.
 *
 * Formula: gain_c = max(all channel maxima) / max(channel c)
 *
 * Limits: a single blown-out pixel destroys the estimate, so this uses a high
 * percentile rather than the true maximum for robustness. Fails when nothing
 * in the frame is actually white.
 */
export function whitePatch(rgba: Uint8Array, percentileCut = 0.99): IlluminantEstimate {
  const pixelCount = Math.floor(rgba.length / 4);
  const channels: number[][] = [[], [], []];

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    channels[0].push(linearizeChannel(rgba[offset] / 255));
    channels[1].push(linearizeChannel(rgba[offset + 1] / 255));
    channels[2].push(linearizeChannel(rgba[offset + 2] / 255));
  }

  const highs = channels.map((values) => {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.floor(sorted.length * percentileCut));
    return Math.max(sorted[index], 1e-6);
  });

  return buildEstimate(highs[0], highs[1], highs[2], "white_patch");
}

/**
 * Shades of Gray (Finlayson & Trezzi, 2004) — the general form.
 *
 * Formula: e_c = ( (1/N)·Σ I_c(x)^p )^(1/p)
 *
 * p = 1 recovers Gray World, p → ∞ recovers White Patch. The authors found
 * p ≈ 6 to outperform both on real images, which is the default here.
 *
 * @param p Minkowski norm order. Must be ≥ 1.
 * @returns Gains to apply in linear light.
 */
export function shadesOfGray(
  rgba: Uint8Array,
  p = 6,
  method: ColorConstancyMethod = "shades_of_gray",
): IlluminantEstimate {
  if (p < 1) throw new Error("Minkowski norm order must be >= 1");

  const pixelCount = Math.floor(rgba.length / 4);
  if (pixelCount === 0) throw new Error("No pixels to estimate the illuminant from");

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    sumR += Math.pow(linearizeChannel(rgba[offset] / 255), p);
    sumG += Math.pow(linearizeChannel(rgba[offset + 1] / 255), p);
    sumB += Math.pow(linearizeChannel(rgba[offset + 2] / 255), p);
  }

  const norm = (sum: number) => Math.max(Math.pow(sum / pixelCount, 1 / p), 1e-6);
  return buildEstimate(norm(sumR), norm(sumG), norm(sumB), method);
}

/** Turns a raw illuminant estimate into normalized, green-anchored gains. */
function buildEstimate(
  eR: number,
  eG: number,
  eB: number,
  method: ColorConstancyMethod,
): IlluminantEstimate {
  // Anchor on green: it carries most of the luminance, so normalizing there
  // keeps overall brightness roughly unchanged while neutralizing the cast.
  const gains = { r: eG / eR, g: 1, b: eG / eB };

  // Distance of the estimated illuminant from neutral, in chromaticity terms.
  const total = eR + eG + eB;
  const castStrength =
    total > 0 ? Math.hypot(eR / total - 1 / 3, eB / total - 1 / 3) * Math.SQRT2 : 0;

  return { gains, method, castStrength };
}

/**
 * Applies per-channel gains in linear light and re-encodes to sRGB.
 *
 * @param rgba Interleaved RGBA bytes; modified into a new buffer, not in place.
 * @returns A corrected copy. Alpha is preserved untouched.
 * Limits: gains can push bright pixels past 1.0; those are clamped, which
 * loses information. Heavily clipped input cannot be rescued by white balance.
 */
export function applyGains(
  rgba: Uint8Array,
  gains: { r: number; g: number; b: number },
): Uint8Array {
  const out = new Uint8Array(rgba.length);
  const pixelCount = Math.floor(rgba.length / 4);

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    out[offset] = correctChannel(rgba[offset], gains.r);
    out[offset + 1] = correctChannel(rgba[offset + 1], gains.g);
    out[offset + 2] = correctChannel(rgba[offset + 2], gains.b);
    out[offset + 3] = rgba[offset + 3];
  }

  return out;
}

function correctChannel(value: number, gain: number): number {
  const linear = linearizeChannel(value / 255) * gain;
  const encoded = delinearizeChannel(Math.min(1, Math.max(0, linear)));
  return Math.round(Math.min(255, Math.max(0, encoded * 255)));
}

/**
 * Runs several estimators and picks the most trustworthy one.
 *
 * Rationale: the estimators fail in *different* situations, so their agreement
 * is itself a signal. When they agree, the estimate is likely right; when they
 * diverge wildly, the scene probably violates their assumptions (a frame full
 * of one saturated color), and applying a strong correction would do more harm
 * than good — so we fall back to no correction and report low agreement.
 *
 * @returns The selected estimate plus an agreement score in 0–1 that the
 * confidence model consumes.
 */
export function estimateIlluminant(rgba: Uint8Array): {
  estimate: IlluminantEstimate;
  agreement: number;
  candidates: IlluminantEstimate[];
} {
  const candidates = [grayWorld(rgba), whitePatch(rgba), shadesOfGray(rgba, 6)];

  // Spread of the proposed gains across estimators, in log space so that a
  // gain of 2 and one of 0.5 count as equally far from neutral.
  const logR = candidates.map((c) => Math.log(c.gains.r));
  const logB = candidates.map((c) => Math.log(c.gains.b));
  const spread = Math.hypot(spreadOf(logR), spreadOf(logB));
  const agreement = Math.exp(-spread * 2);

  // Shades of Gray (p=6) is the best general-purpose choice per Finlayson &
  // Trezzi; fall back to no correction when the estimators clearly disagree.
  const preferred = candidates[2];
  const estimate: IlluminantEstimate =
    agreement < 0.35
      ? { gains: { r: 1, g: 1, b: 1 }, method: "none", castStrength: 0 }
      : preferred;

  return { estimate, agreement, candidates };
}

function spreadOf(values: number[]): number {
  const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / values.length;
  return Math.sqrt(variance);
}
