/**
 * Pure color conversion and classification utilities.
 * No React Native / device dependency here on purpose: this module must be
 * unit-testable in plain Node/Jest without a simulator or physical device.
 */

export type RGB = { r: number; g: number; b: number };
export type HSL = { h: number; s: number; l: number };

export type ColorFamily =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "cyan"
  | "blue"
  | "purple"
  | "pink"
  | "brown"
  | "gray"
  | "black"
  | "white";

export const ALL_COLOR_FAMILIES: ColorFamily[] = [
  "red",
  "orange",
  "yellow",
  "green",
  "cyan",
  "blue",
  "purple",
  "pink",
  "brown",
  "gray",
  "black",
  "white",
];

/** French display labels for each family — the raw family id is English/snake-case only. */
export const FAMILY_LABEL_FR: Record<ColorFamily, string> = {
  red: "Rouge",
  orange: "Orange",
  yellow: "Jaune",
  green: "Vert",
  cyan: "Cyan",
  blue: "Bleu",
  purple: "Violet",
  pink: "Rose",
  brown: "Brun",
  gray: "Gris",
  black: "Noir",
  white: "Blanc",
};

const HEX_RE = /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

export function isValidHex(hex: string): boolean {
  return HEX_RE.test(hex.trim());
}

/** Normalizes any accepted hex form ("#fff", "fff", "#ffffff") to "#rrggbb" lowercase. */
export function normalizeHex(hex: string): string {
  const trimmed = hex.trim().replace(/^#/, "");
  if (trimmed.length === 3) {
    const expanded = trimmed
      .split("")
      .map((c) => c + c)
      .join("");
    return `#${expanded.toLowerCase()}`;
  }
  return `#${trimmed.toLowerCase()}`;
}

export function hexToRgb(hex: string): RGB {
  if (!isValidHex(hex)) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const normalized = normalizeHex(hex).slice(1);
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return { r, g, b };
}

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

export function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (n: number) => clampByte(n).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rn) {
      h = ((gn - bn) / delta) % 6;
    } else if (max === gn) {
      h = (bn - rn) / delta + 2;
    } else {
      h = (rn - gn) / delta + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hslToRgb({ h, s, l }: HSL): RGB {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;

  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];

  return {
    r: clampByte((rp + m) * 255),
    g: clampByte((gp + m) * 255),
    b: clampByte((bp + m) * 255),
  };
}

/**
 * Coarse family classification from hue/saturation/lightness. This is a
 * heuristic for grouping/browsing, not a colorimetric standard.
 */
export function getColorFamily(rgb: RGB): ColorFamily {
  const { h, s, l } = rgbToHsl(rgb);

  if (l >= 97) return "white";
  if (l <= 6) return "black";
  if (s <= 8) return "gray";

  if (h < 15) return s < 40 && l < 45 ? "brown" : "red";
  if (h < 45) return l < 45 && s > 30 ? "brown" : "orange";
  if (h < 65) return "yellow";
  if (h < 170) return "green";
  if (h < 200) return "cyan";
  if (h < 255) return "blue";
  if (h < 290) return "purple";
  if (h < 330) return "pink";
  return "red";
}

/** Euclidean distance in RGB space — cheap and good enough for "nearest named color". */
export function colorDistance(a: RGB, b: RGB): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

export type NamedColor = { name: string; hex: string; family: ColorFamily };

/**
 * Finds the closest entry in a candidate list (curated dictionary and/or
 * community-submitted names fetched from Supabase) to the given color.
 * Returns null for an empty candidate list.
 */
export function nearestNamedColor(
  hex: string,
  candidates: NamedColor[],
): NamedColor | null {
  if (candidates.length === 0) return null;
  const target = hexToRgb(hex);
  let best = candidates[0];
  let bestDistance = colorDistance(target, hexToRgb(best.hex));
  for (const candidate of candidates.slice(1)) {
    const distance = colorDistance(target, hexToRgb(candidate.hex));
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Two colors are treated as "the same community color" below this distance,
 * used to decide whether a scan matches an existing entry or should be
 * proposed as new (see docs/PRODUCT_DISCOVERY.md §31 community flow).
 */
export const SAME_COLOR_THRESHOLD = 12;

export function isSameColor(a: string, b: string): boolean {
  return colorDistance(hexToRgb(a), hexToRgb(b)) <= SAME_COLOR_THRESHOLD;
}

/** Deterministic short id derived from a normalized hex, used before a DB id exists. */
export function colorLocalId(hex: string): string {
  return normalizeHex(hex).slice(1);
}

function rotateHue(hex: string, degrees: number): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  const h = ((hsl.h + degrees) % 360 + 360) % 360;
  return rgbToHex(hslToRgb({ ...hsl, h }));
}

/** The color directly opposite on the hue wheel (180°) — the classic "contrast" pairing. */
export function getComplementary(hex: string): string {
  return rotateHue(hex, 180);
}

/** The two neighboring hues (±30°) that read as harmonious alongside the source color. */
export function getAnalogous(hex: string): [string, string] {
  return [rotateHue(hex, -30), rotateHue(hex, 30)];
}

/** The two other points of an evenly-spaced triangle on the hue wheel (±120°). */
export function getTriadic(hex: string): [string, string] {
  return [rotateHue(hex, 120), rotateHue(hex, 240)];
}
