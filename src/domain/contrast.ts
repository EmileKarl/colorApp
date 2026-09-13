import { relativeLuminance } from "../color-engine/color-spaces/srgb";
import type { RGB } from "../color-engine/types";

/**
 * WCAG 2.1 contrast.
 *
 * Deliberately separate from the perceptual ΔE machinery: contrast answers
 * "can this be read?", ΔE answers "do these look like the same color?". They
 * are different questions with different formulas, and conflating them is a
 * common and consequential mistake — two colors can be perceptually far apart
 * (large ΔE) yet fail contrast badly, because contrast depends only on
 * luminance.
 */

export type WcagLevel = "AAA" | "AA" | "fail";

export type ContrastUse = "normal_text" | "large_text" | "ui_component";

export type ContrastResult = {
  /** Contrast ratio, 1:1 (identical) to 21:1 (black on white). */
  ratio: number;
  normalText: WcagLevel;
  largeText: WcagLevel;
  uiComponent: WcagLevel;
  /** True when the pair is usable for body text. */
  readable: boolean;
};

/**
 * WCAG 2.1 contrast ratio.
 *
 * Formula: (L_lighter + 0.05) / (L_darker + 0.05), where L is relative
 * luminance. The 0.05 offset models ambient screen flare, which is why a pure
 * black/white pair tops out at 21 rather than infinity.
 *
 * @returns Ratio in 1–21. Symmetric: order of arguments does not matter.
 * Limits: WCAG 2.x contrast is known to under-serve dark backgrounds and
 * saturated hues; it is nevertheless the legally referenced standard, so it is
 * what this app reports.
 */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG thresholds per use case. */
const THRESHOLDS: Record<ContrastUse, { AA: number; AAA: number }> = {
  // Body text, below 18pt (or 14pt bold).
  normal_text: { AA: 4.5, AAA: 7 },
  // 18pt+, or 14pt+ bold.
  large_text: { AA: 3, AAA: 4.5 },
  // Icons, borders, focus rings. WCAG defines no AAA level here; 4.5 is used
  // as a stricter internal bar so the UI can still flag "comfortably passing".
  ui_component: { AA: 3, AAA: 4.5 },
};

function levelFor(ratio: number, use: ContrastUse): WcagLevel {
  const { AA, AAA } = THRESHOLDS[use];
  if (ratio >= AAA) return "AAA";
  if (ratio >= AA) return "AA";
  return "fail";
}

/** Full contrast verdict for a foreground/background pair. */
export function checkContrast(foreground: RGB, background: RGB): ContrastResult {
  const ratio = contrastRatio(foreground, background);
  return {
    ratio: Math.round(ratio * 100) / 100,
    normalText: levelFor(ratio, "normal_text"),
    largeText: levelFor(ratio, "large_text"),
    uiComponent: levelFor(ratio, "ui_component"),
    readable: ratio >= THRESHOLDS.normal_text.AA,
  };
}

const BLACK: RGB = { r: 0, g: 0, b: 0 };
const WHITE: RGB = { r: 255, g: 255, b: 255 };

/**
 * Picks black or white text for a given background, whichever reads better.
 *
 * This is what makes the color-adaptive UI of spec §5 safe: an accent color
 * can be applied anywhere, and the text on top is chosen by measurement rather
 * than by a guess about whether the color "looks dark".
 *
 * @returns Pure black or pure white — the two extremes maximise available
 * contrast, and anything in between would only reduce it.
 */
export function readableTextColor(background: RGB): RGB {
  return contrastRatio(BLACK, background) >= contrastRatio(WHITE, background) ? BLACK : WHITE;
}

/** True when white text reads better than black on this background. */
export function prefersLightText(background: RGB): boolean {
  return contrastRatio(WHITE, background) > contrastRatio(BLACK, background);
}

/**
 * Finds the closest usable version of an accent color against a background.
 *
 * Rather than rejecting an accent that fails contrast, this walks its lightness
 * until it passes — keeping the hue the user scanned, which is the point of a
 * color-adaptive interface, while guaranteeing legibility.
 *
 * @param accent The color the user wants to use.
 * @param background What it will sit on.
 * @param use Which WCAG threshold must be met.
 * @returns An adjusted accent meeting the threshold, or the best attempt if
 * even pure black/white cannot reach it (possible only for extreme
 * backgrounds), alongside whether the target was actually met.
 */
export function accessibleAccent(
  accent: RGB,
  background: RGB,
  use: ContrastUse = "normal_text",
): { color: RGB; ratio: number; meets: boolean } {
  const target = THRESHOLDS[use].AA;
  const initial = contrastRatio(accent, background);
  if (initial >= target) {
    return { color: accent, ratio: Math.round(initial * 100) / 100, meets: true };
  }

  // Walk toward whichever extreme has more contrast headroom.
  const towardWhite = prefersLightText(background);
  let best = { color: accent, ratio: initial };

  for (let step = 1; step <= 20; step++) {
    const t = step / 20;
    const candidate: RGB = {
      r: mix(accent.r, towardWhite ? 255 : 0, t),
      g: mix(accent.g, towardWhite ? 255 : 0, t),
      b: mix(accent.b, towardWhite ? 255 : 0, t),
    };
    const ratio = contrastRatio(candidate, background);
    if (ratio > best.ratio) best = { color: candidate, ratio };
    if (ratio >= target) {
      return { color: candidate, ratio: Math.round(ratio * 100) / 100, meets: true };
    }
  }

  return { color: best.color, ratio: Math.round(best.ratio * 100) / 100, meets: false };
}

function mix(from: number, to: number, t: number): number {
  return Math.round(from + (to - from) * t);
}
