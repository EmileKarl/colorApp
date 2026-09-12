import { D65 , rgbToXyz, xyzToRgb } from "./xyz";
import type { Lab, LCh, RGB, WhitePoint, XYZ } from "../types";

/**
 * CIE L*a*b* (CIE 1976) and its cylindrical form LCh.
 *
 * Lab is *approximately perceptually uniform*: a given numeric distance
 * corresponds to a roughly similar perceived difference anywhere in the space.
 * That property is why every serious color comparison in this engine happens
 * here rather than in RGB, where the same numeric distance means wildly
 * different things depending on where you are in the cube.
 */

/** δ = 6/29. Below δ³ the cube-root curve is replaced by a linear segment. */
const DELTA = 6 / 29;
const DELTA_CUBED = DELTA * DELTA * DELTA; // ≈ 0.008856
const LINEAR_FACTOR = 3 * DELTA * DELTA; // ≈ 0.12842

/**
 * The f(t) companion function of the Lab transform.
 *
 * Formula:
 *   f(t) = t^(1/3)                  if t > δ³
 *   f(t) = t / (3δ²) + 4/29         otherwise
 *
 * The linear segment near zero keeps the derivative finite at t = 0, which
 * matters for dark pixels — a plain cube root would amplify sensor noise in
 * shadows into large L* swings.
 */
function f(t: number): number {
  return t > DELTA_CUBED ? Math.cbrt(t) : t / LINEAR_FACTOR + 4 / 29;
}

/** Inverse of {@link f}. */
function fInverse(t: number): number {
  return t > DELTA ? t * t * t : LINEAR_FACTOR * (t - 4 / 29);
}

/**
 * Converts CIE XYZ to CIE L*a*b*.
 *
 * Formulas:
 *   L* = 116·f(Y/Yn) − 16
 *   a* = 500·(f(X/Xn) − f(Y/Yn))
 *   b* = 200·(f(Y/Yn) − f(Z/Zn))
 *
 * @param xyz Tristimulus values, Y normalized to 1 for white.
 * @param white Reference white point (defaults to D65, matching sRGB).
 * @returns L* in 0–100, a* and b* typically -128..127 (unbounded in principle).
 * Assumptions: the color was viewed under `white`. Feeding XYZ measured under
 * a different illuminant without adapting it first produces a color cast.
 */
export function xyzToLab(xyz: XYZ, white: WhitePoint = D65): Lab {
  const fx = f(xyz.x / white.x);
  const fy = f(xyz.y / white.y);
  const fz = f(xyz.z / white.z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/** Inverse of {@link xyzToLab}. */
export function labToXyz(lab: Lab, white: WhitePoint = D65): XYZ {
  const fy = (lab.L + 16) / 116;
  const fx = fy + lab.a / 500;
  const fz = fy - lab.b / 200;

  return {
    x: white.x * fInverse(fx),
    y: white.y * fInverse(fy),
    z: white.z * fInverse(fz),
  };
}

/** Convenience: 8-bit sRGB → Lab (linearize → XYZ → Lab). */
export function rgbToLab(rgb: RGB, white: WhitePoint = D65): Lab {
  return xyzToLab(rgbToXyz(rgb), white);
}

/** Convenience: Lab → 8-bit sRGB. Out-of-gamut colors are clamped. */
export function labToRgb(lab: Lab, white: WhitePoint = D65): RGB {
  return xyzToRgb(labToXyz(lab, white));
}

/**
 * Converts Lab to its cylindrical form LCh(ab).
 *
 * Formulas:
 *   C* = √(a*² + b*²)            (chroma — colorfulness, 0 = neutral gray)
 *   h  = atan2(b*, a*) in degrees, wrapped to 0–360   (hue angle)
 *
 * Separating chroma and hue from lightness is what lets the engine say "same
 * hue, different lighting" instead of treating a shadowed red as a new color.
 *
 * @returns L unchanged (0–100), C ≥ 0, h in degrees 0–360.
 * Limits: hue is meaningless and returned as 0 for near-neutral colors where
 * C* ≈ 0, because atan2 of two near-zero numbers is dominated by noise.
 */
export function labToLch(lab: Lab): LCh {
  const C = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let h = 0;
  if (C > 1e-8) {
    h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
    if (h < 0) h += 360;
  }
  return { L: lab.L, C, h };
}

/** Inverse of {@link labToLch}. */
export function lchToLab(lch: LCh): Lab {
  const radians = (lch.h * Math.PI) / 180;
  return {
    L: lch.L,
    a: lch.C * Math.cos(radians),
    b: lch.C * Math.sin(radians),
  };
}

/** Convenience: 8-bit sRGB → LCh. */
export function rgbToLch(rgb: RGB, white: WhitePoint = D65): LCh {
  return labToLch(rgbToLab(rgb, white));
}
