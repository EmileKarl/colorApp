import type { HSV, RGB } from "../types";

/**
 * HSV (hue, saturation, value).
 *
 * HSV is a cheap re-parameterization of the RGB cube, *not* a perceptual space.
 * The engine uses it only for what it is genuinely good at — coarse hue-family
 * bucketing and detecting near-neutral or clipped pixels — and never as the
 * final word on what a color is. Lab handles perceptual questions.
 */

/**
 * Converts 8-bit sRGB to HSV.
 *
 * Formulas, with R,G,B normalized to 0–1, M = max, m = min, C = M − m:
 *   V = M
 *   S = C / M          (0 when M = 0)
 *   H = 60° · ((G−B)/C mod 6)     if M = R
 *       60° · ((B−R)/C + 2)       if M = G
 *       60° · ((R−G)/C + 4)       if M = B
 *
 * @param rgb Channels in 0–255.
 * @returns h in degrees 0–360, s and v in 0–1.
 * Limits: hue is undefined for grays (C = 0) and is returned as 0. Saturation
 * becomes numerically unstable for very dark colors, where a tiny change in a
 * channel swings S wildly — always weight it against V before trusting it.
 */
export function rgbToHsv(rgb: RGB): HSV {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;

  let h = 0;
  if (chroma > 0) {
    if (max === r) h = 60 * (((g - b) / chroma) % 6);
    else if (max === g) h = 60 * ((b - r) / chroma + 2);
    else h = 60 * ((r - g) / chroma + 4);
    if (h < 0) h += 360;
  }

  return { h, s: max === 0 ? 0 : chroma / max, v: max };
}

/** Inverse of {@link rgbToHsv}. */
export function hsvToRgb(hsv: HSV): RGB {
  const chroma = hsv.v * hsv.s;
  const hPrime = ((hsv.h % 360) + 360) % 360 / 60;
  const x = chroma * (1 - Math.abs((hPrime % 2) - 1));
  const m = hsv.v - chroma;

  let rgb: [number, number, number];
  if (hPrime < 1) rgb = [chroma, x, 0];
  else if (hPrime < 2) rgb = [x, chroma, 0];
  else if (hPrime < 3) rgb = [0, chroma, x];
  else if (hPrime < 4) rgb = [0, x, chroma];
  else if (hPrime < 5) rgb = [x, 0, chroma];
  else rgb = [chroma, 0, x];

  const encode = (value: number) => Math.round(Math.min(255, Math.max(0, (value + m) * 255)));
  return { r: encode(rgb[0]), g: encode(rgb[1]), b: encode(rgb[2]) };
}

/**
 * Shortest angular distance between two hue angles.
 *
 * Hue is circular: 350° and 10° are 20° apart, not 340°. Forgetting this is a
 * classic bug when averaging or comparing hues near the red wrap-around.
 *
 * @returns Distance in degrees, 0–180.
 */
export function hueDistance(h1: number, h2: number): number {
  const diff = Math.abs(((h1 % 360) + 360) % 360 - (((h2 % 360) + 360) % 360));
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Circular mean of hue angles, weighted equally.
 *
 * Formula: h̄ = atan2(Σ sin hᵢ, Σ cos hᵢ)
 *
 * A plain arithmetic mean of 350° and 10° gives 180° (cyan) instead of 0°
 * (red); summing unit vectors avoids that entirely.
 *
 * @returns Mean hue in degrees 0–360, or 0 if the vectors cancel out (which
 * means the hues are spread evenly and no mean is meaningful).
 */
export function meanHue(hues: number[]): number {
  if (hues.length === 0) return 0;
  let sumSin = 0;
  let sumCos = 0;
  for (const h of hues) {
    const radians = (h * Math.PI) / 180;
    sumSin += Math.sin(radians);
    sumCos += Math.cos(radians);
  }
  if (Math.abs(sumSin) < 1e-12 && Math.abs(sumCos) < 1e-12) return 0;
  const mean = (Math.atan2(sumSin, sumCos) * 180) / Math.PI;
  return (mean + 360) % 360;
}
