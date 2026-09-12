import { labToLch } from "../color-spaces/lab";
import { hueDistance } from "../color-spaces/hsv";
import { deltaE2000 } from "../metrics/deltaE2000";
import { COLOR_DATABASE, type ReferenceColor } from "./colorDatabase";
import type { Lab } from "../types";

/**
 * Perceptual classification against the reference database.
 *
 * The match is driven by ΔE₀₀ — the metric validated against the published CIE
 * test data — rather than RGB distance. Hue, chroma and lightness agreement
 * then act as tie-breakers, because two entries can sit at a similar ΔE₀₀ while
 * one is obviously the better *name* for the color (a desaturated blue should
 * match "Bleu ciel", not "Gris clair", even if the gray is marginally closer).
 */

export type ColorMatch = {
  reference: ReferenceColor;
  /** Perceptual distance to the reference, in ΔE₀₀ units. */
  deltaE: number;
  /** Combined score used for ranking, 0–1 (higher is better). */
  score: number;
};

export type ClassificationResult = {
  /** Best match, or null when the database is empty. */
  best: ColorMatch | null;
  /** Runners-up, for showing alternatives and for diagnosing ambiguity. */
  alternatives: ColorMatch[];
  /**
   * Margin in ΔE₀₀ between the best and second-best match. A small margin means
   * the classification is genuinely ambiguous, which must lower confidence.
   */
  margin: number;
};

/**
 * ΔE₀₀ above which a match stops being meaningful.
 *
 * At ΔE₀₀ > 25 the "closest" named color is not a description of the sample in
 * any useful sense; the engine reports the measurement and admits it has no
 * good name rather than attaching a misleading one.
 */
export const MAX_MEANINGFUL_DELTA_E = 25;

/**
 * Classifies a Lab color against the reference database.
 *
 * Scoring:
 *   score = w_ΔE·f(ΔE₀₀) + w_h·g(Δhue) + w_C·g(ΔC) + w_L·g(ΔL), then scaled by
 *   the reference entry's own confidence.
 *
 * with f and g monotonically decreasing in the error. ΔE₀₀ dominates (weight
 * 0.7); hue/chroma/lightness contribute the remaining 0.3 as tie-breakers.
 *
 * @param color The measured color in Lab.
 * @param database Defaults to {@link COLOR_DATABASE}; injectable for tests.
 * @returns Best match, alternatives, and the ambiguity margin.
 *
 * Limits: these weights are chosen from first principles, not learned. The spec
 * calls for calibrating them on a validation set — see
 * `docs/COLOR_ENGINE.md` for why that step is deferred until real labelled data
 * exists, since tuning them on synthetic data would only fit the simulator.
 */
export function classifyColor(
  color: Lab,
  database: ReferenceColor[] = COLOR_DATABASE,
): ClassificationResult {
  if (database.length === 0) return { best: null, alternatives: [], margin: 0 };

  const lch = labToLch(color);

  const matches: ColorMatch[] = database
    .map((reference) => {
      const dE = deltaE2000(color, reference.lab);

      // Each term maps an error onto 0–1, decaying with a scale chosen to match
      // the typical spread of that quantity.
      const deltaETerm = 1 / (1 + dE / 10);
      const hueTerm =
        lch.C < 5 || reference.chroma < 5
          ? 1 // hue is meaningless for near-neutrals; do not let it vote
          : 1 - hueDistance(lch.h, reference.hue) / 180;
      const chromaTerm = 1 / (1 + Math.abs(lch.C - reference.chroma) / 20);
      const lightnessTerm = 1 / (1 + Math.abs(color.L - reference.lab.L) / 20);

      const score =
        (0.7 * deltaETerm + 0.12 * hueTerm + 0.1 * chromaTerm + 0.08 * lightnessTerm) *
        reference.confidence;

      return { reference, deltaE: dE, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = matches[0];
  const margin = matches.length > 1 ? matches[1].deltaE - best.deltaE : Infinity;

  return {
    best: best.deltaE <= MAX_MEANINGFUL_DELTA_E ? best : null,
    alternatives: matches.slice(1, 4),
    margin: Number.isFinite(margin) ? margin : 0,
  };
}

/**
 * Decides whether two measured colors are "the same color" for deduplication.
 *
 * Replaces the engine-external RGB threshold with a perceptual one. ΔE₀₀ ≤ 2.3
 * is the commonly cited "just noticeable difference" for a trained observer
 * under controlled viewing — a deliberately strict bar, since merging two
 * genuinely different community colors is worse than creating a near-duplicate.
 */
export const SAME_COLOR_DELTA_E = 2.3;

/** True when two Lab colors are within {@link SAME_COLOR_DELTA_E}. */
export function isPerceptuallySame(a: Lab, b: Lab, threshold = SAME_COLOR_DELTA_E): boolean {
  return deltaE2000(a, b) <= threshold;
}
