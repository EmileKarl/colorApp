import type { Lab } from "../types";

/** Application-specific weighting factors (CIE 1994). */
export type DeltaE94Weights = {
  /** Lightness weight. 1 for graphic arts, 2 for textiles. */
  kL: number;
  /** Chroma scaling constant. */
  K1: number;
  /** Hue scaling constant. */
  K2: number;
};

/** Graphic-arts weights — the right default for screen/photo work. */
export const GRAPHIC_ARTS: DeltaE94Weights = { kL: 1, K1: 0.045, K2: 0.015 };

/** Textile weights, kept for completeness. */
export const TEXTILES: DeltaE94Weights = { kL: 2, K1: 0.048, K2: 0.014 };

/**
 * CIE94 color difference.
 *
 * Improves on CIE76 by scaling the chroma and hue terms with the chroma of the
 * reference color, which fixes CIE76's habit of exaggerating differences
 * between saturated colors.
 *
 * Formulas:
 *   C₁ = √(a₁² + b₁²),  C₂ = √(a₂² + b₂²)
 *   ΔC = C₁ − C₂
 *   ΔH = √(Δa² + Δb² − ΔC²)     (clamped at 0; can go slightly negative from
 *                                floating-point error alone)
 *   S_L = 1,  S_C = 1 + K₁·C₁,  S_H = 1 + K₂·C₁
 *   ΔE*94 = √((ΔL/(k_L·S_L))² + (ΔC/S_C)² + (ΔH/S_H)²)
 *
 * @param reference The *reference* color — the formula is asymmetric, since
 * S_C and S_H use C₁. Swapping arguments changes the result.
 * @param sample The color being compared against the reference.
 * @returns Difference in ΔE units.
 * Limits: still weaker than CIEDE2000 for blues and near-neutrals, and its
 * asymmetry makes it awkward for clustering, where a symmetric metric is
 * expected.
 */
export function deltaE94(
  reference: Lab,
  sample: Lab,
  weights: DeltaE94Weights = GRAPHIC_ARTS,
): number {
  const { kL, K1, K2 } = weights;

  const dL = reference.L - sample.L;
  const da = reference.a - sample.a;
  const db = reference.b - sample.b;

  const c1 = Math.sqrt(reference.a * reference.a + reference.b * reference.b);
  const c2 = Math.sqrt(sample.a * sample.a + sample.b * sample.b);
  const dC = c1 - c2;

  // Guard against a tiny negative from rounding before the square root.
  const dH2 = Math.max(0, da * da + db * db - dC * dC);

  const sL = 1;
  const sC = 1 + K1 * c1;
  const sH = 1 + K2 * c1;

  const termL = dL / (kL * sL);
  const termC = dC / sC;
  const termH = Math.sqrt(dH2) / sH;

  return Math.sqrt(termL * termL + termC * termC + termH * termH);
}
