import { rgbToLab } from "../color-spaces/lab";
import { getColorFamily } from "../../lib/color";
import { deltaE2000 } from "../metrics/deltaE2000";
import { analyzeColor } from "../pipeline/analyzeColor";
import { percentile } from "../segmentation/outliers";
import { buildSyntheticDataset } from "./fixtures/syntheticDataset";

/**
 * Benchmark over the synthetic dataset.
 *
 * Reports the metrics the spec asks for — mean / median / 95th-percentile
 * ΔE₀₀, classification accuracy, and confidence calibration — and asserts
 * regression thresholds set just above the *currently measured* values.
 *
 * Read the numbers for what they are: performance against a simulated camera.
 * They prove the math behaves and catch regressions. They are NOT a claim about
 * real-world accuracy, which requires the physical ColorChecker protocol
 * described in docs/COLOR_ENGINE.md.
 */

type CaseResult = {
  name: string;
  condition: string;
  deltaE: number;
  familyCorrect: boolean;
  confidence: number;
  uncertainty: number;
  withinUncertainty: boolean;
};

function runBenchmark(): CaseResult[] {
  return buildSyntheticDataset().map((testCase) => {
    const result = analyzeColor(testCase);
    const truthLab = rgbToLab(testCase.truth);
    const error = deltaE2000(result.lab, truthLab);

    return {
      name: testCase.name,
      condition: testCase.name.split("/")[1],
      deltaE: error,
      familyCorrect: getColorFamily(result.rgb) === getColorFamily(testCase.truth),
      confidence: result.confidence,
      uncertainty: result.uncertainty,
      withinUncertainty: error <= result.uncertainty,
    };
  });
}

const mean = (values: number[]) => values.reduce((acc, v) => acc + v, 0) / values.length;

describe("color engine benchmark (synthetic dataset)", () => {
  const results = runBenchmark();
  const deltaEs = results.map((r) => r.deltaE);

  it("prints the benchmark report", () => {
    const byCondition = new Map<string, number[]>();
    for (const result of results) {
      const bucket = byCondition.get(result.condition) ?? [];
      bucket.push(result.deltaE);
      byCondition.set(result.condition, bucket);
    }

    const lines = [
      "",
      "=== COLOR ENGINE BENCHMARK (synthetic) ===",
      `cases:              ${results.length}`,
      `mean ΔE00:          ${mean(deltaEs).toFixed(2)}`,
      `median ΔE00:        ${percentile(deltaEs, 0.5).toFixed(2)}`,
      `95th pct ΔE00:      ${percentile(deltaEs, 0.95).toFixed(2)}`,
      `max ΔE00:           ${Math.max(...deltaEs).toFixed(2)}`,
      `family accuracy:    ${((results.filter((r) => r.familyCorrect).length / results.length) * 100).toFixed(1)}%`,
      `within uncertainty: ${((results.filter((r) => r.withinUncertainty).length / results.length) * 100).toFixed(1)}%`,
      `mean confidence:    ${mean(results.map((r) => r.confidence)).toFixed(2)}`,
      "",
      "--- by condition (mean / p95 ΔE00) ---",
      ...Array.from(byCondition.entries())
        .sort((a, b) => mean(a[1]) - mean(b[1]))
        .map(
          ([condition, values]) =>
            `  ${condition.padEnd(16)} ${mean(values).toFixed(2).padStart(6)} / ${percentile(values, 0.95).toFixed(2).padStart(6)}`,
        ),
      "",
    ];

     
    console.log(lines.join("\n"));
    expect(results.length).toBeGreaterThan(0);
  });

  // Thresholds sit just above the currently measured values, so any regression
  // in the math shows up as a failing test rather than a slowly worsening app.
  it("keeps mean ΔE00 within the regression threshold", () => {
    expect(mean(deltaEs)).toBeLessThan(5);
  });

  it("keeps median ΔE00 within the regression threshold", () => {
    expect(percentile(deltaEs, 0.5)).toBeLessThan(1.5);
  });

  it("keeps the 95th percentile ΔE00 within the regression threshold", () => {
    expect(percentile(deltaEs, 0.95)).toBeLessThan(18);
  });

  it("is essentially exact on ideal captures", () => {
    const ideal = results.filter((r) => r.condition === "ideal");
    expect(mean(ideal.map((r) => r.deltaE))).toBeLessThan(0.5);
  });

  it("recovers a tungsten cast to near-exactness", () => {
    // Color constancy doing its job: a heavy warm cast must almost vanish.
    const cast = results.filter((r) => r.condition === "tungsten_cast");
    expect(mean(cast.map((r) => r.deltaE))).toBeLessThan(2);
  });

  it("rejects specular highlights and shadows entirely on an otherwise clean patch", () => {
    const contaminated = results.filter(
      (r) => r.condition === "specular" || r.condition === "shadowed",
    );
    expect(mean(contaminated.map((r) => r.deltaE))).toBeLessThan(0.5);
  });

  it("classifies the color family correctly in the large majority of cases", () => {
    const accuracy = results.filter((r) => r.familyCorrect).length / results.length;
    expect(accuracy).toBeGreaterThan(0.9);
  });

  it("degrades gracefully rather than catastrophically under a color cast", () => {
    const cast = results.filter((r) => r.condition.endsWith("_cast"));
    const ideal = results.filter((r) => r.condition === "ideal");
    expect(mean(cast.map((r) => r.deltaE))).toBeGreaterThan(mean(ideal.map((r) => r.deltaE)));
    expect(mean(cast.map((r) => r.deltaE))).toBeLessThan(25);
  });

  it("assigns lower confidence where the degradation is observable", () => {
    // Calibration, restricted to error sources the engine can actually see:
    // noise, casts and non-uniformity all leave traces in the pixels.
    const clean = results.filter((r) => r.condition === "ideal");
    const observablyDegraded = results.filter((r) => r.condition === "combined");
    expect(mean(observablyDegraded.map((r) => r.confidence))).toBeLessThan(
      mean(clean.map((r) => r.confidence)),
    );
  });

  it("documents that exposure error is NOT observable from a single patch", () => {
    // This test asserts a *limitation*, deliberately. A dark surface captured
    // 1.8× too bright is pixel-for-pixel identical to a mid-tone surface
    // captured correctly, so no amount of analysis can separate them: every
    // internal signal stays high while the real error exceeds 10 ΔE00.
    //
    // Tuning the confidence weights until this reads "well calibrated" would
    // be fitting the benchmark, not fixing the engine. The honest response is
    // the IRREDUCIBLE_UNCERTAINTY floor, plus the ColorChecker calibration
    // protocol which makes exposure observable by putting a surface of known
    // reflectance in the frame.
    const exposureShifted = results.filter(
      (r) => r.condition === "underexposed" || r.condition === "overexposed",
    );
    const meanError = mean(exposureShifted.map((r) => r.deltaE));
    const meanConfidence = mean(exposureShifted.map((r) => r.confidence));

    expect(meanError).toBeGreaterThan(5); // the error is real and large
    expect(meanConfidence).toBeGreaterThan(0.4); // yet the engine cannot see it
  });

  it("keeps the true color inside the stated uncertainty most of the time", () => {
    const covered = results.filter((r) => r.withinUncertainty).length / results.length;
    expect(covered).toBeGreaterThan(0.6);
  });
});
