import type { Lab } from "../types";

/**
 * CIE76 color difference — plain Euclidean distance in Lab.
 *
 * Formula: ΔE*ab = √((ΔL*)² + (Δa*)² + (Δb*)²)
 *
 * @returns Difference in ΔE units (0 = identical). Roughly, 1 ΔE is the
 * classic "just noticeable difference", though CIE76 overstates differences
 * in saturated colors badly.
 *
 * Assumptions: both colors share the same reference white point.
 * Limits: CIE76 is *not* perceptually uniform for saturated colors — it can
 * report a large difference between two blues a human would call identical.
 * It is kept for reference and speed; {@link deltaE2000} is what the engine
 * actually decides with.
 */
export function deltaE76(c1: Lab, c2: Lab): number {
  const dL = c1.L - c2.L;
  const da = c1.a - c2.a;
  const db = c1.b - c2.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}
