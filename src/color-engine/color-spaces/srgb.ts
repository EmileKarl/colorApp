import type { LinearRGB, RGB } from "../types";

/**
 * sRGB gamma encoding/decoding (IEC 61966-2-1).
 *
 * A camera's RGB values are *gamma-encoded*: they are not proportional to the
 * amount of light that hit the sensor. Averaging, white balancing or converting
 * to XYZ without undoing that encoding first is physically wrong — it is the
 * most common silent error in naive color code, and it biases every average
 * toward darker values.
 */

/** Threshold below which the transfer function is linear rather than a power law. */
const LINEAR_SEGMENT_THRESHOLD = 0.04045;
const LINEAR_SLOPE = 12.92;
const ALPHA = 0.055;
const GAMMA = 2.4;

/**
 * Converts one gamma-encoded sRGB channel to linear light.
 *
 * Formula (IEC 61966-2-1):
 *   c_lin = c / 12.92                      if c ≤ 0.04045
 *   c_lin = ((c + 0.055) / 1.055) ^ 2.4    otherwise
 *
 * @param channel Gamma-encoded channel, unit: 0–1.
 * @returns Linear-light channel, unit: 0–1.
 *
 * Assumptions: the input really is sRGB-encoded (true for JPEG/PNG from phone
 * cameras in sRGB mode; false for Display-P3 or RAW captures).
 * Limits: values outside 0–1 are passed through the same formula, which stays
 * monotonic but is no longer physically meaningful.
 */
export function linearizeChannel(channel: number): number {
  return channel <= LINEAR_SEGMENT_THRESHOLD
    ? channel / LINEAR_SLOPE
    : Math.pow((channel + ALPHA) / (1 + ALPHA), GAMMA);
}

/**
 * Inverse of {@link linearizeChannel}.
 *
 * Formula:
 *   c = 12.92 · c_lin                          if c_lin ≤ 0.0031308
 *   c = 1.055 · c_lin^(1/2.4) − 0.055          otherwise
 *
 * @param channel Linear-light channel, unit: 0–1.
 * @returns Gamma-encoded channel, unit: 0–1.
 */
export function delinearizeChannel(channel: number): number {
  return channel <= 0.0031308
    ? channel * LINEAR_SLOPE
    : (1 + ALPHA) * Math.pow(channel, 1 / GAMMA) - ALPHA;
}

/**
 * Converts 8-bit gamma-encoded sRGB to linear-light RGB.
 *
 * @param rgb Channels in 0–255.
 * @returns Channels in 0–1, proportional to luminance.
 */
export function rgbToLinear(rgb: RGB): LinearRGB {
  return {
    r: linearizeChannel(rgb.r / 255),
    g: linearizeChannel(rgb.g / 255),
    b: linearizeChannel(rgb.b / 255),
  };
}

/**
 * Converts linear-light RGB back to 8-bit gamma-encoded sRGB.
 *
 * @param linear Channels in 0–1.
 * @returns Channels in 0–255, rounded and clamped (out-of-gamut values are
 * clipped, which is lossy — check for clipping separately if it matters).
 */
export function linearToRgb(linear: LinearRGB): RGB {
  const encode = (value: number) =>
    Math.round(Math.min(255, Math.max(0, delinearizeChannel(value) * 255)));
  return { r: encode(linear.r), g: encode(linear.g), b: encode(linear.b) };
}

/**
 * Relative luminance Y of an sRGB color (WCAG / Rec. 709 weights).
 *
 * Formula: Y = 0.2126·R_lin + 0.7152·G_lin + 0.0722·B_lin
 *
 * @returns Luminance in 0–1, where 1 is diffuse white.
 * Note: this is *luminance*, not L* lightness — it is linear in light, so a
 * mid-gray (#808080) lands near 0.216, not 0.5.
 */
export function relativeLuminance(rgb: RGB): number {
  const { r, g, b } = rgbToLinear(rgb);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
