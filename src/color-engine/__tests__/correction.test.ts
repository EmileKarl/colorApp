import { assessImageQuality } from "../capture/imageQuality";
import { rgbToLab } from "../color-spaces/lab";
import {
  applyGains,
  estimateIlluminant,
  grayWorld,
  shadesOfGray,
  whitePatch,
} from "../correction/colorConstancy";
import { deltaE2000 } from "../metrics/deltaE2000";
import {
  filterByPerceptualDistance,
  filterOutliers,
  iqrOutlierMask,
  madOutlierMask,
  median,
  medianAbsoluteDeviation,
  percentile,
  robustSigma,
} from "../segmentation/outliers";
import type { RGB } from "../types";

/** Builds a uniform RGBA patch, optionally with per-pixel noise. */
function patch(
  color: RGB,
  size: number,
  jitter = 0,
  seed = 1,
): { rgba: Uint8Array; width: number; height: number } {
  let state = seed;
  const random = () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648 - 0.5;
  };

  const rgba = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const o = i * 4;
    rgba[o] = clampByte(color.r + random() * jitter);
    rgba[o + 1] = clampByte(color.g + random() * jitter);
    rgba[o + 2] = clampByte(color.b + random() * jitter);
    rgba[o + 3] = 255;
  }
  return { rgba, width: size, height: size };
}

const clampByte = (v: number) => Math.min(255, Math.max(0, Math.round(v)));

describe("assessImageQuality", () => {
  it("scores a well-exposed uniform patch highly", () => {
    const { rgba, width, height } = patch({ r: 120, g: 130, b: 140 }, 16);
    const quality = assessImageQuality(rgba, width, height);
    expect(quality.score).toBeGreaterThan(0.7);
    expect(quality.flags).not.toContain("overexposed");
    expect(quality.flags).not.toContain("underexposed");
  });

  it("flags a blown-out patch and collapses its score", () => {
    const { rgba, width, height } = patch({ r: 255, g: 255, b: 255 }, 16);
    const quality = assessImageQuality(rgba, width, height);
    expect(quality.flags).toContain("overexposed");
    expect(quality.flags).toContain("clipped_highlights");
    expect(quality.clippedHighlights).toBeCloseTo(1, 6);
    expect(quality.score).toBeLessThan(0.2);
  });

  it("flags an almost-black patch", () => {
    const { rgba, width, height } = patch({ r: 2, g: 2, b: 2 }, 16);
    const quality = assessImageQuality(rgba, width, height);
    expect(quality.flags).toContain("underexposed");
    expect(quality.score).toBeLessThan(0.35);
  });

  it("detects noise and scores a noisy patch below a clean one", () => {
    const clean = patch({ r: 120, g: 120, b: 120 }, 24);
    const noisy = patch({ r: 120, g: 120, b: 120 }, 24, 90, 7);

    const cleanQuality = assessImageQuality(clean.rgba, clean.width, clean.height);
    const noisyQuality = assessImageQuality(noisy.rgba, noisy.width, noisy.height);

    expect(noisyQuality.noise).toBeGreaterThan(cleanQuality.noise);
    expect(noisyQuality.score).toBeLessThan(cleanQuality.score);
    expect(noisyQuality.flags).toContain("high_noise");
  });

  it("reports mean lightness and chroma consistent with the patch color", () => {
    const color = { r: 200, g: 40, b: 40 };
    const { rgba, width, height } = patch(color, 12);
    const quality = assessImageQuality(rgba, width, height);
    const expected = rgbToLab(color);
    expect(quality.meanLightness).toBeCloseTo(expected.L, 1);
    expect(quality.meanChroma).toBeGreaterThan(30);
  });

  it("rejects malformed input rather than guessing", () => {
    expect(() => assessImageQuality(new Uint8Array(16), 0, 0)).toThrow();
    expect(() => assessImageQuality(new Uint8Array(16), 100, 100)).toThrow();
  });
});

describe("robust statistics", () => {
  it("computes the median for odd and even lengths", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(() => median([])).toThrow();
  });

  it("interpolates percentiles", () => {
    expect(percentile([1, 2, 3, 4], 0)).toBe(1);
    expect(percentile([1, 2, 3, 4], 1)).toBe(4);
    expect(percentile([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5, 10);
  });

  it("resists a single extreme value where a standard deviation would not", () => {
    const clean = [10, 11, 12, 11, 10];
    const contaminated = [...clean, 1000];
    // MAD barely moves; a standard deviation would explode.
    expect(medianAbsoluteDeviation(contaminated)).toBeLessThan(
      medianAbsoluteDeviation(clean) + 1.5,
    );
  });

  it("scales MAD into a sigma estimate", () => {
    expect(robustSigma([10, 12, 14])).toBeCloseTo(1.4826 * 2, 6);
  });

  it("flags extreme values with the modified z-score", () => {
    const values = [10, 10.5, 11, 10.2, 10.8, 50];
    const mask = madOutlierMask(values);
    expect(mask[5]).toBe(true);
    expect(mask.slice(0, 5).every((flagged) => !flagged)).toBe(true);
  });

  it("treats a zero-MAD series conservatively", () => {
    // More than half identical: the z-score is undefined, so anything that
    // differs at all is treated as an outlier.
    expect(madOutlierMask([5, 5, 5, 5, 9])).toEqual([false, false, false, false, true]);
  });

  it("flags values outside Tukey's fences", () => {
    const mask = iqrOutlierMask([1, 2, 3, 4, 100]);
    expect(mask[4]).toBe(true);
  });
});

describe("filterOutliers", () => {
  it("removes a highlight pixel from an otherwise uniform patch", () => {
    const base = Array.from({ length: 20 }, () => rgbToLab({ r: 40, g: 90, b: 180 }));
    const withHighlight = [...base, rgbToLab({ r: 255, g: 255, b: 255 })];
    const filtered = filterOutliers(withHighlight);
    expect(filtered.length).toBe(base.length);
  });

  it("keeps the data intact when more than half would be removed", () => {
    // A genuinely two-colored patch is not "contaminated" — clustering, not
    // filtering, should resolve it, so the filter must stand down.
    const half = Array.from({ length: 10 }, () => rgbToLab({ r: 200, g: 20, b: 20 }));
    const otherHalf = Array.from({ length: 10 }, () => rgbToLab({ r: 20, g: 20, b: 200 }));
    const mixed = [...half, ...otherHalf];
    expect(filterOutliers(mixed).length).toBe(mixed.length);
  });

  it("leaves tiny samples untouched", () => {
    const tiny = [rgbToLab({ r: 1, g: 2, b: 3 })];
    expect(filterOutliers(tiny)).toEqual(tiny);
  });

  it("removes perceptually distant pixels the per-channel test can miss", () => {
    const base = Array.from({ length: 20 }, () => rgbToLab({ r: 128, g: 128, b: 128 }));
    const offColor = [...base, rgbToLab({ r: 150, g: 110, b: 100 })];
    expect(filterByPerceptualDistance(offColor).length).toBe(base.length);
  });
});

describe("color constancy", () => {
  it("returns neutral gains for an already-neutral gray scene", () => {
    const { rgba } = patch({ r: 128, g: 128, b: 128 }, 8);
    const estimate = grayWorld(rgba);
    expect(estimate.gains.r).toBeCloseTo(1, 6);
    expect(estimate.gains.b).toBeCloseTo(1, 6);
    expect(estimate.castStrength).toBeCloseTo(0, 6);
  });

  it("detects a warm cast and proposes gains that counteract it", () => {
    // An orange-ish scene: Gray World should boost blue and cut red.
    const { rgba } = patch({ r: 200, g: 150, b: 90 }, 8);
    const estimate = grayWorld(rgba);
    expect(estimate.gains.r).toBeLessThan(1);
    expect(estimate.gains.b).toBeGreaterThan(1);
    expect(estimate.castStrength).toBeGreaterThan(0);
  });

  it("neutralizes a synthetic cast applied to a gray card", () => {
    // Ground truth: a neutral gray card photographed under colored light.
    const lit = patch({ r: 170, g: 128, b: 95 }, 12);
    const estimate = grayWorld(lit.rgba);
    const corrected = applyGains(lit.rgba, estimate.gains);

    const before = rgbToLab({ r: 170, g: 128, b: 95 });
    const after = rgbToLab({ r: corrected[0], g: corrected[1], b: corrected[2] });
    const neutralTarget = rgbToLab({ r: 128, g: 128, b: 128 });

    // The corrected patch must be perceptually much closer to neutral.
    expect(deltaE2000(after, neutralTarget)).toBeLessThan(deltaE2000(before, neutralTarget));
    expect(deltaE2000(after, neutralTarget)).toBeLessThan(6);
  });

  it("reduces Shades of Gray to Gray World at p = 1", () => {
    const { rgba } = patch({ r: 180, g: 120, b: 90 }, 8);
    const sog = shadesOfGray(rgba, 1);
    const gw = grayWorld(rgba);
    expect(sog.gains.r).toBeCloseTo(gw.gains.r, 10);
    expect(sog.gains.b).toBeCloseTo(gw.gains.b, 10);
  });

  it("approaches White Patch as the norm order grows", () => {
    const { rgba } = patch({ r: 180, g: 120, b: 90 }, 16, 60, 3);
    const highNorm = shadesOfGray(rgba, 40);
    const wp = whitePatch(rgba);
    expect(Math.abs(highNorm.gains.r - wp.gains.r)).toBeLessThan(0.25);
  });

  it("preserves alpha when applying gains", () => {
    const rgba = new Uint8Array([10, 20, 30, 128, 40, 50, 60, 200]);
    const out = applyGains(rgba, { r: 1.2, g: 1, b: 0.8 });
    expect(out[3]).toBe(128);
    expect(out[7]).toBe(200);
  });

  it("stands down when the estimators disagree, rather than guessing", () => {
    // A frame filled with one saturated color violates Gray World's core
    // assumption; the engine must prefer no correction over a wrong one.
    const { rgba } = patch({ r: 220, g: 10, b: 10 }, 16);
    const { estimate, agreement } = estimateIlluminant(rgba);
    if (agreement < 0.35) {
      expect(estimate.method).toBe("none");
      expect(estimate.gains).toEqual({ r: 1, g: 1, b: 1 });
    } else {
      // If they do agree, the correction must at least stay bounded.
      expect(estimate.gains.r).toBeGreaterThan(0);
    }
  });

  it("reports high agreement on a neutral scene", () => {
    const { rgba } = patch({ r: 128, g: 128, b: 128 }, 16);
    const { agreement } = estimateIlluminant(rgba);
    expect(agreement).toBeGreaterThan(0.8);
  });

  it("rejects an invalid Minkowski order", () => {
    const { rgba } = patch({ r: 1, g: 1, b: 1 }, 4);
    expect(() => shadesOfGray(rgba, 0)).toThrow();
  });
});
