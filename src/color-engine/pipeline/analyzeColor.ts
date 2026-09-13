import { assessImageQuality, type ImageQuality } from "../capture/imageQuality";
import { rgbToHsv } from "../color-spaces/hsv";
import { labToLch, labToRgb, rgbToLab } from "../color-spaces/lab";
import { rgbToXyz } from "../color-spaces/xyz";
import { chromaAndHue, estimateDominantColor, type Estimate } from "../analysis/dominantColor";
import {
  applyGains,
  estimateIlluminant,
  type ColorConstancyMethod,
} from "../correction/colorConstancy";
import { classifyColor, type ColorMatch } from "../classification/colorMatcher";
import { computeConfidence, type ConfidenceResult } from "../confidence/confidenceScore";
import { filterByPerceptualDistance, filterOutliers } from "../segmentation/outliers";
import {
  centerRoi,
  expandRegion,
  extractSurround,
  regionAt,
  toRgbSamples,
  type Region,
} from "../segmentation/roi";
import type { HSV, Lab, LCh, RGB, XYZ } from "../types";

/**
 * The full color detection pipeline.
 *
 * Image → quality → ROI → color constancy → Lab → outlier rejection →
 * clustering → dominant color → ΔE₀₀ classification → confidence.
 *
 * Design commitments:
 * - Deterministic. The same pixels always produce the same answer; a
 *   measurement tool that returns different numbers for the same input is not
 *   a measurement tool.
 * - Offline. No network, no metadata required. Environmental inputs are
 *   optional and only ever adjust *confidence*, never the measured value.
 * - Honest. Every degradation lowers confidence and is explained in
 *   `limitations`, rather than being hidden behind a clean-looking number.
 */

/**
 * How much larger than the ROI the excluded guard band is when estimating the
 * illuminant. 1.8 keeps the subject's spill out of its own correction while
 * still leaving most of the frame as evidence about the light.
 */
const SURROUND_GUARD_FACTOR = 1.8;

export type AnalyzeColorInput = {
  /** Interleaved RGBA bytes. */
  rgba: Uint8Array;
  width: number;
  height: number;
};

export type AnalyzeColorOptions = {
  /** ROI side as a fraction of the smaller image side. Default 0.4. */
  roiFraction?: number;
  /**
   * Where to centre the ROI, as fractions of width/height in 0–1.
   * Omitted means the centre of the frame (the viewfinder reticle).
   * Set by tap-to-color, which samples wherever the user touched.
   */
  roiCenter?: { x: number; y: number };
  /** Apply illuminant estimation and correction. Default true. */
  applyColorConstancy?: boolean;
  /** Seed for the deterministic clustering. Default 42. */
  seed?: number;
  /**
   * Optional capture metadata. Used only to annotate the result and inform
   * confidence — never to alter the measured color, since EXIF is
   * self-reported by the camera and cannot be verified.
   */
  camera?: CameraContext;
  /**
   * Optional environmental context (time, indoor/outdoor, weather). Recorded
   * for later calibration work; it has no effect on the measurement today,
   * because no validation data exists yet to justify one.
   */
  environment?: EnvironmentContext;
};

export type CameraContext = {
  device?: string;
  iso?: number;
  exposureTime?: number;
  aperture?: number;
  focalLength?: number;
  whiteBalance?: string;
  flash?: boolean;
  capturedAt?: string;
};

export type EnvironmentContext = {
  capturedAt?: string;
  indoor?: boolean;
  weather?: string;
  cloudCover?: number;
};

export type LightingAnalysis = {
  /** Which constancy method was applied, or "none" if the engine stood down. */
  method: ColorConstancyMethod;
  /** Gains applied in linear light. */
  gains: { r: number; g: number; b: number };
  /** How strongly the scene deviated from neutral, 0 = neutral. */
  castStrength: number;
  /** Agreement between illuminant estimators, 0–1. */
  agreement: number;
  /** Rough warm/cool reading, derived from the estimated cast. */
  tone: "warm" | "cool" | "neutral";
};

export type AnalyzeColorResult = {
  /** The measured color, in every representation the app may need. */
  dominantColor: { hex: string; rgb: RGB; hsv: HSV; xyz: XYZ; lab: Lab; lch: LCh };
  /** Perceptually distinct secondary colors found in the ROI. */
  colors: { hex: string; rgb: RGB; lab: Lab }[];
  rgb: RGB;
  hsv: HSV;
  lab: Lab;
  chroma: number;
  hue: number;
  /** ΔE₀₀ between the measured color and the matched reference. */
  deltaE: number;
  /** Best classification, or null when nothing in the database is close enough. */
  classification: ColorMatch | null;
  /** Alternative names, for showing the user that a call was close. */
  alternatives: ColorMatch[];
  imageQuality: ImageQuality;
  lighting: LightingAnalysis;
  camera: CameraContext | null;
  environment: EnvironmentContext | null;
  confidence: number;
  uncertainty: number;
  /** Full confidence breakdown, including why it was reduced. */
  confidenceDetail: ConfidenceResult;
  /** Per-estimator outputs, for diagnostics and benchmarking. */
  estimates: Estimate[];
  /** ROI actually analysed. */
  region: Region;
};

/**
 * Analyses an image and returns a measured color with an honest confidence.
 *
 * @param image RGBA pixels plus dimensions. Callers are expected to have
 * downscaled already — 64×64 is plenty, and keeps the whole pipeline in the
 * low milliseconds so it never blocks the UI thread.
 * @param options See {@link AnalyzeColorOptions}.
 * @throws If the buffer is malformed or the ROI contains no opaque pixels.
 */
export function analyzeColor(
  image: AnalyzeColorInput,
  options: AnalyzeColorOptions = {},
): AnalyzeColorResult {
  const {
    roiFraction = 0.4,
    roiCenter,
    applyColorConstancy = true,
    seed = 42,
    camera = null,
    environment = null,
  } = options;

  // Tap-to-color samples a tighter region than the viewfinder reticle: the
  // user is pointing at a specific spot, so a wide ROI would average in
  // whatever surrounds it and defeat the purpose of tapping precisely.
  const roi = roiCenter
    ? regionAt(
        image.rgba,
        image.width,
        image.height,
        roiCenter.x,
        roiCenter.y,
        Math.min(roiFraction, 0.15),
      )
    : centerRoi(image.rgba, image.width, image.height, roiFraction);
  const imageQuality = assessImageQuality(roi.rgba, roi.region.width, roi.region.height);

  // --- Illuminant estimation -------------------------------------------------
  // Estimated from the *surround*, never from the ROI. Including the measured
  // patch in its own illuminant estimate is circular: the patch skews the
  // scene average, the estimator reads that as a cast, and the correction then
  // pushes the measurement away from the truth. Benchmarking caught exactly
  // that — an "ideal" capture scored no better than one under a heavy tungsten
  // cast until the ROI was excluded here.
  let lighting: LightingAnalysis;
  let workingPixels = roi.rgba;

  if (applyColorConstancy) {
    // A guard band around the ROI is excluded too: the subject always spills
    // past the reticle, and the Minkowski norm used by Shades of Gray weights
    // bright pixels heavily, so even a thin ring of the subject's color skews
    // the estimate badly. Measured on the synthetic set: without the guard
    // band, an orange patch produced a red gain of 0.45 on a perfectly neutral
    // background, costing ~18 ΔE00.
    const guarded = expandRegion(roi.region, SURROUND_GUARD_FACTOR, image.width, image.height);
    const surround = extractSurround(image.rgba, image.width, image.height, guarded);
    // Fall back to the full frame only when the guard band leaves almost no
    // surround to learn from; the agreement score then reflects the extra
    // uncertainty.
    const estimationSource = surround.length >= 4 * 64 ? surround : image.rgba;

    const { estimate, agreement } = estimateIlluminant(estimationSource);
    if (estimate.method !== "none") {
      workingPixels = applyGains(roi.rgba, estimate.gains);
    }
    lighting = {
      method: estimate.method,
      gains: estimate.gains,
      castStrength: estimate.castStrength,
      agreement,
      tone: toneOf(estimate.gains),
    };
  } else {
    lighting = {
      method: "none",
      gains: { r: 1, g: 1, b: 1 },
      castStrength: 0,
      agreement: 1,
      tone: "neutral",
    };
  }

  // --- Pixels → Lab ----------------------------------------------------------
  const rgbSamples = toRgbSamples(workingPixels);
  if (rgbSamples.length === 0) throw new Error("No opaque pixels in the region of interest");

  const labSamples = rgbSamples.map((rgb) => rgbToLab(rgb));

  // Two complementary filters: per-channel robust statistics catch axis-aligned
  // contamination, the perceptual filter catches pixels that are moderately off
  // on every axis at once.
  const filtered = filterByPerceptualDistance(filterOutliers(labSamples, "mad"));

  // --- Dominant color --------------------------------------------------------
  const dominant = estimateDominantColor(filtered, { seed });
  const lab = dominant.color;
  const rgb = labToRgb(lab);
  const lch = labToLch(lab);
  const { chroma, hue } = chromaAndHue(lab);

  // --- Classification --------------------------------------------------------
  const classification = classifyColor(lab);
  const deltaE = classification.best?.deltaE ?? Infinity;

  // --- Confidence ------------------------------------------------------------
  const confidenceDetail = computeConfidence({
    imageQuality: imageQuality.score,
    estimatorDisagreement: dominant.disagreement,
    lightingAgreement: lighting.agreement,
    dominantShare: dominant.dominantShare,
    classificationMargin: classification.margin,
    matchDeltaE: Number.isFinite(deltaE) ? deltaE : 100,
    meanLightness: imageQuality.meanLightness,
  });

  return {
    dominantColor: { hex: rgbToHex(rgb), rgb, hsv: rgbToHsv(rgb), xyz: rgbToXyz(rgb), lab, lch },
    colors: dominant.secondary.map((secondary) => {
      const secondaryRgb = labToRgb(secondary);
      return { hex: rgbToHex(secondaryRgb), rgb: secondaryRgb, lab: secondary };
    }),
    rgb,
    hsv: rgbToHsv(rgb),
    lab,
    chroma,
    hue,
    deltaE: Number.isFinite(deltaE) ? round2(deltaE) : Infinity,
    classification: classification.best,
    alternatives: classification.alternatives,
    imageQuality,
    lighting,
    camera,
    environment,
    confidence: round2(confidenceDetail.confidence),
    uncertainty: confidenceDetail.uncertainty,
    confidenceDetail,
    estimates: dominant.estimates,
    region: roi.region,
  };
}

/** Reads the estimated illuminant gains as a warm/cool judgement. */
function toneOf(gains: { r: number; g: number; b: number }): "warm" | "cool" | "neutral" {
  // Gains > 1 on blue mean blue had to be boosted, i.e. the light was warm.
  const ratio = gains.b / gains.r;
  if (ratio > 1.08) return "warm";
  if (ratio < 0.92) return "cool";
  return "neutral";
}

function rgbToHex(rgb: RGB): string {
  const channel = (value: number) =>
    Math.min(255, Math.max(0, Math.round(value))).toString(16).padStart(2, "0");
  return `#${channel(rgb.r)}${channel(rgb.g)}${channel(rgb.b)}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
