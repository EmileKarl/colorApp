import type { Lab } from "../types";

/** Parametric weighting factors. All 1 under reference viewing conditions. */
export type DeltaE2000Weights = { kL: number; kC: number; kH: number };

const DEFAULT_WEIGHTS: DeltaE2000Weights = { kL: 1, kC: 1, kH: 1 };

const deg = (radians: number) => (radians * 180) / Math.PI;
const rad = (degrees: number) => (degrees * Math.PI) / 180;

/** 25⁷, precomputed — appears in the chroma-dependent G and R_C terms. */
const POW25_7 = Math.pow(25, 7);

/**
 * CIEDE2000 color difference — the current CIE recommendation and the metric
 * this engine makes decisions with.
 *
 * On top of CIE94 it adds: a hue-dependent weighting T, a chroma-dependent
 * scaling G that fixes the well-known failure of earlier formulas on
 * near-neutral colors, and a rotation term R_T that corrects the blue region
 * (~275°), where hue and chroma errors interact.
 *
 * Steps (Sharma, Wu & Dalal 2005, "The CIEDE2000 Color-Difference Formula:
 * Implementation Notes, Supplementary Test Data, and Mathematical
 * Observations"):
 *
 *   C̄   = (C₁ + C₂)/2  with Cᵢ = √(aᵢ² + bᵢ²)
 *   G    = ½·(1 − √(C̄⁷/(C̄⁷ + 25⁷)))
 *   a′ᵢ  = (1 + G)·aᵢ
 *   C′ᵢ  = √(a′ᵢ² + bᵢ²)
 *   h′ᵢ  = atan2(bᵢ, a′ᵢ)  in degrees, wrapped to [0,360); 0 if a′ᵢ = bᵢ = 0
 *   ΔL′  = L₂ − L₁,  ΔC′ = C′₂ − C′₁
 *   Δh′  = 0 if C′₁C′₂ = 0, else h′₂ − h′₁ folded into (−180, 180]
 *   ΔH′  = 2·√(C′₁C′₂)·sin(Δh′/2)
 *   T    = 1 − 0.17cos(h̄′−30) + 0.24cos(2h̄′) + 0.32cos(3h̄′+6) − 0.20cos(4h̄′−63)
 *   S_L  = 1 + 0.015(L̄′−50)²/√(20+(L̄′−50)²)
 *   S_C  = 1 + 0.045·C̄′
 *   S_H  = 1 + 0.015·C̄′·T
 *   R_T  = −sin(2Δθ)·R_C,  Δθ = 30·exp(−((h̄′−275)/25)²),
 *          R_C = 2√(C̄′⁷/(C̄′⁷+25⁷))
 *   ΔE₀₀ = √( (ΔL′/k_L S_L)² + (ΔC′/k_C S_C)² + (ΔH′/k_H S_H)²
 *             + R_T·(ΔC′/k_C S_C)·(ΔH′/k_H S_H) )
 *
 * @returns Difference in ΔE₀₀ units. As a rough guide: <1 is imperceptible to
 * most observers, 1–2 noticeable on close inspection, >5 clearly different
 * colors. This engine's thresholds are defined in terms of this metric.
 *
 * Assumptions: both colors share a reference white point, and reference
 * viewing conditions (hence k = 1). Symmetric: ΔE₀₀(A,B) = ΔE₀₀(B,A).
 * Limits: the hue terms are discontinuous across the 0°/360° boundary in their
 * naive form — the mean-hue cases below exist precisely to handle that, and
 * are where most buggy implementations go wrong. Verified against the 34
 * published Sharma test pairs in the accompanying test file.
 */
export function deltaE2000(c1: Lab, c2: Lab, weights: DeltaE2000Weights = DEFAULT_WEIGHTS): number {
  const { kL, kC, kH } = weights;

  const C1 = Math.sqrt(c1.a * c1.a + c1.b * c1.b);
  const C2 = Math.sqrt(c2.a * c2.a + c2.b * c2.b);
  const cBar = (C1 + C2) / 2;

  const cBar7 = Math.pow(cBar, 7);
  const G = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + POW25_7)));

  const a1p = (1 + G) * c1.a;
  const a2p = (1 + G) * c2.a;

  const C1p = Math.sqrt(a1p * a1p + c1.b * c1.b);
  const C2p = Math.sqrt(a2p * a2p + c2.b * c2.b);

  const h1p = hueAngle(c1.b, a1p);
  const h2p = hueAngle(c2.b, a2p);

  const dLp = c2.L - c1.L;
  const dCp = C2p - C1p;

  const chromaProduct = C1p * C2p;
  let dhp = 0;
  if (chromaProduct !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(chromaProduct) * Math.sin(rad(dhp) / 2);

  const lBarP = (c1.L + c2.L) / 2;
  const cBarP = (C1p + C2p) / 2;

  // Mean hue: the case analysis below is the crux of the formula. Averaging
  // 350° and 10° naively yields 180° (the opposite hue) instead of 0°.
  let hBarP: number;
  if (chromaProduct === 0) {
    hBarP = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    hBarP = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    hBarP = (h1p + h2p + 360) / 2;
  } else {
    hBarP = (h1p + h2p - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos(rad(hBarP - 30)) +
    0.24 * Math.cos(rad(2 * hBarP)) +
    0.32 * Math.cos(rad(3 * hBarP + 6)) -
    0.2 * Math.cos(rad(4 * hBarP - 63));

  const lBarOffset = lBarP - 50;
  const sL = 1 + (0.015 * lBarOffset * lBarOffset) / Math.sqrt(20 + lBarOffset * lBarOffset);
  const sC = 1 + 0.045 * cBarP;
  const sH = 1 + 0.015 * cBarP * T;

  const dTheta = 30 * Math.exp(-Math.pow((hBarP - 275) / 25, 2));
  const cBarP7 = Math.pow(cBarP, 7);
  const rC = 2 * Math.sqrt(cBarP7 / (cBarP7 + POW25_7));
  const rT = -Math.sin(rad(2 * dTheta)) * rC;

  const termL = dLp / (kL * sL);
  const termC = dCp / (kC * sC);
  const termH = dHp / (kH * sH);

  return Math.sqrt(termL * termL + termC * termC + termH * termH + rT * termC * termH);
}

/**
 * Hue angle in degrees [0,360), returning 0 for the undefined a′ = b = 0 case
 * as the standard requires.
 */
function hueAngle(b: number, aPrime: number): number {
  if (b === 0 && aPrime === 0) return 0;
  const angle = deg(Math.atan2(b, aPrime));
  return angle >= 0 ? angle : angle + 360;
}
