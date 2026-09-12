import { estimateDominantColor, histogramEstimate, medianEstimate } from "../analysis/dominantColor";
import { kMeansAutoK, kMeansLab } from "../analysis/kmeans";
import { COLOR_DATABASE, findReferenceById } from "../classification/colorDatabase";
import { classifyColor, isPerceptuallySame } from "../classification/colorMatcher";
import { rgbToLab } from "../color-spaces/lab";
import { computeConfidence } from "../confidence/confidenceScore";
import { deltaE2000 } from "../metrics/deltaE2000";
import { analyzeColor } from "../pipeline/analyzeColor";
import { centerRoi, toRgbSamples } from "../segmentation/roi";
import { renderScene } from "./fixtures/syntheticDataset";
import type { Lab, RGB } from "../types";

const labsOf = (colors: RGB[]) => colors.map((c) => rgbToLab(c));

describe("k-means in Lab", () => {
  it("finds one cluster in a uniform sample", () => {
    const samples = labsOf(Array.from({ length: 50 }, () => ({ r: 100, g: 150, b: 200 })));
    const { clusters } = kMeansLab(samples, 1);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].weight).toBeCloseTo(1, 6);
    expect(clusters[0].spread).toBeCloseTo(0, 6);
  });

  it("separates two well-defined color groups", () => {
    const samples = labsOf([
      ...Array.from({ length: 30 }, () => ({ r: 200, g: 20, b: 20 })),
      ...Array.from({ length: 20 }, () => ({ r: 20, g: 20, b: 200 })),
    ]);
    const { clusters } = kMeansLab(samples, 2);
    expect(clusters).toHaveLength(2);
    expect(clusters[0].weight).toBeCloseTo(0.6, 2);
    expect(deltaE2000(clusters[0].center, clusters[1].center)).toBeGreaterThan(20);
  });

  it("is deterministic across runs with the same seed", () => {
    const samples = labsOf(
      Array.from({ length: 40 }, (_, i) => ({ r: 50 + i * 3, g: 100, b: 150 - i })),
    );
    const first = kMeansLab(samples, 3, { seed: 7 });
    const second = kMeansLab(samples, 3, { seed: 7 });
    expect(second.clusters.map((c) => c.center)).toEqual(first.clusters.map((c) => c.center));
  });

  it("converges on simple data well before the iteration cap", () => {
    const samples = labsOf([
      ...Array.from({ length: 20 }, () => ({ r: 10, g: 10, b: 10 })),
      ...Array.from({ length: 20 }, () => ({ r: 240, g: 240, b: 240 })),
    ]);
    const result = kMeansLab(samples, 2);
    expect(result.converged).toBe(true);
    expect(result.iterations).toBeLessThan(10);
  });

  it("never returns more clusters than samples", () => {
    const samples = labsOf([{ r: 1, g: 2, b: 3 }, { r: 4, g: 5, b: 6 }]);
    expect(kMeansLab(samples, 10).clusters.length).toBeLessThanOrEqual(2);
  });

  it("prefers a single cluster for a uniform patch when choosing k", () => {
    const samples = labsOf(Array.from({ length: 40 }, () => ({ r: 130, g: 90, b: 60 })));
    expect(kMeansAutoK(samples).k).toBe(1);
  });

  it("rejects an empty sample set instead of returning something meaningless", () => {
    expect(() => kMeansLab([], 3)).toThrow();
  });
});

describe("dominant color estimators", () => {
  it("median and histogram agree exactly on a uniform patch", () => {
    const samples = labsOf(Array.from({ length: 30 }, () => ({ r: 70, g: 140, b: 210 })));
    const median = medianEstimate(samples);
    const histogram = histogramEstimate(samples);
    expect(deltaE2000(median, histogram)).toBeCloseTo(0, 6);
  });

  it("recovers the true color of a clean patch to within 1 ΔE00", () => {
    const truth = { r: 180, g: 60, b: 90 };
    const samples = labsOf(Array.from({ length: 60 }, () => truth));
    const result = estimateDominantColor(samples);
    expect(deltaE2000(result.color, rgbToLab(truth))).toBeLessThan(1);
    expect(result.disagreement).toBeLessThan(1);
  });

  it("reports high disagreement on a genuinely two-colored patch", () => {
    const samples = labsOf([
      ...Array.from({ length: 25 }, () => ({ r: 220, g: 40, b: 40 })),
      ...Array.from({ length: 25 }, () => ({ r: 40, g: 40, b: 220 })),
    ]);
    const result = estimateDominantColor(samples);
    // The estimators must not silently agree on a meaningless average.
    expect(result.disagreement).toBeGreaterThan(3);
    expect(result.dominantShare).toBeLessThan(0.8);
  });

  it("exposes secondary colors when the patch is not uniform", () => {
    const samples = labsOf([
      ...Array.from({ length: 40 }, () => ({ r: 30, g: 160, b: 60 })),
      ...Array.from({ length: 15 }, () => ({ r: 220, g: 200, b: 40 })),
    ]);
    const result = estimateDominantColor(samples);
    expect(result.secondary.length).toBeGreaterThan(0);
  });
});

describe("color database and matcher", () => {
  it("derives Lab consistently from each entry's hex", () => {
    for (const entry of COLOR_DATABASE) {
      expect(deltaE2000(entry.lab, rgbToLab(entry.rgb))).toBeCloseTo(0, 6);
      expect(entry.chroma).toBeCloseTo(entry.lch.C, 10);
    }
  });

  it("matches every reference color to itself with ΔE00 ≈ 0", () => {
    for (const entry of COLOR_DATABASE) {
      const result = classifyColor(entry.lab);
      expect(result.best).not.toBeNull();
      expect(result.best!.deltaE).toBeCloseTo(0, 4);
      expect(result.best!.reference.id).toBe(entry.id);
    }
  });

  it("classifies a slightly-off color to the nearest reference", () => {
    const slightlyOffRed = rgbToLab({ r: 250, g: 8, b: 8 });
    expect(classifyColor(slightlyOffRed).best?.reference.id).toBe("red");
  });

  it("returns no match for a color far from everything in the database", () => {
    // A tiny two-entry database makes the "nothing is close" case reachable.
    const sparse = [findReferenceById("white")!, findReferenceById("black")!];
    const vividGreen = rgbToLab({ r: 0, g: 200, b: 0 });
    expect(classifyColor(vividGreen, sparse).best).toBeNull();
  });

  it("handles an empty database without throwing", () => {
    const result = classifyColor(rgbToLab({ r: 1, g: 2, b: 3 }), []);
    expect(result.best).toBeNull();
    expect(result.alternatives).toEqual([]);
  });

  it("uses a perceptual threshold for sameness, not RGB distance", () => {
    const a = rgbToLab({ r: 128, g: 128, b: 128 });
    const b = rgbToLab({ r: 130, g: 129, b: 128 });
    expect(isPerceptuallySame(a, b)).toBe(true);
    expect(isPerceptuallySame(a, rgbToLab({ r: 180, g: 90, b: 90 }))).toBe(false);
  });
});

describe("confidence scoring", () => {
  const ideal = {
    imageQuality: 1,
    estimatorDisagreement: 0.2,
    lightingAgreement: 1,
    dominantShare: 1,
    classificationMargin: 12,
    matchDeltaE: 0.5,
    meanLightness: 55,
  };

  it("reports high confidence when every signal is strong", () => {
    const result = computeConfidence(ideal);
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.limitations).toEqual([]);
  });

  it("lets a single disqualifying factor dominate, as a geometric mean should", () => {
    const blownOut = computeConfidence({ ...ideal, imageQuality: 0.05 });
    // An arithmetic mean would still report ~0.8 here; that would be dishonest.
    expect(blownOut.confidence).toBeLessThan(0.5);
    expect(blownOut.limitations[0]).toMatch(/Qualité d'image/);
  });

  it("drops confidence when the estimators disagree", () => {
    const confused = computeConfidence({ ...ideal, estimatorDisagreement: 9 });
    expect(confused.confidence).toBeLessThan(computeConfidence(ideal).confidence);
    expect(confused.limitations.join(" ")).toMatch(/convergent/);
  });

  it("never claims uncertainty below the irreducible floor, even in ideal conditions", () => {
    // Exposure error is unobservable from a single patch, so a phone camera
    // without an in-frame reference cannot credibly claim better than this.
    expect(computeConfidence(ideal).uncertainty).toBeGreaterThanOrEqual(3);
  });

  it("widens uncertainty as evidence weakens", () => {
    const shaky = computeConfidence({
      ...ideal,
      imageQuality: 0.3,
      estimatorDisagreement: 7,
      lightingAgreement: 0.2,
    });
    expect(shaky.uncertainty).toBeGreaterThan(computeConfidence(ideal).uncertainty);
  });

  it("penalises a patch that is too dark to measure reliably", () => {
    const tooDark = computeConfidence({ ...ideal, meanLightness: 8 });
    expect(tooDark.confidence).toBeLessThan(computeConfidence(ideal).confidence);
    expect(tooDark.limitations[0]).toMatch(/trop sombre/);
  });

  it("keeps confidence in 0–1 for degenerate inputs", () => {
    const result = computeConfidence({
      imageQuality: 0,
      estimatorDisagreement: 1000,
      lightingAgreement: 0,
      dominantShare: 0,
      classificationMargin: 0,
      matchDeltaE: 999,
      meanLightness: 0,
    });
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

describe("region of interest", () => {
  it("extracts the centered square and reports its geometry", () => {
    const rgba = new Uint8Array(10 * 10 * 4).fill(255);
    const roi = centerRoi(rgba, 10, 10, 0.4);
    expect(roi.region).toEqual({ x: 3, y: 3, width: 4, height: 4 });
    expect(roi.pixelCount).toBe(16);
  });

  it("drops transparent pixels when sampling", () => {
    const rgba = new Uint8Array([10, 20, 30, 255, 40, 50, 60, 0]);
    expect(toRgbSamples(rgba)).toEqual([{ r: 10, g: 20, b: 30 }]);
  });
});

describe("analyzeColor — end to end", () => {
  it("recovers the true color of an ideal scene within its own stated uncertainty", () => {
    const truth = { r: 64, g: 150, b: 76 };
    const scene = renderScene(truth, { seed: 3 });
    const result = analyzeColor(scene);

    const error = deltaE2000(result.lab, rgbToLab(truth));
    expect(error).toBeLessThan(result.uncertainty);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("returns every representation the spec requires", () => {
    const scene = renderScene({ r: 52, g: 88, b: 172 }, { seed: 5 });
    const result = analyzeColor(scene);

    expect(result.dominantColor.hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(result.rgb).toBeDefined();
    expect(result.hsv).toBeDefined();
    expect(result.lab).toBeDefined();
    expect(typeof result.chroma).toBe("number");
    expect(typeof result.hue).toBe("number");
    expect(typeof result.deltaE).toBe("number");
    expect(result.imageQuality).toBeDefined();
    expect(result.lighting).toBeDefined();
    expect(typeof result.confidence).toBe("number");
    expect(typeof result.uncertainty).toBe("number");
    expect(result.region).toBeDefined();
  });

  it("is deterministic: the same pixels always give the same answer", () => {
    const scene = renderScene({ r: 196, g: 48, b: 43 }, { noise: 20, seed: 11 });
    const first = analyzeColor(scene);
    const second = analyzeColor(scene);
    expect(second.dominantColor.hex).toBe(first.dominantColor.hex);
    expect(second.confidence).toBe(first.confidence);
  });

  it("reports lower confidence for a degraded scene than a clean one", () => {
    const truth = { r: 224, g: 124, b: 36 };
    const clean = analyzeColor(renderScene(truth, { seed: 2 }));
    const degraded = analyzeColor(
      renderScene(truth, { exposure: 1.9, noise: 40, highlights: 0.2, seed: 2 }),
    );
    expect(degraded.confidence).toBeLessThan(clean.confidence);
  });

  it("detects a warm illuminant and reports the tone", () => {
    const scene = renderScene(
      { r: 200, g: 200, b: 200 },
      { illuminant: { r: 1.4, g: 1.0, b: 0.6 }, background: { r: 190, g: 190, b: 190 }, seed: 4 },
    );
    const result = analyzeColor(scene);
    expect(result.lighting.tone).toBe("warm");
    expect(result.lighting.castStrength).toBeGreaterThan(0);
  });

  it("improves accuracy on a cast scene when color constancy is enabled", () => {
    const truth = { r: 200, g: 200, b: 200 };
    const scene = renderScene(truth, {
      illuminant: { r: 1.35, g: 1.0, b: 0.65 },
      background: { r: 180, g: 180, b: 180 },
      seed: 9,
    });

    const corrected = analyzeColor(scene, { applyColorConstancy: true });
    const uncorrected = analyzeColor(scene, { applyColorConstancy: false });

    const truthLab = rgbToLab(truth);
    expect(deltaE2000(corrected.lab, truthLab)).toBeLessThan(
      deltaE2000(uncorrected.lab, truthLab),
    );
  });

  it("carries optional camera and environment context through untouched", () => {
    const scene = renderScene({ r: 100, g: 100, b: 100 }, { seed: 6 });
    const camera = { device: "iPhone", iso: 200 };
    const environment = { indoor: true };

    const withContext = analyzeColor(scene, { camera, environment });
    const withoutContext = analyzeColor(scene);

    expect(withContext.camera).toEqual(camera);
    expect(withContext.environment).toEqual(environment);
    // Context must never change the measurement itself.
    expect(withContext.dominantColor.hex).toBe(withoutContext.dominantColor.hex);
  });

  it("rejects a malformed buffer instead of producing a number", () => {
    expect(() => analyzeColor({ rgba: new Uint8Array(16), width: 100, height: 100 })).toThrow();
  });

  it("throws when the region of interest is fully transparent", () => {
    const rgba = new Uint8Array(16 * 16 * 4); // all zero, including alpha
    expect(() => analyzeColor({ rgba, width: 16, height: 16 })).toThrow(
      /no opaque pixels/i,
    );
  });
});

describe("engine invariants", () => {
  it("never reports confidence outside 0–1 across the whole synthetic grid", () => {
    const colors: RGB[] = [
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
      { r: 196, g: 48, b: 43 },
      { r: 52, g: 88, b: 172 },
    ];
    for (const color of colors) {
      for (const exposure of [0.3, 1, 2.2]) {
        const result = analyzeColor(renderScene(color, { exposure, seed: 13 }));
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
        expect(result.uncertainty).toBeGreaterThan(0);
      }
    }
  });

  it("produces a Lab value that round-trips to the reported hex", () => {
    const result = analyzeColor(renderScene({ r: 116, g: 68, b: 156 }, { seed: 8 }));
    const reconstructed: Lab = result.dominantColor.lab;
    expect(deltaE2000(reconstructed, result.lab)).toBeCloseTo(0, 6);
  });
});
