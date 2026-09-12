import { labToLch } from "../color-spaces/lab";
import { deltaE2000 } from "../metrics/deltaE2000";
import { median } from "../segmentation/outliers";
import { kMeansAutoK } from "./kmeans";
import type { Lab } from "../types";

/**
 * Dominant color estimation by ensemble.
 *
 * Each estimator below fails in a different way: the median is rock-solid on a
 * uniform patch but meaningless on a bimodal one; clustering handles multiple
 * colors but can invent structure in a gradient; the histogram mode is robust
 * to outliers but quantization-limited. Running all three and measuring their
 * *agreement* gives both a better estimate and — more importantly — an honest
 * uncertainty, which a single estimator can never provide.
 */

export type EstimatorName = "median" | "histogram" | "kmeans";

export type Estimate = {
  estimator: EstimatorName;
  color: Lab;
};

export type DominantColorResult = {
  /** The fused estimate the pipeline reports. */
  color: Lab;
  /** Secondary colors present in the patch, most significant first. */
  secondary: Lab[];
  /** Individual estimator outputs, kept for diagnostics and confidence. */
  estimates: Estimate[];
  /**
   * Mean pairwise ΔE₀₀ between estimators. Low values mean the methods agree,
   * which is the strongest available evidence that the answer is right.
   */
  disagreement: number;
  /** Share of pixels belonging to the dominant cluster, 0–1. */
  dominantShare: number;
};

/**
 * Per-channel median in Lab.
 *
 * Robust (50% breakdown point) and exact for a uniform patch. Note the median
 * is taken channel-wise, which is not the geometric median — adequate here
 * because the input has already been outlier-filtered.
 */
export function medianEstimate(samples: Lab[]): Lab {
  return {
    L: median(samples.map((s) => s.L)),
    a: median(samples.map((s) => s.a)),
    b: median(samples.map((s) => s.b)),
  };
}

/** Bin width per Lab axis for the histogram estimator. */
const HISTOGRAM_BIN = 5;

/**
 * Histogram-mode estimate.
 *
 * Quantizes Lab into bins of {@link HISTOGRAM_BIN} units, finds the most
 * populated bin, then averages the exact values inside it. Averaging within the
 * winning bin avoids reporting a quantized value while keeping the robustness
 * of a mode.
 *
 * Limits: bin width trades resolution against stability. 5 ΔE units is roughly
 * "clearly distinguishable", so bins do not merge colors a human would separate.
 */
export function histogramEstimate(samples: Lab[]): Lab {
  const bins = new Map<string, { L: number; a: number; b: number; count: number }>();

  for (const sample of samples) {
    const key = [
      Math.floor(sample.L / HISTOGRAM_BIN),
      Math.floor(sample.a / HISTOGRAM_BIN),
      Math.floor(sample.b / HISTOGRAM_BIN),
    ].join(":");

    const bin = bins.get(key);
    if (bin) {
      bin.L += sample.L;
      bin.a += sample.a;
      bin.b += sample.b;
      bin.count++;
    } else {
      bins.set(key, { L: sample.L, a: sample.a, b: sample.b, count: 1 });
    }
  }

  let best: { L: number; a: number; b: number; count: number } | null = null;
  for (const bin of bins.values()) {
    if (!best || bin.count > best.count) best = bin;
  }
  if (!best) throw new Error("No samples for the histogram estimator");

  return { L: best.L / best.count, a: best.a / best.count, b: best.b / best.count };
}

/**
 * Fuses the estimators into a final color.
 *
 * Fusion is a weighted mean in Lab, with weights derived from how close each
 * estimator is to the others — an estimator that disagrees with the consensus
 * loses influence. This is a robustness mechanism, not a vote: if two of three
 * agree closely, the third cannot drag the result away on its own.
 *
 * @param samples Outlier-filtered Lab pixels from the region of interest.
 * @param options.seed Passed to k-means so the whole pipeline stays deterministic.
 * @returns The fused color plus the evidence behind it.
 */
export function estimateDominantColor(
  samples: Lab[],
  options: { seed?: number } = {},
): DominantColorResult {
  if (samples.length === 0) throw new Error("No samples to estimate a color from");

  const clustering = kMeansAutoK(samples, [1, 3, 5, 7], { seed: options.seed });
  const clusters = clustering.result.clusters;

  const estimates: Estimate[] = [
    { estimator: "median", color: medianEstimate(samples) },
    { estimator: "histogram", color: histogramEstimate(samples) },
    { estimator: "kmeans", color: clusters[0].center },
  ];

  // Mean pairwise perceptual distance between the estimators.
  let pairSum = 0;
  let pairCount = 0;
  for (let i = 0; i < estimates.length; i++) {
    for (let j = i + 1; j < estimates.length; j++) {
      pairSum += deltaE2000(estimates[i].color, estimates[j].color);
      pairCount++;
    }
  }
  const disagreement = pairCount === 0 ? 0 : pairSum / pairCount;

  // Weight each estimator by its closeness to the others (inverse distance).
  const weights = estimates.map((estimate) => {
    const distance =
      estimates
        .filter((other) => other !== estimate)
        .reduce((acc, other) => acc + deltaE2000(estimate.color, other.color), 0) /
      Math.max(1, estimates.length - 1);
    return 1 / (1 + distance);
  });

  const weightTotal = weights.reduce((acc, w) => acc + w, 0);
  const color: Lab = {
    L: estimates.reduce((acc, e, i) => acc + e.color.L * weights[i], 0) / weightTotal,
    a: estimates.reduce((acc, e, i) => acc + e.color.a * weights[i], 0) / weightTotal,
    b: estimates.reduce((acc, e, i) => acc + e.color.b * weights[i], 0) / weightTotal,
  };

  // Secondary colors: other clusters that are perceptually distinct from the
  // dominant one and hold a meaningful share of the patch.
  const secondary = clusters
    .slice(1)
    .filter((cluster) => cluster.weight >= 0.05 && deltaE2000(cluster.center, color) > 5)
    .map((cluster) => cluster.center);

  return {
    color,
    secondary,
    estimates,
    disagreement,
    dominantShare: clusters[0].weight,
  };
}

/** Convenience: chroma and hue of a Lab color, for callers that need LCh. */
export function chromaAndHue(color: Lab): { chroma: number; hue: number } {
  const lch = labToLch(color);
  return { chroma: lch.C, hue: lch.h };
}
