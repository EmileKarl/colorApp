import { kMeansLab } from "../color-engine/analysis/kmeans";
import { labToLch, labToRgb, rgbToLab } from "../color-engine/color-spaces/lab";
import { deltaE2000 } from "../color-engine/metrics/deltaE2000";
import { toRgbSamples } from "../color-engine/segmentation/roi";
import { buildPalette, type Palette, type PaletteRole } from "./palette";
import type { Lab, RGB } from "../color-engine/types";

/**
 * Photo → palette (spec §12).
 *
 * Extracts the colors that actually make up an image, with their real
 * proportions, and assigns each a role. The proportions come from cluster
 * membership — they are measured, not invented, which matters because the whole
 * point of showing "62% dominant" is that the number means something.
 */

/** How many clusters to extract before assigning roles. */
const CLUSTER_COUNT = 8;

/** Minimum share of the image for a cluster to earn a place in the palette. */
const MIN_SHARE = 0.02;

export type PhotoPaletteResult = {
  palette: Palette;
  /** Every cluster found, including those too small for the palette. */
  clusters: { rgb: RGB; share: number }[];
  /** Share of the image covered by the returned palette, 0–1. */
  coverage: number;
};

/**
 * Builds a palette from an image's pixels.
 *
 * @param rgba Interleaved RGBA bytes of the (downscaled) image.
 * @param options.maxColors Cap on palette size after role assignment.
 * @param options.seed Clustering seed; fixed by default so the same photo
 * always yields the same palette.
 * @returns The palette with per-swatch proportions, plus the raw clusters.
 * @throws If the image contains no opaque pixels.
 *
 * Limits: k-means assumes reasonably compact clusters. A photo that is one
 * smooth gradient has no natural palette, and will be split into arbitrary
 * bands — the reported proportions are still accurate, but the *roles* become
 * less meaningful.
 */
export function extractPhotoPalette(
  rgba: Uint8Array,
  options: { maxColors?: number; seed?: number } = {},
): PhotoPaletteResult {
  const { maxColors = 6, seed = 42 } = options;

  const samples = toRgbSamples(rgba);
  if (samples.length === 0) throw new Error("No opaque pixels to build a palette from");

  const labs = samples.map((rgb) => rgbToLab(rgb));
  const { clusters } = kMeansLab(labs, Math.min(CLUSTER_COUNT, labs.length), { seed });

  const all = clusters.map((cluster) => ({
    lab: cluster.center,
    rgb: labToRgb(cluster.center),
    share: cluster.weight,
  }));

  // Keep clusters that are both significant and perceptually distinct: two
  // clusters 2 ΔE00 apart are the same color to a viewer, and showing both as
  // separate palette entries would be misleading.
  const significant: typeof all = [];
  for (const candidate of all) {
    if (candidate.share < MIN_SHARE) continue;
    const duplicate = significant.find((kept) => deltaE2000(kept.lab, candidate.lab) < 5);
    if (duplicate) {
      duplicate.share += candidate.share; // merge, don't discard the pixels
      continue;
    }
    significant.push({ ...candidate });
  }

  const selected = significant.slice(0, maxColors);
  const roles = assignRoles(selected.map((entry) => entry.lab));

  const palette = buildPalette(
    selected.map((entry) => entry.rgb),
    {
      roles,
      proportions: selected.map((entry) => Math.round(entry.share * 1000) / 1000),
      description: "Palette extraite des proportions réelles de l'image.",
    },
  );

  return {
    palette,
    clusters: all.map((entry) => ({
      rgb: entry.rgb,
      share: Math.round(entry.share * 1000) / 1000,
    })),
    coverage: Math.round(selected.reduce((acc, entry) => acc + entry.share, 0) * 1000) / 1000,
  };
}

/**
 * Assigns a role to each palette color.
 *
 * Roles are decided from measurable properties rather than position: the
 * lightest entry is "light", the most colorful is "accent", the least colorful
 * is "neutral", and so on. The first (largest) cluster is always the dominant
 * one, since that is what "dominant" means.
 */
function assignRoles(labs: Lab[]): PaletteRole[] {
  const roles: PaletteRole[] = new Array(labs.length).fill("secondary");
  if (labs.length === 0) return roles;

  roles[0] = "dominant";
  if (labs.length === 1) return roles;

  const taken = new Set<number>([0]);
  const lch = labs.map((lab) => labToLch(lab));

  const claim = (index: number, role: PaletteRole) => {
    if (index >= 0 && !taken.has(index)) {
      roles[index] = role;
      taken.add(index);
    }
  };

  // Accent: the most chromatic remaining color — what draws the eye.
  claim(indexOfExtreme(lch, taken, (c) => c.C, "max"), "accent");
  // Light and dark anchors.
  claim(indexOfExtreme(lch, taken, (c) => c.L, "max"), "light");
  claim(indexOfExtreme(lch, taken, (c) => c.L, "min"), "dark");
  // Neutral: the least chromatic of what remains.
  claim(indexOfExtreme(lch, taken, (c) => c.C, "min"), "neutral");

  // Everything left keeps the default "secondary" role.
  return roles;
}

function indexOfExtreme(
  values: { L: number; C: number; h: number }[],
  taken: Set<number>,
  pick: (value: { L: number; C: number; h: number }) => number,
  mode: "min" | "max",
): number {
  let best = -1;
  let bestValue = mode === "max" ? -Infinity : Infinity;

  for (let i = 0; i < values.length; i++) {
    if (taken.has(i)) continue;
    const value = pick(values[i]);
    if (mode === "max" ? value > bestValue : value < bestValue) {
      bestValue = value;
      best = i;
    }
  }
  return best;
}

/** French labels for the roles, for display. */
export const ROLE_LABELS: Record<PaletteRole, string> = {
  dominant: "Dominante",
  secondary: "Secondaire",
  accent: "Accent",
  dark: "Sombre",
  light: "Claire",
  neutral: "Neutre",
};
