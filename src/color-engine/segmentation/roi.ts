import type { RGB } from "../types";

/**
 * Region of interest selection.
 *
 * Analysing every pixel is wrong for a color scanner: the frame is mostly
 * background. The ROI is what the user aimed at — the reticle area — and this
 * module extracts it and reports how uniform it actually was, which downstream
 * confidence depends on.
 */

export type Region = { x: number; y: number; width: number; height: number };

export type RoiResult = {
  /** Extracted RGBA pixels of the region. */
  rgba: Uint8Array;
  /** Region geometry within the source image. */
  region: Region;
  /** Convenience: pixel count of the region. */
  pixelCount: number;
};

/**
 * Centered square ROI covering a fraction of the smaller image side.
 *
 * @param fraction Side length as a fraction of min(width, height), 0–1.
 * Default 0.4, matching the on-screen reticle. Keeping the two in sync is a
 * correctness requirement, not a detail: the user must be measuring what the
 * viewfinder says they are measuring.
 * @returns The extracted region; never empty (a 1×1 minimum is enforced).
 */
export function centerRoi(
  rgba: Uint8Array,
  width: number,
  height: number,
  fraction = 0.4,
): RoiResult {
  if (width <= 0 || height <= 0) throw new Error("Invalid image dimensions");
  if (rgba.length < width * height * 4) throw new Error("Pixel buffer too small for dimensions");

  const side = Math.max(1, Math.round(Math.min(width, height) * fraction));
  const region: Region = {
    x: Math.floor((width - side) / 2),
    y: Math.floor((height - side) / 2),
    width: side,
    height: side,
  };

  return { rgba: extractRegion(rgba, width, region), region, pixelCount: side * side };
}

/**
 * Square ROI centred on an arbitrary point — the tap-to-color case.
 *
 * @param centerX Horizontal position as a fraction of width, 0–1.
 * @param centerY Vertical position as a fraction of height, 0–1.
 * @param fraction Side length as a fraction of the smaller image side.
 * @returns The region, clamped so it always stays fully inside the image even
 * when the user taps near an edge — a partially out-of-bounds region would
 * silently sample garbage.
 */
export function regionAt(
  rgba: Uint8Array,
  width: number,
  height: number,
  centerX: number,
  centerY: number,
  fraction = 0.15,
): RoiResult {
  if (width <= 0 || height <= 0) throw new Error("Invalid image dimensions");
  if (rgba.length < width * height * 4) throw new Error("Pixel buffer too small for dimensions");

  const side = Math.max(1, Math.round(Math.min(width, height) * fraction));
  const rawX = Math.round(centerX * width - side / 2);
  const rawY = Math.round(centerY * height - side / 2);

  const region: Region = {
    x: Math.max(0, Math.min(width - side, rawX)),
    y: Math.max(0, Math.min(height - side, rawY)),
    width: Math.min(side, width),
    height: Math.min(side, height),
  };

  return {
    rgba: extractRegion(rgba, width, region),
    region,
    pixelCount: region.width * region.height,
  };
}

/** Extracts an arbitrary rectangular region as a new RGBA buffer. */
export function extractRegion(rgba: Uint8Array, imageWidth: number, region: Region): Uint8Array {
  const out = new Uint8Array(region.width * region.height * 4);
  let cursor = 0;
  for (let y = region.y; y < region.y + region.height; y++) {
    for (let x = region.x; x < region.x + region.width; x++) {
      const source = (y * imageWidth + x) * 4;
      out[cursor++] = rgba[source];
      out[cursor++] = rgba[source + 1];
      out[cursor++] = rgba[source + 2];
      out[cursor++] = rgba[source + 3];
    }
  }
  return out;
}

/**
 * Extracts everything *outside* a region — the surround.
 *
 * This exists for illuminant estimation, and the reason is a correctness one:
 * estimating the light from a frame that includes the patch being measured is
 * circular. The patch pulls the scene average toward its own color, the
 * estimator reads that as a cast, and the correction then pushes the measured
 * color away from the truth. The surround is the evidence about the light; the
 * patch is the unknown, and must be kept out of its own correction.
 *
 * @returns RGBA of all pixels outside `region`, or an empty buffer if the
 * region covers the whole image.
 */
export function expandRegion(region: Region, factor: number, width: number, height: number): Region {
  const newWidth = Math.min(width, Math.round(region.width * factor));
  const newHeight = Math.min(height, Math.round(region.height * factor));
  const centerX = region.x + region.width / 2;
  const centerY = region.y + region.height / 2;

  return {
    x: Math.max(0, Math.min(width - newWidth, Math.round(centerX - newWidth / 2))),
    y: Math.max(0, Math.min(height - newHeight, Math.round(centerY - newHeight / 2))),
    width: newWidth,
    height: newHeight,
  };
}

export function extractSurround(
  rgba: Uint8Array,
  width: number,
  height: number,
  region: Region,
): Uint8Array {
  const out: number[] = [];
  for (let y = 0; y < height; y++) {
    const insideRows = y >= region.y && y < region.y + region.height;
    for (let x = 0; x < width; x++) {
      if (insideRows && x >= region.x && x < region.x + region.width) continue;
      const source = (y * width + x) * 4;
      out.push(rgba[source], rgba[source + 1], rgba[source + 2], rgba[source + 3]);
    }
  }
  return Uint8Array.from(out);
}

/** Converts an RGBA buffer into RGB triples, dropping transparent pixels. */
export function toRgbSamples(rgba: Uint8Array, alphaThreshold = 128): RGB[] {
  const samples: RGB[] = [];
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3] < alphaThreshold) continue;
    samples.push({ r: rgba[i], g: rgba[i + 1], b: rgba[i + 2] });
  }
  return samples;
}
