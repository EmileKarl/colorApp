import { rgbToLab } from "../color-spaces/lab";
import { deltaE2000 } from "../metrics/deltaE2000";
import { deltaE76 } from "../metrics/deltaE76";
import { GRAPHIC_ARTS, deltaE94 } from "../metrics/deltaE94";
import type { Lab } from "../types";

const lab = (L: number, a: number, b: number): Lab => ({ L, a, b });

/**
 * Supplementary test data from Sharma, Wu & Dalal (2005), "The CIEDE2000
 * Color-Difference Formula: Implementation Notes, Supplementary Test Data, and
 * Mathematical Observations". These 34 pairs are specifically chosen to hit
 * the discontinuities and edge cases where implementations typically break —
 * the 0°/360° hue wrap, near-neutral colors, and the blue rotation region.
 */
const SHARMA_PAIRS: [Lab, Lab, number][] = [
  [lab(50.0, 2.6772, -79.7751), lab(50.0, 0.0, -82.7485), 2.0425],
  [lab(50.0, 3.1571, -77.2803), lab(50.0, 0.0, -82.7485), 2.8615],
  [lab(50.0, 2.8361, -74.02), lab(50.0, 0.0, -82.7485), 3.4412],
  [lab(50.0, -1.3802, -84.2814), lab(50.0, 0.0, -82.7485), 1.0],
  [lab(50.0, -1.1848, -84.8006), lab(50.0, 0.0, -82.7485), 1.0],
  [lab(50.0, -0.9009, -85.5211), lab(50.0, 0.0, -82.7485), 1.0],
  [lab(50.0, 0.0, 0.0), lab(50.0, -1.0, 2.0), 2.3669],
  [lab(50.0, -1.0, 2.0), lab(50.0, 0.0, 0.0), 2.3669],
  [lab(50.0, 2.49, -0.001), lab(50.0, -2.49, 0.0009), 7.1792],
  [lab(50.0, 2.49, -0.001), lab(50.0, -2.49, 0.001), 7.1792],
  [lab(50.0, 2.49, -0.001), lab(50.0, -2.49, 0.0011), 7.2195],
  [lab(50.0, 2.49, -0.001), lab(50.0, -2.49, 0.0012), 7.2195],
  [lab(50.0, -0.001, 2.49), lab(50.0, 0.0009, -2.49), 4.8045],
  [lab(50.0, -0.001, 2.49), lab(50.0, 0.001, -2.49), 4.8045],
  [lab(50.0, -0.001, 2.49), lab(50.0, 0.0011, -2.49), 4.7461],
  [lab(50.0, 2.5, 0.0), lab(50.0, 0.0, -2.5), 4.3065],
  [lab(50.0, 2.5, 0.0), lab(73.0, 25.0, -18.0), 27.1492],
  [lab(50.0, 2.5, 0.0), lab(61.0, -5.0, 29.0), 22.8977],
  [lab(50.0, 2.5, 0.0), lab(56.0, -27.0, -3.0), 31.903],
  [lab(50.0, 2.5, 0.0), lab(58.0, 24.0, 15.0), 19.4535],
  [lab(50.0, 2.5, 0.0), lab(50.0, 3.1736, 0.5854), 1.0],
  [lab(50.0, 2.5, 0.0), lab(50.0, 3.2972, 0.0), 1.0],
  [lab(50.0, 2.5, 0.0), lab(50.0, 1.8634, 0.5757), 1.0],
  [lab(50.0, 2.5, 0.0), lab(50.0, 3.2592, 0.335), 1.0],
  [lab(60.2574, -34.0099, 36.2677), lab(60.4626, -34.1751, 39.4387), 1.2644],
  [lab(63.0109, -31.0961, -5.8663), lab(62.8187, -29.7946, -4.0864), 1.263],
  [lab(61.2901, 3.7196, -5.3901), lab(61.4292, 2.248, -4.962), 1.8731],
  [lab(35.0831, -44.1164, 3.7933), lab(35.0232, -40.0716, 1.5901), 1.8645],
  [lab(22.7233, 20.0904, -46.694), lab(23.0331, 14.973, -42.5619), 2.0373],
  [lab(36.4612, 47.858, 18.3852), lab(36.2715, 50.5065, 21.2231), 1.4146],
  [lab(90.8027, -2.0831, 1.441), lab(91.1528, -1.6435, 0.0447), 1.4441],
  [lab(90.9257, -0.5406, -0.9208), lab(88.6381, -0.8985, -0.7239), 1.5381],
  [lab(6.7747, -0.2908, -2.4247), lab(5.8714, -0.0985, -2.2286), 0.6377],
  [lab(2.0776, 0.0795, -1.135), lab(0.9033, -0.0636, -0.5514), 0.9082],
];

describe("deltaE2000 — Sharma, Wu & Dalal reference data", () => {
  it.each(SHARMA_PAIRS)(
    "pair %#: matches the published ΔE00 of %p vs %p",
    (c1, c2, expected) => {
      expect(deltaE2000(c1, c2)).toBeCloseTo(expected, 4);
    },
  );

  it("is symmetric across all reference pairs", () => {
    for (const [c1, c2] of SHARMA_PAIRS) {
      expect(deltaE2000(c1, c2)).toBeCloseTo(deltaE2000(c2, c1), 10);
    }
  });

  it("returns exactly 0 for identical colors", () => {
    for (const [c1] of SHARMA_PAIRS) {
      expect(deltaE2000(c1, c1)).toBeCloseTo(0, 10);
    }
  });
});

describe("deltaE2000 — behavior the engine depends on", () => {
  it("handles the 0°/360° hue wrap without a discontinuity", () => {
    // Two colors straddling the red hue boundary must read as close, not far.
    const justBelow = lab(50, 10, -0.5);
    const justAbove = lab(50, 10, 0.5);
    expect(deltaE2000(justBelow, justAbove)).toBeLessThan(1.5);
  });

  it("rates a lightness-only change lower than CIE76 does for saturated colors", () => {
    // The chroma weighting is the whole point: a shadow on a saturated color
    // should not read as a different color.
    const bright = rgbToLab({ r: 200, g: 30, b: 30 });
    const shadowed = rgbToLab({ r: 160, g: 24, b: 24 });
    expect(deltaE2000(bright, shadowed)).toBeLessThan(deltaE76(bright, shadowed));
  });

  it("stays below 1 for colors one 8-bit step apart", () => {
    const a = rgbToLab({ r: 128, g: 128, b: 128 });
    const b = rgbToLab({ r: 129, g: 128, b: 128 });
    expect(deltaE2000(a, b)).toBeLessThan(1);
  });
});

describe("deltaE76", () => {
  it("is the Euclidean distance in Lab", () => {
    expect(deltaE76(lab(50, 0, 0), lab(53, 4, 0))).toBeCloseTo(5, 10);
  });

  it("is symmetric and zero for identical colors", () => {
    expect(deltaE76(lab(10, 20, 30), lab(40, 50, 60))).toBeCloseTo(
      deltaE76(lab(40, 50, 60), lab(10, 20, 30)),
      10,
    );
    expect(deltaE76(lab(10, 20, 30), lab(10, 20, 30))).toBe(0);
  });
});

describe("deltaE94", () => {
  it("reduces to the lightness difference for two neutrals", () => {
    // With C₁ = 0 the chroma/hue denominators are 1, so ΔE94 = |ΔL|.
    expect(deltaE94(lab(50, 0, 0), lab(60, 0, 0))).toBeCloseTo(10, 10);
  });

  it("down-weights chroma differences as reference chroma grows", () => {
    const lowChroma = deltaE94(lab(50, 5, 0), lab(50, 10, 0));
    const highChroma = deltaE94(lab(50, 60, 0), lab(50, 65, 0));
    expect(highChroma).toBeLessThan(lowChroma);
  });

  it("is asymmetric by design, since S_C and S_H use the reference chroma", () => {
    const forward = deltaE94(lab(50, 2, 0), lab(50, 60, 0));
    const backward = deltaE94(lab(50, 60, 0), lab(50, 2, 0));
    expect(forward).not.toBeCloseTo(backward, 3);
  });

  it("accepts alternative weighting factors", () => {
    const graphic = deltaE94(lab(50, 0, 0), lab(60, 0, 0), GRAPHIC_ARTS);
    const textiles = deltaE94(lab(50, 0, 0), lab(60, 0, 0), { kL: 2, K1: 0.048, K2: 0.014 });
    expect(textiles).toBeCloseTo(graphic / 2, 10);
  });
});
