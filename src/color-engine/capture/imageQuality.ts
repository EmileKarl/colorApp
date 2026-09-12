import { rgbToLab , labToLch } from "../color-spaces/lab";
import { relativeLuminance } from "../color-spaces/srgb";

/**
 * Image quality assessment.
 *
 * The engine's contract is that poor input lowers the *confidence*, never the
 * reported precision. This module produces the evidence for that: if the patch
 * is blown out, pitch black, noisy or blurred, downstream confidence drops
 * instead of the pipeline inventing a number it cannot support.
 */

export type ImageQualityFlag =
  | "underexposed"
  | "overexposed"
  | "low_contrast"
  | "high_noise"
  | "blurred"
  | "clipped_highlights"
  | "clipped_shadows";

export type ImageQuality = {
  /** Mean relative luminance, 0–1 (linear light). */
  meanLuminance: number;
  /** Mean perceptual lightness L*, 0–100. */
  meanLightness: number;
  /** Standard deviation of L*, 0–100. Low values mean a flat, low-contrast patch. */
  contrast: number;
  /** Mean chroma C*, 0–~130. Near 0 means the patch is essentially neutral. */
  meanChroma: number;
  /** Fraction of pixels with any channel at 255, 0–1. */
  clippedHighlights: number;
  /** Fraction of pixels with any channel at 0, 0–1. */
  clippedShadows: number;
  /** Estimated noise σ in 0–255 units (Immerkær). */
  noise: number;
  /** Variance of the Laplacian — higher means sharper. Unitless. */
  sharpness: number;
  /** Detected problems, for user-facing guidance. */
  flags: ImageQualityFlag[];
  /** Overall usability score, 0–1. Feeds the confidence model. */
  score: number;
};

/** Above this fraction of clipped pixels, the measurement is compromised. */
const CLIPPING_LIMIT = 0.05;
/** L* standard deviation below this means a suspiciously flat patch. */
const LOW_CONTRAST_LIMIT = 1.0;
/** Immerkær σ above this (0–255 scale) is visible sensor noise. */
const NOISE_LIMIT = 8;
/** Laplacian variance below this indicates defocus or motion blur. */
const BLUR_LIMIT = 4;

/**
 * Computes quality metrics for an RGBA patch.
 *
 * @param rgba Interleaved RGBA bytes, length ≥ width·height·4.
 * @param width Patch width in pixels (≥ 3 for noise/sharpness to be meaningful).
 * @param height Patch height in pixels.
 * @returns Metrics plus an aggregate 0–1 score.
 *
 * Limits: operates on the already-compressed 8-bit image, so it measures the
 * quality of *what reached us*, which is the honest thing to score — but it
 * cannot distinguish sensor noise from JPEG artifacts.
 */
export function assessImageQuality(rgba: Uint8Array, width: number, height: number): ImageQuality {
  if (width <= 0 || height <= 0) throw new Error("Invalid dimensions");
  if (rgba.length < width * height * 4) throw new Error("Pixel buffer too small for dimensions");

  const pixelCount = width * height;
  const lightness = new Float64Array(pixelCount);

  let luminanceSum = 0;
  let lightnessSum = 0;
  let chromaSum = 0;
  let clippedHigh = 0;
  let clippedLow = 0;

  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    const rgb = { r: rgba[offset], g: rgba[offset + 1], b: rgba[offset + 2] };

    luminanceSum += relativeLuminance(rgb);

    const lab = rgbToLab(rgb);
    lightness[i] = lab.L;
    lightnessSum += lab.L;
    chromaSum += labToLch(lab).C;

    if (rgb.r === 255 || rgb.g === 255 || rgb.b === 255) clippedHigh++;
    if (rgb.r === 0 || rgb.g === 0 || rgb.b === 0) clippedLow++;
  }

  const meanLightness = lightnessSum / pixelCount;

  let varianceSum = 0;
  for (let i = 0; i < pixelCount; i++) {
    const d = lightness[i] - meanLightness;
    varianceSum += d * d;
  }
  const contrast = Math.sqrt(varianceSum / pixelCount);

  const noise = estimateNoise(lightness, width, height);
  const sharpness = laplacianVariance(lightness, width, height);

  const clippedHighlights = clippedHigh / pixelCount;
  const clippedShadows = clippedLow / pixelCount;
  const meanLuminance = luminanceSum / pixelCount;

  // Blur is only diagnosable when the patch has structure to begin with. A
  // perfectly uniform surface legitimately has near-zero Laplacian variance,
  // and is in fact the *ideal* input for color measurement — scoring it as
  // "blurred" would penalise exactly the case we want most.
  const blurDiagnosable = contrast > LOW_CONTRAST_LIMIT;

  const flags: ImageQualityFlag[] = [];
  if (meanLightness < 15) flags.push("underexposed");
  if (meanLightness > 92) flags.push("overexposed");
  if (contrast < LOW_CONTRAST_LIMIT) flags.push("low_contrast");
  if (noise > NOISE_LIMIT) flags.push("high_noise");
  if (blurDiagnosable && sharpness < BLUR_LIMIT) flags.push("blurred");
  if (clippedHighlights > CLIPPING_LIMIT) flags.push("clipped_highlights");
  if (clippedShadows > CLIPPING_LIMIT) flags.push("clipped_shadows");

  return {
    meanLuminance,
    meanLightness,
    contrast,
    meanChroma: chromaSum / pixelCount,
    clippedHighlights,
    clippedShadows,
    noise,
    sharpness,
    flags,
    score: qualityScore({
      meanLightness,
      noise,
      clippedHighlights,
      clippedShadows,
      sharpness,
      blurDiagnosable,
    }),
  };
}

/**
 * Aggregates the individual metrics into one 0–1 usability score.
 *
 * Deliberately multiplicative: a single disqualifying problem (a blown-out
 * patch) must drag the score down even when everything else looks fine, which
 * an average would hide.
 *
 * Note: a flat, uniform patch is the *ideal* input here — unlike in generic
 * photo-quality scoring, low contrast is not penalised in the score itself
 * (it is only flagged), because a perfectly uniform color patch is exactly
 * what we want to measure.
 */
function qualityScore(metrics: {
  meanLightness: number;
  noise: number;
  clippedHighlights: number;
  clippedShadows: number;
  sharpness: number;
  blurDiagnosable: boolean;
}): number {
  // Exposure: best around mid-lightness, falling off toward pure black/white.
  const exposure = 1 - Math.min(1, Math.abs(metrics.meanLightness - 55) / 55);
  const noisePenalty = 1 - Math.min(1, metrics.noise / (NOISE_LIMIT * 2));
  const clippingPenalty =
    1 - Math.min(1, (metrics.clippedHighlights + metrics.clippedShadows) / (CLIPPING_LIMIT * 4));
  // Only penalise blur where it can actually be distinguished from a flat
  // subject; see the blurDiagnosable note in assessImageQuality.
  const blurPenalty = metrics.blurDiagnosable
    ? 0.5 + 0.5 * Math.min(1, metrics.sharpness / (BLUR_LIMIT * 4))
    : 1;

  return clamp01(exposure * noisePenalty * clippingPenalty * blurPenalty);
}

/**
 * Immerkær's fast noise variance estimator (1996).
 *
 * Convolves the image with a kernel that annihilates smooth (up to second
 * order) content, so what remains is dominated by noise:
 *
 *   N = [[ 1, -2,  1],
 *        [-2,  4, -2],
 *        [ 1, -2,  1]]
 *
 *   σ ≈ √(π/2) · Σ|I ∗ N| / (6·(W−2)·(H−2))
 *
 * @param gray Per-pixel lightness, any consistent scale.
 * @returns Estimated σ in the same units as `gray` (here L*, 0–100, then
 * rescaled to 0–255 by the caller's convention).
 * Limits: assumes additive Gaussian noise, and mistakes fine texture for noise.
 */
function estimateNoise(gray: Float64Array, width: number, height: number): number {
  if (width < 3 || height < 3) return 0;

  let sum = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const value =
        gray[(y - 1) * width + (x - 1)] -
        2 * gray[(y - 1) * width + x] +
        gray[(y - 1) * width + (x + 1)] -
        2 * gray[y * width + (x - 1)] +
        4 * gray[y * width + x] -
        2 * gray[y * width + (x + 1)] +
        gray[(y + 1) * width + (x - 1)] -
        2 * gray[(y + 1) * width + x] +
        gray[(y + 1) * width + (x + 1)];
      sum += Math.abs(value);
    }
  }

  const sigmaInLStar = (Math.sqrt(Math.PI / 2) * sum) / (6 * (width - 2) * (height - 2));
  // Report on the familiar 0–255 scale rather than L* units.
  return (sigmaInLStar * 255) / 100;
}

/**
 * Variance of the Laplacian — the standard defocus/motion-blur indicator.
 *
 * Kernel: [[0,1,0],[1,-4,1],[0,1,0]]. A sharp image has strong edges, so the
 * second derivative has high variance; a blurred one has almost none.
 *
 * @returns Variance, unitless. Higher is sharper. Scene-dependent, so only
 * meaningful against a threshold tuned for this app's patch size.
 */
function laplacianVariance(gray: Float64Array, width: number, height: number): number {
  if (width < 3 || height < 3) return 0;

  const values: number[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      values.push(
        gray[(y - 1) * width + x] +
          gray[(y + 1) * width + x] +
          gray[y * width + (x - 1)] +
          gray[y * width + (x + 1)] -
          4 * gray[y * width + x],
      );
    }
  }

  const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
  return values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / values.length;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
