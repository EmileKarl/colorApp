import { deltaE2000 } from "../metrics/deltaE2000";
import type { Lab } from "../types";

/**
 * k-means clustering in CIELAB.
 *
 * Clustering in Lab rather than RGB is what makes the cluster boundaries land
 * where a human would put them: distances in Lab are approximately perceptual,
 * so "these pixels are the same color" means the same thing everywhere in the
 * space.
 *
 * Determinism is a hard requirement here. A randomly seeded k-means would give
 * a different answer for the same photo on every scan — unacceptable for a
 * measurement tool, and untestable. Initialization therefore uses k-means++
 * driven by a seeded PRNG.
 */

export type Cluster = {
  /** Cluster centroid in Lab. */
  center: Lab;
  /** Number of pixels assigned to it. */
  size: number;
  /** Share of the total sample, 0–1. */
  weight: number;
  /** Mean distance of members to the centroid — cluster tightness. */
  spread: number;
};

export type KMeansResult = {
  clusters: Cluster[];
  /** Iterations actually run before convergence. */
  iterations: number;
  /** True if the centroids stopped moving before hitting the iteration cap. */
  converged: boolean;
};

/**
 * Deterministic 32-bit PRNG (mulberry32).
 *
 * Not cryptographic — the only requirement is that the same seed yields the
 * same sequence, so a given image always clusters identically.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Squared Euclidean distance in Lab — used inside the k-means loop for speed. */
function squaredDistance(a: Lab, b: Lab): number {
  const dL = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return dL * dL + da * da + db * db;
}

/**
 * k-means++ seeding (Arthur & Vassilvitskii, 2007).
 *
 * Picks the first center uniformly, then each subsequent center with
 * probability proportional to D(x)² — the squared distance to the nearest
 * already-chosen center. This spreads the initial centers out and avoids the
 * poor local minima that uniform random seeding regularly falls into.
 */
function seedCenters(samples: Lab[], k: number, random: () => number): Lab[] {
  const centers: Lab[] = [samples[Math.floor(random() * samples.length)]];

  while (centers.length < k) {
    const distances = samples.map((sample) =>
      Math.min(...centers.map((center) => squaredDistance(sample, center))),
    );
    const total = distances.reduce((acc, d) => acc + d, 0);

    if (total === 0) break; // every remaining point coincides with a center

    let target = random() * total;
    let index = 0;
    while (index < distances.length - 1 && target > distances[index]) {
      target -= distances[index];
      index++;
    }
    centers.push(samples[index]);
  }

  return centers;
}

/**
 * Runs k-means on Lab samples.
 *
 * @param samples Pixels in Lab.
 * @param k Number of clusters. Silently reduced if there are fewer samples.
 * @param options.maxIterations Safety cap, default 50 (convergence on a 64×64
 * patch is typically under 15).
 * @param options.seed PRNG seed; the same seed always yields the same result.
 * @returns Clusters sorted by descending weight, so `clusters[0]` is dominant.
 *
 * Limits: k-means assumes roughly spherical, similarly-sized clusters. A patch
 * with a smooth gradient has no natural clusters at all, and k-means will
 * happily invent k of them — which is why the engine checks cluster spread and
 * inter-cluster distance before trusting the split.
 */
export function kMeansLab(
  samples: Lab[],
  k: number,
  options: { maxIterations?: number; seed?: number } = {},
): KMeansResult {
  const { maxIterations = 50, seed = 42 } = options;

  if (samples.length === 0) throw new Error("k-means on an empty sample set");
  const effectiveK = Math.max(1, Math.min(k, samples.length));

  const random = mulberry32(seed);
  let centers = seedCenters(samples, effectiveK, random);
  let assignments = new Array<number>(samples.length).fill(0);
  let converged = false;
  let iterations = 0;

  for (; iterations < maxIterations; iterations++) {
    let changed = false;

    for (let i = 0; i < samples.length; i++) {
      let best = 0;
      let bestDistance = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d = squaredDistance(samples[i], centers[c]);
        if (d < bestDistance) {
          bestDistance = d;
          best = c;
        }
      }
      if (assignments[i] !== best) {
        assignments[i] = best;
        changed = true;
      }
    }

    const sums = centers.map(() => ({ L: 0, a: 0, b: 0, count: 0 }));
    for (let i = 0; i < samples.length; i++) {
      const bucket = sums[assignments[i]];
      bucket.L += samples[i].L;
      bucket.a += samples[i].a;
      bucket.b += samples[i].b;
      bucket.count++;
    }

    centers = sums.map((bucket, index) =>
      bucket.count === 0
        ? centers[index] // keep an empty cluster where it is rather than drifting
        : { L: bucket.L / bucket.count, a: bucket.a / bucket.count, b: bucket.b / bucket.count },
    );

    if (!changed) {
      converged = true;
      break;
    }
  }

  const clusters: Cluster[] = centers
    .map((center, index) => {
      const members = samples.filter((_, i) => assignments[i] === index);
      const spread =
        members.length === 0
          ? 0
          : members.reduce((acc, m) => acc + Math.sqrt(squaredDistance(m, center)), 0) /
            members.length;
      return {
        center,
        size: members.length,
        weight: members.length / samples.length,
        spread,
      };
    })
    .filter((cluster) => cluster.size > 0)
    .sort((a, b) => b.weight - a.weight);

  return { clusters, iterations, converged };
}

/**
 * Chooses k by silhouette-like stability rather than fixing it arbitrarily.
 *
 * For each candidate k, the score rewards clusters that are tight (low spread)
 * and far apart (high inter-centroid ΔE₀₀), then penalises k for its own sake
 * so that a simple patch is not split into spurious clusters.
 *
 * @param candidates k values to try, default [1, 3, 5, 7].
 * @returns The best result, along with the k that produced it.
 *
 * Limits: this is a pragmatic heuristic, not a formal silhouette coefficient —
 * computing true silhouettes is O(n²) in the number of pixels and too slow to
 * run on the JS thread of a phone.
 */
export function kMeansAutoK(
  samples: Lab[],
  candidates: number[] = [1, 3, 5, 7],
  options: { seed?: number } = {},
): { result: KMeansResult; k: number; score: number } {
  let best: { result: KMeansResult; k: number; score: number } | null = null;

  for (const k of candidates) {
    if (k > samples.length) continue;
    const result = kMeansLab(samples, k, options);
    const score = clusteringScore(result);
    if (!best || score > best.score) best = { result, k, score };
  }

  if (!best) throw new Error("No viable k for the given samples");
  return best;
}

/** Higher is better: tight, well-separated clusters without needless splits. */
function clusteringScore(result: KMeansResult): number {
  const { clusters } = result;
  if (clusters.length === 1) {
    // A single cluster is ideal when the patch really is one color: score it
    // on tightness alone.
    return 1 / (1 + clusters[0].spread);
  }

  const meanSpread =
    clusters.reduce((acc, c) => acc + c.spread * c.weight, 0) /
    clusters.reduce((acc, c) => acc + c.weight, 0);

  let minSeparation = Infinity;
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      minSeparation = Math.min(minSeparation, deltaE2000(clusters[i].center, clusters[j].center));
    }
  }

  const separationGain = minSeparation / (1 + meanSpread);
  // Penalise extra clusters so a uniform patch is not over-segmented.
  return separationGain / Math.sqrt(clusters.length);
}
