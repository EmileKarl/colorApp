import { linearToRgb, rgbToLinear } from "./srgb";
import type { LinearRGB, RGB, WhitePoint, XYZ } from "../types";

/**
 * CIE 1931 XYZ — the device-independent space every other conversion goes
 * through. XYZ is what lets us say "this color" independently of the camera
 * that captured it.
 */

/** D65 (noon daylight, 6504 K) — the white point sRGB is defined against. */
export const D65: WhitePoint = { x: 0.95047, y: 1.0, z: 1.08883 };

/** D50 (horizon light, 5003 K) — used by ICC/printing workflows. */
export const D50: WhitePoint = { x: 0.96422, y: 1.0, z: 0.82521 };

/**
 * sRGB (linear) → XYZ matrix, D65-adapted (IEC 61966-2-1).
 * Rows are X, Y, Z; the Y row doubles as the Rec. 709 luminance weights.
 */
const RGB_TO_XYZ = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.072175],
  [0.0193339, 0.119192, 0.9503041],
] as const;

/** Inverse of {@link RGB_TO_XYZ}. */
const XYZ_TO_RGB = [
  [3.2404542, -1.5371385, -0.4985314],
  [-0.969266, 1.8760108, 0.041556],
  [0.0556434, -0.2040259, 1.0572252],
] as const;

/**
 * Converts linear-light sRGB to CIE XYZ.
 *
 * Formula: [X Y Z]ᵀ = M · [R G B]ᵀ with M = RGB_TO_XYZ.
 *
 * @param linear Linear-light channels in 0–1 (see {@link rgbToLinear}).
 * @returns XYZ with Y in 0–1 for in-gamut inputs.
 * Assumptions: sRGB primaries and a D65 illuminant.
 */
export function linearRgbToXyz(linear: LinearRGB): XYZ {
  const { r, g, b } = linear;
  return {
    x: RGB_TO_XYZ[0][0] * r + RGB_TO_XYZ[0][1] * g + RGB_TO_XYZ[0][2] * b,
    y: RGB_TO_XYZ[1][0] * r + RGB_TO_XYZ[1][1] * g + RGB_TO_XYZ[1][2] * b,
    z: RGB_TO_XYZ[2][0] * r + RGB_TO_XYZ[2][1] * g + RGB_TO_XYZ[2][2] * b,
  };
}

/** Convenience: 8-bit gamma-encoded sRGB → XYZ, doing the linearization first. */
export function rgbToXyz(rgb: RGB): XYZ {
  return linearRgbToXyz(rgbToLinear(rgb));
}

/**
 * Converts CIE XYZ back to linear-light sRGB.
 *
 * @returns Linear channels in 0–1 for in-gamut colors; values outside that
 * range mean the color is outside the sRGB gamut and cannot be displayed
 * exactly. They are returned unclamped so callers can detect it.
 */
export function xyzToLinearRgb(xyz: XYZ): LinearRGB {
  const { x, y, z } = xyz;
  return {
    r: XYZ_TO_RGB[0][0] * x + XYZ_TO_RGB[0][1] * y + XYZ_TO_RGB[0][2] * z,
    g: XYZ_TO_RGB[1][0] * x + XYZ_TO_RGB[1][1] * y + XYZ_TO_RGB[1][2] * z,
    b: XYZ_TO_RGB[2][0] * x + XYZ_TO_RGB[2][1] * y + XYZ_TO_RGB[2][2] * z,
  };
}

/** Convenience: XYZ → 8-bit sRGB (clamped to gamut by {@link linearToRgb}). */
export function xyzToRgb(xyz: XYZ): RGB {
  return linearToRgb(xyzToLinearRgb(xyz));
}

/**
 * Von Kries chromatic adaptation between two illuminants, in the Bradford cone
 * space — the standard way to ask "what would this color look like if the light
 * had been D65 instead?".
 *
 * This is the mathematical backbone of white-balance correction: estimate the
 * scene illuminant, then adapt every pixel from it to D65.
 *
 * @param xyz Color measured under `from`.
 * @param from Source illuminant white point.
 * @param to Destination illuminant white point.
 * @returns The same color adapted to `to`.
 * Limits: a linear cone-scaling model. It handles illuminant shifts well but
 * cannot undo clipping or non-linear camera processing.
 */
export function adaptWhitePoint(xyz: XYZ, from: WhitePoint, to: WhitePoint): XYZ {
  const sourceCone = xyzToCone(from);
  const destCone = xyzToCone(to);
  const cone = xyzToCone(xyz);

  const adapted: [number, number, number] = [
    (cone[0] * destCone[0]) / sourceCone[0],
    (cone[1] * destCone[1]) / sourceCone[1],
    (cone[2] * destCone[2]) / sourceCone[2],
  ];

  return coneToXyz(adapted);
}

/** Bradford cone response matrix. */
const BRADFORD = [
  [0.8951, 0.2664, -0.1614],
  [-0.7502, 1.7135, 0.0367],
  [0.0389, -0.0685, 1.0296],
] as const;

/** Inverse Bradford matrix. */
const BRADFORD_INV = [
  [0.9869929, -0.1470543, 0.1599627],
  [0.4323053, 0.5183603, 0.0492912],
  [-0.0085287, 0.0400428, 0.9684867],
] as const;

function xyzToCone({ x, y, z }: XYZ): [number, number, number] {
  return [
    BRADFORD[0][0] * x + BRADFORD[0][1] * y + BRADFORD[0][2] * z,
    BRADFORD[1][0] * x + BRADFORD[1][1] * y + BRADFORD[1][2] * z,
    BRADFORD[2][0] * x + BRADFORD[2][1] * y + BRADFORD[2][2] * z,
  ];
}

function coneToXyz(cone: [number, number, number]): XYZ {
  const [l, m, s] = cone;
  return {
    x: BRADFORD_INV[0][0] * l + BRADFORD_INV[0][1] * m + BRADFORD_INV[0][2] * s,
    y: BRADFORD_INV[1][0] * l + BRADFORD_INV[1][1] * m + BRADFORD_INV[1][2] * s,
    z: BRADFORD_INV[2][0] * l + BRADFORD_INV[2][1] * m + BRADFORD_INV[2][2] * s,
  };
}
