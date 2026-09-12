/**
 * Confidence and uncertainty.
 *
 * This module exists to keep one promise: the engine never reports a precision
 * it cannot support. Confidence is built only from evidence the engine actually
 * observed — image quality, estimator agreement, illuminant-estimator
 * agreement, classification margin — never from an assumed baseline.
 *
 * Deliberately NOT included: any claim of absolute accuracy. Confidence here
 * means "how internally consistent this measurement is", which is a necessary
 * but not sufficient condition for being correct. Only a validation run against
 * a physical reference chart can speak to true accuracy, and until that data
 * exists the engine must not imply otherwise.
 */

export type ConfidenceInputs = {
  /** Image quality score, 0–1 (see assessImageQuality). */
  imageQuality: number;
  /** Mean pairwise ΔE₀₀ between the dominant-color estimators. */
  estimatorDisagreement: number;
  /** Agreement between illuminant estimators, 0–1. */
  lightingAgreement: number;
  /** Share of the patch held by the dominant cluster, 0–1. */
  dominantShare: number;
  /** ΔE₀₀ gap between the best and second-best classification. */
  classificationMargin: number;
  /** ΔE₀₀ from the measured color to its matched reference. */
  matchDeltaE: number;
  /** Mean perceptual lightness L* of the region, 0–100. */
  meanLightness: number;
};

export type ConfidenceResult = {
  /** Overall confidence, 0–1. */
  confidence: number;
  /**
   * Estimated measurement uncertainty in ΔE₀₀ units — the radius within which
   * the true color plausibly sits, given the observed evidence.
   */
  uncertainty: number;
  /** Per-factor breakdown, so a low score can be explained to the user. */
  factors: {
    imageQuality: number;
    estimatorAgreement: number;
    lightingAgreement: number;
    patchUniformity: number;
    classificationClarity: number;
    exposureQuality: number;
  };
  /** Human-readable reasons confidence was reduced, most significant first. */
  limitations: string[];
};

/**
 * Relative importance of each factor. Must sum to 1.
 *
 * These are not arbitrary: the synthetic benchmark showed exposure error to be
 * the single largest remaining error source (mean ΔE₀₀ ≈ 12–15 for
 * under/overexposed captures, versus < 1 for everything else), while the
 * engine's internal-consistency signals stayed high there — a uniform patch
 * looks perfect to every estimator regardless of how badly it was exposed.
 * Exposure therefore carries its own substantial weight, otherwise the engine
 * is most confident exactly where it is least accurate.
 */
const WEIGHTS = {
  imageQuality: 0.22,
  estimatorAgreement: 0.22,
  exposureQuality: 0.2,
  lightingAgreement: 0.16,
  patchUniformity: 0.12,
  classificationClarity: 0.08,
} as const;

/**
 * Lightness band within which exposure does not meaningfully degrade accuracy.
 * Taken from the benchmark, not from intuition.
 */
const WELL_EXPOSED_MIN = 32;
const WELL_EXPOSED_MAX = 82;

/**
 * Maps mean lightness onto an exposure-quality factor in 0–1.
 *
 * Flat at 1 inside the well-exposed band, falling off toward the extremes
 * where information is being lost to clipping at either end.
 */
export function exposureQualityFromLightness(meanLightness: number): number {
  if (meanLightness >= WELL_EXPOSED_MIN && meanLightness <= WELL_EXPOSED_MAX) return 1;
  const distance =
    meanLightness < WELL_EXPOSED_MIN
      ? WELL_EXPOSED_MIN - meanLightness
      : meanLightness - WELL_EXPOSED_MAX;
  // Reaches ~0.1 about 25 L* units outside the band.
  return clamp01(Math.exp(-distance / 11));
}

/**
 * Combines the evidence into a confidence score and an uncertainty radius.
 *
 * The combination is a weighted geometric mean rather than an arithmetic one:
 * geometric means are dominated by their weakest term, so a single
 * disqualifying problem (a blown-out patch) cannot be averaged away by four
 * healthy factors. That is the correct behaviour for a measurement claim.
 *
 * Formula: confidence = Π fᵢ^wᵢ  with Σwᵢ = 1
 *
 * @returns Confidence in 0–1 and uncertainty in ΔE₀₀ units.
 */
export function computeConfidence(inputs: ConfidenceInputs): ConfidenceResult {
  const factors = {
    imageQuality: clamp01(inputs.imageQuality),
    // Estimators within ~1 ΔE₀₀ are effectively unanimous; beyond ~8 they are
    // telling different stories about the patch.
    estimatorAgreement: clamp01(1 - (inputs.estimatorDisagreement - 1) / 8),
    lightingAgreement: clamp01(inputs.lightingAgreement),
    patchUniformity: clamp01(inputs.dominantShare),
    // A margin of several ΔE₀₀ means the winning name is unambiguous.
    classificationClarity: clamp01(inputs.classificationMargin / 6),
    exposureQuality: exposureQualityFromLightness(inputs.meanLightness),
  };

  // Geometric mean, guarded against a zero factor annihilating everything.
  const floor = 0.02;
  const confidence = clamp01(
    Math.exp(
      WEIGHTS.imageQuality * Math.log(Math.max(floor, factors.imageQuality)) +
        WEIGHTS.estimatorAgreement * Math.log(Math.max(floor, factors.estimatorAgreement)) +
        WEIGHTS.exposureQuality * Math.log(Math.max(floor, factors.exposureQuality)) +
        WEIGHTS.lightingAgreement * Math.log(Math.max(floor, factors.lightingAgreement)) +
        WEIGHTS.patchUniformity * Math.log(Math.max(floor, factors.patchUniformity)) +
        WEIGHTS.classificationClarity *
          Math.log(Math.max(floor, factors.classificationClarity)),
    ),
  );

  // Some factors are *gating*, not merely contributing: if the image is
  // unusable or the patch is far outside the usable exposure range, no amount
  // of agreement between estimators can rescue the measurement. A weighted
  // geometric mean alone under-punishes these — with a weight of 0.22, an
  // image quality of 0.05 still yields 0.52, which would be a dishonest number
  // to show a user. Capping confidence at √(gating factor) states the real
  // constraint: bad input bounds what can be claimed, full stop.
  const gate = Math.min(Math.sqrt(factors.imageQuality), Math.sqrt(factors.exposureQuality));

  return {
    confidence: Math.min(confidence, gate),
    uncertainty: estimateUncertainty(inputs, Math.min(confidence, gate)),
    factors,
    limitations: describeLimitations(factors, inputs),
  };
}

/**
 * Estimates the uncertainty radius in ΔE₀₀.
 *
 * Built from what was actually measured: the spread between estimators is
 * direct evidence of how much the answer could move, and low confidence widens
 * it further, never below {@link IRREDUCIBLE_UNCERTAINTY}.
 */
function estimateUncertainty(inputs: ConfidenceInputs, confidence: number): number {
  const fromEstimators = Math.max(1, inputs.estimatorDisagreement);
  const fromConfidence = (1 - confidence) * 12;
  const fromLighting = (1 - clamp01(inputs.lightingAgreement)) * 6;

  return round2(
    Math.max(
      IRREDUCIBLE_UNCERTAINTY,
      fromEstimators + fromConfidence * 0.5 + fromLighting * 0.5,
    ),
  );
}

/**
 * Floor on reported uncertainty, in ΔE₀₀.
 *
 * This is not a safety margin — it is an information-theoretic limit. Exposure
 * error is *unobservable* from a single uniform patch: a dark surface captured
 * 1.8× too bright is pixel-for-pixel indistinguishable from a mid-tone surface
 * captured correctly. The benchmark makes this concrete — exposure-shifted
 * captures produce ΔE₀₀ errors above 10 while every internal consistency
 * signal the engine has stays perfect.
 *
 * Since the engine cannot detect that error, it must carry it in the
 * uncertainty rather than pretend to a precision it cannot support. Only an
 * in-frame reference of known reflectance (the ColorChecker protocol in
 * docs/COLOR_ENGINE.md) makes exposure observable and lets this floor drop.
 */
export const IRREDUCIBLE_UNCERTAINTY = 3;

/** Turns low factors into specific, actionable explanations. */
function describeLimitations(
  factors: ConfidenceResult["factors"],
  inputs: ConfidenceInputs,
): string[] {
  const limitations: { weight: number; message: string }[] = [];

  if (factors.exposureQuality < 0.7) {
    limitations.push({
      weight: (1 - factors.exposureQuality) * 1.2, // measured as the dominant error source
      message:
        inputs.meanLightness < 32
          ? "Zone trop sombre : la couleur mesurée sera plus foncée que la réalité."
          : "Zone trop claire : la couleur mesurée sera délavée par rapport à la réalité.",
    });
  }
  if (factors.imageQuality < 0.6) {
    limitations.push({
      weight: 1 - factors.imageQuality,
      message: "Qualité d'image insuffisante (exposition, bruit ou zones brûlées).",
    });
  }
  if (factors.estimatorAgreement < 0.6) {
    limitations.push({
      weight: 1 - factors.estimatorAgreement,
      message: "Les méthodes d'estimation ne convergent pas : la zone n'est probablement pas uniforme.",
    });
  }
  if (factors.lightingAgreement < 0.5) {
    limitations.push({
      weight: 1 - factors.lightingAgreement,
      message: "L'éclairage n'a pas pu être estimé de façon fiable ; aucune correction appliquée.",
    });
  }
  if (factors.patchUniformity < 0.7) {
    limitations.push({
      weight: 1 - factors.patchUniformity,
      message: "Plusieurs couleurs dans la zone visée : rapproche le viseur d'une surface unie.",
    });
  }
  if (inputs.matchDeltaE > 10) {
    limitations.push({
      weight: Math.min(1, inputs.matchDeltaE / 25),
      message: "Aucune couleur de référence proche : le nom proposé est approximatif.",
    });
  }

  return limitations.sort((a, b) => b.weight - a.weight).map((item) => item.message);
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
