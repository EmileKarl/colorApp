/**
 * Pure pixel-math helpers for color extraction.
 *
 * Everything here operates on plain RGBA byte arrays with no React Native or
 * native-module dependency, so the actual color algorithm is unit-testable in
 * Node — unlike the native library this replaced, which could only ever be
 * verified by hand on a physical device.
 */

import type { RGB } from "./color";

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const BASE64_LOOKUP = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < BASE64_ALPHABET.length; i++) {
    table[BASE64_ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

/**
 * Decodes standard base64 to bytes without relying on `atob`/`Buffer`, neither
 * of which is guaranteed across the JS engines this app runs on.
 */
export function base64ToBytes(base64: string): Uint8Array {
  let bitBuffer = 0;
  let bitCount = 0;
  const bytes: number[] = [];

  for (let i = 0; i < base64.length; i++) {
    const code = base64.charCodeAt(i);
    if (code === 61) break; // '=' padding: nothing meaningful follows
    if (code > 127) throw new Error("Invalid base64 input");
    const value = BASE64_LOOKUP[code];
    if (value === -1) continue; // skip newlines/whitespace
    bitBuffer = (bitBuffer << 6) | value;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((bitBuffer >> bitCount) & 0xff);
    }
  }

  return Uint8Array.from(bytes);
}

/**
 * Keeps only the centered square covering `fraction` of the smaller side.
 *
 * The scan UI puts a reticle in the middle of the frame, so the color the user
 * is actually aiming at lives here — averaging the whole frame would drag the
 * result toward the background.
 */
export function cropCenter(
  rgba: Uint8Array,
  width: number,
  height: number,
  fraction = 0.4,
): Uint8Array {
  if (width <= 0 || height <= 0) throw new Error("Invalid image dimensions");
  if (rgba.length < width * height * 4) throw new Error("Pixel buffer too small for dimensions");

  const side = Math.max(1, Math.round(Math.min(width, height) * fraction));
  const startX = Math.floor((width - side) / 2);
  const startY = Math.floor((height - side) / 2);

  const out = new Uint8Array(side * side * 4);
  let cursor = 0;
  for (let y = startY; y < startY + side; y++) {
    for (let x = startX; x < startX + side; x++) {
      const source = (y * width + x) * 4;
      out[cursor++] = rgba[source];
      out[cursor++] = rgba[source + 1];
      out[cursor++] = rgba[source + 2];
      out[cursor++] = rgba[source + 3];
    }
  }
  return out;
}

/** Coarse bin size per channel when grouping similar pixels together. */
const BIN_SIZE = 24;

/**
 * Picks the color a human would say the patch "is".
 *
 * A plain average is easily skewed by a specular highlight or a shadow edge, so
 * this groups pixels into coarse bins, takes the most populated bin, and then
 * averages the exact values inside only that bin — robust to outliers while
 * still returning a precise value rather than a rounded bin center.
 */
export function dominantColor(rgba: Uint8Array): RGB {
  if (rgba.length < 4) throw new Error("No pixels to analyse");

  const sums = new Map<number, { r: number; g: number; b: number; count: number }>();

  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < 128) continue; // ignore transparent pixels
    const r = rgba[i];
    const g = rgba[i + 1];
    const b = rgba[i + 2];
    const key =
      Math.floor(r / BIN_SIZE) * 10000 + Math.floor(g / BIN_SIZE) * 100 + Math.floor(b / BIN_SIZE);

    const bin = sums.get(key);
    if (bin) {
      bin.r += r;
      bin.g += g;
      bin.b += b;
      bin.count += 1;
    } else {
      sums.set(key, { r, g, b, count: 1 });
    }
  }

  let best: { r: number; g: number; b: number; count: number } | null = null;
  for (const bin of sums.values()) {
    if (!best || bin.count > best.count) best = bin;
  }
  if (!best) throw new Error("No opaque pixels to analyse");

  return {
    r: Math.round(best.r / best.count),
    g: Math.round(best.g / best.count),
    b: Math.round(best.b / best.count),
  };
}
