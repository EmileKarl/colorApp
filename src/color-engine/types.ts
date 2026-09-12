/**
 * Shared value types for the color engine.
 *
 * Every type here carries explicit units, because the single biggest source of
 * bugs in color code is mixing 0–1 and 0–255 ranges, or degrees and radians.
 */

/** Gamma-encoded sRGB, channels in 0–255. What a camera/PNG gives us. */
export type RGB = { r: number; g: number; b: number };

/** Linear-light RGB, channels in 0–1. Physically proportional to luminance. */
export type LinearRGB = { r: number; g: number; b: number };

/** CIE 1931 XYZ tristimulus values, Y normalized so that white = 1. */
export type XYZ = { x: number; y: number; z: number };

/**
 * CIE L*a*b*. L* in 0–100 (perceptual lightness), a* and b* roughly -128..127
 * (green–red and blue–yellow opponent axes). Relative to a stated white point.
 */
export type Lab = { L: number; a: number; b: number };

/** Cylindrical form of Lab: C* is chroma (≥0), h is hue angle in degrees 0–360. */
export type LCh = { L: number; C: number; h: number };

/** h in degrees 0–360, s and v in 0–1. */
export type HSV = { h: number; s: number; v: number };

/** A reference white point in XYZ (Y = 1). */
export type WhitePoint = XYZ;

/**
 * Multi-space view of one color, carried through the pipeline so each stage
 * can use the representation it is actually good for.
 */
export type ColorSample = {
  rgb: RGB;
  hsv: HSV;
  xyz: XYZ;
  lab: Lab;
  lch: LCh;
};
