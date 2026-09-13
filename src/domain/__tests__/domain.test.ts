import { labToLch, rgbToLab } from "../../color-engine/color-spaces/lab";
import { deltaE2000 } from "../../color-engine/metrics/deltaE2000";
import { hueDistance } from "../../color-engine/color-spaces/hsv";
import {
  COLOR_VISION_LABELS,
  findPaletteAccessibilityIssues,
  simulateAll,
  simulateColorVision,
} from "../colorVision";
import { compareColors, rankByCloseness } from "../compare";
import {
  accessibleAccent,
  checkContrast,
  contrastRatio,
  prefersLightText,
  readableTextColor,
} from "../contrast";
import { ALL_HARMONY_SCHEMES, generateHarmony } from "../harmony";
import {
  ALL_PALETTE_STYLES,
  PALETTE_SIZES,
  buildPalette,
  formatPalette,
  generatePalette,
  minimumSeparation,
} from "../palette";
import { extractPhotoPalette } from "../photoPalette";
import type { RGB } from "../../color-engine/types";

const BASE: RGB = { r: 196, g: 122, b: 82 }; // terracotta, the spec's example
const WHITE: RGB = { r: 255, g: 255, b: 255 };
const BLACK: RGB = { r: 0, g: 0, b: 0 };

describe("harmony engine", () => {
  it("produces every scheme without throwing or returning empty", () => {
    for (const scheme of ALL_HARMONY_SCHEMES) {
      const result = generateHarmony(BASE, scheme, 5);
      expect(result.colors.length).toBeGreaterThanOrEqual(2);
      expect(result.label.length).toBeGreaterThan(0);
      expect(result.rationale.length).toBeGreaterThan(0);
    }
  });

  it("keeps every generated color inside the sRGB gamut", () => {
    for (const scheme of ALL_HARMONY_SCHEMES) {
      for (const color of generateHarmony(BASE, scheme, 8).colors) {
        for (const channel of [color.r, color.g, color.b]) {
          expect(channel).toBeGreaterThanOrEqual(0);
          expect(channel).toBeLessThanOrEqual(255);
          expect(Number.isInteger(channel)).toBe(true);
        }
      }
    }
  });

  it("places the complementary color opposite on the hue wheel", () => {
    const [base, complement] = generateHarmony(BASE, "complementary").colors;
    const baseHue = labToLch(rgbToLab(base)).h;
    const complementHue = labToLch(rgbToLab(complement)).h;
    // Gamut clamping can shift the hue slightly; 180° ± 12 is the honest bar.
    expect(Math.abs(hueDistance(baseHue, complementHue) - 180)).toBeLessThan(12);
  });

  it("spaces triadic colors roughly 120° apart", () => {
    const [a, b, c] = generateHarmony(BASE, "triadic").colors;
    const hues = [a, b, c].map((color) => labToLch(rgbToLab(color)).h);
    expect(Math.abs(hueDistance(hues[0], hues[1]) - 120)).toBeLessThan(15);
    expect(Math.abs(hueDistance(hues[0], hues[2]) - 120)).toBeLessThan(15);
  });

  it("holds hue constant across a monochromatic ramp", () => {
    const colors = generateHarmony(BASE, "monochromatic", 5).colors;
    const hues = colors
      .map((color) => labToLch(rgbToLab(color)))
      .filter((lch) => lch.C > 4) // hue is meaningless once chroma vanishes
      .map((lch) => lch.h);
    for (const hue of hues) {
      expect(hueDistance(hue, hues[0])).toBeLessThan(20);
    }
  });

  it("varies lightness monotonically in a monochromatic ramp", () => {
    const lightness = generateHarmony(BASE, "monochromatic", 6).colors.map(
      (color) => rgbToLab(color).L,
    );
    for (let i = 1; i < lightness.length; i++) {
      expect(lightness[i]).toBeGreaterThan(lightness[i - 1]);
    }
  });

  it("makes pastels lighter and less colorful than vibrants", () => {
    const pastel = generateHarmony(BASE, "pastel", 5).colors.map((c) => labToLch(rgbToLab(c)));
    const vibrant = generateHarmony(BASE, "vibrant", 5).colors.map((c) => labToLch(rgbToLab(c)));

    const meanL = (list: { L: number }[]) => list.reduce((a, c) => a + c.L, 0) / list.length;
    const meanC = (list: { C: number }[]) => list.reduce((a, c) => a + c.C, 0) / list.length;

    expect(meanL(pastel)).toBeGreaterThan(meanL(vibrant));
    expect(meanC(pastel)).toBeLessThan(meanC(vibrant));
  });

  it("keeps neutral schemes genuinely low-chroma", () => {
    for (const color of generateHarmony(BASE, "neutral", 5).colors) {
      expect(labToLch(rgbToLab(color)).C).toBeLessThan(14);
    }
  });

  it("is deterministic", () => {
    expect(generateHarmony(BASE, "tetradic", 5)).toEqual(generateHarmony(BASE, "tetradic", 5));
  });

  it("handles a pure neutral base without producing NaN", () => {
    for (const scheme of ALL_HARMONY_SCHEMES) {
      for (const color of generateHarmony({ r: 128, g: 128, b: 128 }, scheme, 5).colors) {
        expect(Number.isFinite(color.r)).toBe(true);
        expect(Number.isFinite(color.g)).toBe(true);
        expect(Number.isFinite(color.b)).toBe(true);
      }
    }
  });
});

describe("WCAG contrast", () => {
  it("matches the known black-on-white maximum of 21:1", () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 1);
  });

  it("returns 1:1 for identical colors", () => {
    expect(contrastRatio(BASE, BASE)).toBeCloseTo(1, 6);
  });

  it("is symmetric", () => {
    expect(contrastRatio(BASE, WHITE)).toBeCloseTo(contrastRatio(WHITE, BASE), 10);
  });

  it("applies the documented WCAG thresholds", () => {
    const strong = checkContrast(BLACK, WHITE);
    expect(strong.normalText).toBe("AAA");
    expect(strong.readable).toBe(true);

    // Mid-gray on white is ~3.9:1 — passes large text, fails body text.
    const marginal = checkContrast({ r: 130, g: 130, b: 130 }, WHITE);
    expect(marginal.ratio).toBeGreaterThan(3);
    expect(marginal.ratio).toBeLessThan(4.5);
    expect(marginal.normalText).toBe("fail");
    expect(marginal.largeText).toBe("AA");
  });

  it("picks the text color that actually reads best", () => {
    expect(readableTextColor(WHITE)).toEqual(BLACK);
    expect(readableTextColor(BLACK)).toEqual(WHITE);
    expect(prefersLightText({ r: 20, g: 20, b: 80 })).toBe(true);
    expect(prefersLightText({ r: 250, g: 240, b: 200 })).toBe(false);
  });

  it("always returns a readable text color for any background", () => {
    // The color-adaptive UI depends on this holding universally.
    for (let r = 0; r <= 255; r += 51) {
      for (let g = 0; g <= 255; g += 51) {
        for (let b = 0; b <= 255; b += 51) {
          const background = { r, g, b };
          const ratio = contrastRatio(readableTextColor(background), background);
          expect(ratio).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
  });

  it("adjusts a failing accent until it passes, keeping it recognisable", () => {
    // A light yellow on white fails badly; the fix must darken it, not discard it.
    const accent: RGB = { r: 250, g: 230, b: 90 };
    const result = accessibleAccent(accent, WHITE);
    expect(result.meets).toBe(true);
    expect(result.ratio).toBeGreaterThanOrEqual(4.5);
    // Hue should survive the adjustment.
    const before = labToLch(rgbToLab(accent));
    const after = labToLch(rgbToLab(result.color));
    expect(hueDistance(before.h, after.h)).toBeLessThan(30);
  });

  it("returns an already-passing accent untouched", () => {
    const result = accessibleAccent({ r: 20, g: 40, b: 90 }, WHITE);
    expect(result.meets).toBe(true);
    expect(result.color).toEqual({ r: 20, g: 40, b: 90 });
  });
});

describe("color vision simulation", () => {
  it("leaves colors unchanged for normal vision", () => {
    expect(simulateColorVision(BASE, "normal")).toEqual(BASE);
  });

  it("maps white to white and black to black under every deficiency", () => {
    // Each simulation matrix has rows summing to 1, so neutrals must survive.
    // This catches a mistyped constant immediately.
    for (const type of ["protanopia", "deuteranopia", "tritanopia", "achromatopsia"] as const) {
      const white = simulateColorVision(WHITE, type);
      expect(white.r).toBeGreaterThanOrEqual(253);
      expect(white.g).toBeGreaterThanOrEqual(253);
      expect(white.b).toBeGreaterThanOrEqual(253);
      expect(simulateColorVision(BLACK, type)).toEqual(BLACK);
    }
  });

  it("produces a true gray for achromatopsia", () => {
    const gray = simulateColorVision({ r: 200, g: 60, b: 40 }, "achromatopsia");
    expect(gray.r).toBe(gray.g);
    expect(gray.g).toBe(gray.b);
  });

  it("preserves perceived lightness when removing color", () => {
    // A luminance-correct grayscale keeps L* nearly intact; a naive channel
    // average would not.
    const source: RGB = { r: 30, g: 180, b: 60 };
    const gray = simulateColorVision(source, "achromatopsia");
    expect(Math.abs(rgbToLab(gray).L - rgbToLab(source).L)).toBeLessThan(2);
  });

  it("shifts red far more than blue under protanopia", () => {
    const redShift = deltaE2000(
      rgbToLab({ r: 220, g: 30, b: 30 }),
      rgbToLab(simulateColorVision({ r: 220, g: 30, b: 30 }, "protanopia")),
    );
    const blueShift = deltaE2000(
      rgbToLab({ r: 30, g: 30, b: 220 }),
      rgbToLab(simulateColorVision({ r: 30, g: 30, b: 220 }, "protanopia")),
    );
    expect(redShift).toBeGreaterThan(blueShift);
  });

  it("reports a shift figure for each deficiency", () => {
    const comparisons = simulateAll({ r: 200, g: 60, b: 60 });
    expect(comparisons).toHaveLength(4);
    for (const comparison of comparisons) {
      expect(comparison.label).toBe(COLOR_VISION_LABELS[comparison.type]);
      expect(comparison.shift).toBeGreaterThanOrEqual(0);
    }
  });

  it("flags a red/green pair that collapses for deuteranopes", () => {
    // The canonical failure case: red and green of similar lightness.
    const issues = findPaletteAccessibilityIssues([
      { r: 190, g: 70, b: 70 },
      { r: 110, g: 140, b: 60 },
    ]);
    expect(issues.some((issue) => issue.type === "deuteranopia")).toBe(true);
  });

  it("reports no issues for a palette separated by lightness", () => {
    // Lightness differences survive every deficiency, which is exactly the
    // advice the app should give designers.
    const issues = findPaletteAccessibilityIssues([
      { r: 15, g: 15, b: 15 },
      { r: 128, g: 128, b: 128 },
      { r: 245, g: 245, b: 245 },
    ]);
    expect(issues).toEqual([]);
  });
});

describe("palette generation", () => {
  it("produces the requested size for every style and size", () => {
    for (const style of ALL_PALETTE_STYLES) {
      for (const size of PALETTE_SIZES) {
        const palette = generatePalette(BASE, style, size);
        expect(palette.swatches).toHaveLength(size);
      }
    }
  });

  it("gives every swatch a readable text color", () => {
    for (const style of ALL_PALETTE_STYLES) {
      for (const swatch of generatePalette(BASE, style, 8).swatches) {
        expect(swatch.textContrast).toBeGreaterThanOrEqual(4.5);
        expect(swatch.hex).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it("reports how distinguishable the palette is", () => {
    const palette = generatePalette(BASE, "bold", 5);
    expect(palette.minSeparation).toBeGreaterThan(0);
    expect(Number.isFinite(palette.minSeparation)).toBe(true);
  });

  it("computes minimum separation correctly", () => {
    expect(minimumSeparation([BASE])).toBe(Infinity);
    expect(minimumSeparation([BASE, BASE])).toBeCloseTo(0, 5);
    expect(minimumSeparation([BLACK, WHITE])).toBeGreaterThan(50);
  });

  it("surfaces accessibility issues rather than hiding them", () => {
    const risky = buildPalette([
      { r: 190, g: 70, b: 70 },
      { r: 110, g: 140, b: 60 },
    ]);
    expect(risky.accessibilityIssues.length).toBeGreaterThan(0);
  });

  it("formats palettes in every requested notation", () => {
    const palette = generatePalette(BASE, "minimal", 3);
    expect(formatPalette(palette, "hex")).toMatch(/^#[0-9A-F]{6}/);
    expect(formatPalette(palette, "rgb")).toMatch(/^rgb\(\d+, \d+, \d+\)/);
    expect(formatPalette(palette, "lab")).toMatch(/^lab\(/);
    expect(formatPalette(palette, "hsl").split("\n")).toHaveLength(3);
  });

  it("is deterministic", () => {
    expect(generatePalette(BASE, "luxury", 5)).toEqual(generatePalette(BASE, "luxury", 5));
  });
});

describe("photo to palette", () => {
  /** Builds an RGBA buffer from colors with explicit pixel counts. */
  function image(parts: { color: RGB; pixels: number }[]): Uint8Array {
    const total = parts.reduce((acc, part) => acc + part.pixels, 0);
    const rgba = new Uint8Array(total * 4);
    let offset = 0;
    for (const part of parts) {
      for (let i = 0; i < part.pixels; i++) {
        rgba[offset++] = part.color.r;
        rgba[offset++] = part.color.g;
        rgba[offset++] = part.color.b;
        rgba[offset++] = 255;
      }
    }
    return rgba;
  }

  it("recovers the real proportions of a synthetic image", () => {
    // 60% blue, 30% orange, 10% cream — the proportions must be measured.
    const rgba = image([
      { color: { r: 40, g: 70, b: 160 }, pixels: 600 },
      { color: { r: 220, g: 130, b: 40 }, pixels: 300 },
      { color: { r: 245, g: 240, b: 225 }, pixels: 100 },
    ]);

    const { palette } = extractPhotoPalette(rgba);
    const proportions = palette.swatches.map((s) => s.proportion ?? 0);

    expect(proportions[0]).toBeCloseTo(0.6, 1);
    expect(proportions[1]).toBeCloseTo(0.3, 1);
    expect(proportions.slice(0, 3).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 1);
  });

  it("marks the largest cluster as dominant", () => {
    const rgba = image([
      { color: { r: 40, g: 70, b: 160 }, pixels: 800 },
      { color: { r: 220, g: 130, b: 40 }, pixels: 200 },
    ]);
    const { palette } = extractPhotoPalette(rgba);
    expect(palette.swatches[0].role).toBe("dominant");
  });

  it("assigns distinct roles without duplicating them", () => {
    const rgba = image([
      { color: { r: 40, g: 70, b: 160 }, pixels: 400 },
      { color: { r: 230, g: 60, b: 60 }, pixels: 250 },
      { color: { r: 245, g: 245, b: 240 }, pixels: 200 },
      { color: { r: 20, g: 20, b: 22 }, pixels: 100 },
      { color: { r: 128, g: 126, b: 124 }, pixels: 50 },
    ]);
    const roles = extractPhotoPalette(rgba).palette.swatches.map((s) => s.role);
    const unique = new Set(roles.filter((role) => role !== "secondary"));
    expect(unique.size).toBe(roles.filter((role) => role !== "secondary").length);
    expect(roles[0]).toBe("dominant");
  });

  it("merges near-identical clusters instead of listing them twice", () => {
    const rgba = image([
      { color: { r: 100, g: 100, b: 200 }, pixels: 400 },
      { color: { r: 101, g: 101, b: 201 }, pixels: 400 },
      { color: { r: 220, g: 120, b: 40 }, pixels: 200 },
    ]);
    const { palette } = extractPhotoPalette(rgba);
    // The two blues are the same color to a viewer; the palette must say so.
    expect(palette.swatches.length).toBeLessThanOrEqual(2);
    expect(palette.swatches[0].proportion).toBeCloseTo(0.8, 1);
  });

  it("is deterministic for the same image", () => {
    const rgba = image([
      { color: { r: 40, g: 70, b: 160 }, pixels: 300 },
      { color: { r: 220, g: 130, b: 40 }, pixels: 300 },
    ]);
    expect(extractPhotoPalette(rgba)).toEqual(extractPhotoPalette(rgba));
  });

  it("rejects an image with no opaque pixels", () => {
    expect(() => extractPhotoPalette(new Uint8Array(40))).toThrow(/no opaque pixels/i);
  });
});

describe("color comparison", () => {
  it("reports identical colors as identical with zero difference", () => {
    const result = compareColors(BASE, BASE);
    expect(result.deltaE2000).toBe(0);
    expect(result.verdict).toBe("identical");
  });

  it("separates a lightness-only difference from a hue difference", () => {
    const lighter = compareColors({ r: 100, g: 100, b: 100 }, { r: 160, g: 160, b: 160 });
    expect(lighter.lightnessDelta).toBeGreaterThan(0);
    expect(lighter.hueDelta).toBe(0); // neutrals have no meaningful hue
    expect(lighter.summary).toMatch(/luminosité/);

    const hueShift = compareColors({ r: 200, g: 60, b: 60 }, { r: 60, g: 60, b: 200 });
    expect(hueShift.hueDelta).toBeGreaterThan(60);
    expect(hueShift.summary).toMatch(/teinte/);
  });

  it("detects a saturation-only difference", () => {
    const result = compareColors({ r: 200, g: 60, b: 60 }, { r: 150, g: 110, b: 110 });
    expect(result.chromaDelta).toBeLessThan(0);
    expect(result.summary).toMatch(/saturation/);
  });

  it("grades similarity in perceptual bands", () => {
    expect(compareColors({ r: 128, g: 128, b: 128 }, { r: 129, g: 128, b: 128 }).verdict).toBe(
      "imperceptible",
    );
    expect(compareColors(BLACK, WHITE).verdict).toBe("very_different");
  });

  it("includes contrast, since comparing often means using them together", () => {
    expect(compareColors(BLACK, WHITE).contrast.normalText).toBe("AAA");
  });

  it("ranks candidates by perceptual closeness, not RGB distance", () => {
    const candidates = [
      { id: "far", rgb: { r: 40, g: 200, b: 40 } },
      { id: "near", rgb: { r: 200, g: 126, b: 86 } },
      { id: "mid", rgb: { r: 150, g: 110, b: 90 } },
    ];
    const ranked = rankByCloseness(BASE, candidates, 2);
    expect(ranked[0].id).toBe("near");
    expect(ranked).toHaveLength(2);
    expect(ranked[0].deltaE).toBeLessThan(ranked[1].deltaE);
  });
});
