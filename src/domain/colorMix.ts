import { labToRgb, rgbToLab } from "../color-engine/color-spaces/lab";
import { hexToLch, lchToHex } from "../objects/renderer/shading";
import { hexToRgb, rgbToHex } from "../lib/color";

/**
 * Color Lab operations — ColorLens page 8.
 *
 * Mixing, lightening, saturating: the arithmetic a creative tool needs, all of
 * it deterministic (§8).
 */

/**
 * Mixes two colors, in CIELAB.
 *
 * **Not in sRGB.** Averaging sRGB channels is the single most common color
 * mistake in software: halfway between pure blue (#0000ff) and pure yellow
 * (#ffff00) it yields a muddy grey, because sRGB values are gamma-encoded and
 * their arithmetic mean is not the perceptual midpoint. Lab is built so that
 * equal steps look equal, which is exactly what a mix slider promises.
 *
 * @param ratio 0 returns `a`, 1 returns `b`, 0.5 the perceptual midpoint.
 */
export function mixColors(a: string, b: string, ratio: number): string {
  const t = Math.min(1, Math.max(0, ratio));
  const from = rgbToLab(hexToRgb(a));
  const to = rgbToLab(hexToRgb(b));
  return rgbToHex(
    labToRgb({
      L: from.L + (to.L - from.L) * t,
      a: from.a + (to.a - from.a) * t,
      b: from.b + (to.b - from.b) * t,
    }),
  );
}

/** Lightens (positive) or darkens (negative) by a number of L* points. */
export function adjustLightness(hex: string, amount: number): string {
  const lch = hexToLch(hex);
  return lchToHex({ ...lch, L: lch.L + amount });
}

/** Saturates (positive) or desaturates (negative) by a number of C* points. */
export function adjustChroma(hex: string, amount: number): string {
  const lch = hexToLch(hex);
  return lchToHex({ ...lch, C: lch.C + amount });
}

/** Rotates the hue, in degrees. */
export function rotateHue(hex: string, degrees: number): string {
  const lch = hexToLch(hex);
  return lchToHex({ ...lch, h: lch.h + degrees });
}

/**
 * A ramp from dark to light through a color, for a tonal scale.
 *
 * Chroma is reduced at both ends rather than held constant: sRGB simply cannot
 * hold high chroma at extreme lightness, so a naive ramp flattens into
 * identical near-black and near-white steps. Tapering keeps every step
 * distinct.
 */
export function tonalRamp(hex: string, steps = 9): string[] {
  const lch = hexToLch(hex);
  const result: string[] = [];
  for (let index = 0; index < steps; index++) {
    const position = steps === 1 ? 0.5 : index / (steps - 1);
    const L = 8 + position * 84;
    // Peaks at the middle of the ramp, tapers toward both extremes.
    const taper = 1 - Math.abs(position - 0.5) * 1.4;
    result.push(lchToHex({ L, C: lch.C * Math.max(0.15, taper), h: lch.h }));
  }
  return result;
}

/**
 * A random but usable color — the "Surprise me" of page 8.
 *
 * Generated in LCh rather than by three random bytes. Random RGB produces
 * muddy mid-tones most of the time, because the cube's volume is concentrated
 * away from the saturated edges; sampling lightness and chroma in perceptual
 * space gives colors a person would actually pick.
 *
 * @param random Injectable so the result can be tested deterministically.
 */
export function surpriseColor(random: () => number = Math.random): string {
  const hue = random() * 360;
  // Mid-range lightness and real chroma: the band where colors read as colors.
  const L = 32 + random() * 46;
  const C = 28 + random() * 52;
  return lchToHex({ L, C, h: hue });
}

export type MixEntry = { a: string; b: string; ratio: number; result: string };

/**
 * Records a mix, newest first, without consecutive duplicates.
 *
 * Dragging the ratio slider produces a continuous stream of results; without
 * this the history would fill with forty near-identical entries from one drag
 * and be useless as a way back to an earlier idea.
 */
export function pushMix(history: MixEntry[], entry: MixEntry, max = 12): MixEntry[] {
  if (history[0]?.result === entry.result) return history;
  return [entry, ...history.filter((item) => item.result !== entry.result)].slice(0, max);
}
