import { labToLch, rgbToLab } from "../color-spaces/lab";
import type { ColorFamily } from "../../lib/color";
import type { Lab, LCh, RGB } from "../types";

/**
 * Reference color database.
 *
 * Entries are defined by their sRGB hex — the honest thing to do, since these
 * are *named colors* drawn from common usage, not spectrophotometer
 * measurements of physical samples. Lab/LCh are derived on load rather than
 * hand-written, so they can never drift out of sync with the hex.
 *
 * `referenceSource` records where a value came from, and `confidence` how much
 * the classifier should trust it. A color digitized from a printed standard
 * deserves less trust than one defined natively in sRGB, and the matcher uses
 * that to break near-ties.
 */

export type ReferenceSource =
  | "srgb_definition"
  | "common_usage"
  | "measured"
  | "derived";

export type ReferenceColorInput = {
  id: string;
  name: string;
  family: ColorFamily;
  hex: string;
  referenceSource: ReferenceSource;
  /** How much to trust this entry as a reference, 0–1. */
  confidence: number;
};

export type ReferenceColor = ReferenceColorInput & {
  rgb: RGB;
  lab: Lab;
  lch: LCh;
  chroma: number;
  hue: number;
};

function hexToRgb(hex: string): RGB {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

/** Derives every colorimetric field from the hex, so entries cannot drift. */
export function buildReferenceColor(input: ReferenceColorInput): ReferenceColor {
  const rgb = hexToRgb(input.hex);
  const lab = rgbToLab(rgb);
  const lch = labToLch(lab);
  return { ...input, rgb, lab, lch, chroma: lch.C, hue: lch.h };
}

/**
 * Seed reference set.
 *
 * Deliberately modest in size: a classifier is only as good as the separation
 * between its classes, and a bloated list of near-identical names makes
 * classification *worse*, not better, while inflating the apparent accuracy of
 * a benchmark. Expand this from validation data, not from intuition.
 */
const RAW_REFERENCES: ReferenceColorInput[] = [
  // sRGB primaries and neutrals — exact by definition.
  { id: "white", name: "Blanc", family: "white", hex: "#ffffff", referenceSource: "srgb_definition", confidence: 1 },
  { id: "black", name: "Noir", family: "black", hex: "#000000", referenceSource: "srgb_definition", confidence: 1 },
  { id: "mid_gray", name: "Gris moyen", family: "gray", hex: "#808080", referenceSource: "srgb_definition", confidence: 1 },
  { id: "light_gray", name: "Gris clair", family: "gray", hex: "#d3d3d3", referenceSource: "common_usage", confidence: 0.9 },
  { id: "dark_gray", name: "Gris foncé", family: "gray", hex: "#404040", referenceSource: "common_usage", confidence: 0.9 },
  { id: "red", name: "Rouge", family: "red", hex: "#ff0000", referenceSource: "srgb_definition", confidence: 1 },
  { id: "green", name: "Vert", family: "green", hex: "#00ff00", referenceSource: "srgb_definition", confidence: 1 },
  { id: "blue", name: "Bleu", family: "blue", hex: "#0000ff", referenceSource: "srgb_definition", confidence: 1 },
  { id: "yellow", name: "Jaune", family: "yellow", hex: "#ffff00", referenceSource: "srgb_definition", confidence: 1 },
  { id: "cyan", name: "Cyan", family: "cyan", hex: "#00ffff", referenceSource: "srgb_definition", confidence: 1 },
  { id: "magenta", name: "Magenta", family: "pink", hex: "#ff00ff", referenceSource: "srgb_definition", confidence: 1 },

  // Common named colors — widely agreed sRGB values, but not measurements.
  { id: "crimson", name: "Cramoisi", family: "red", hex: "#dc143c", referenceSource: "common_usage", confidence: 0.85 },
  { id: "brick_red", name: "Rouge brique", family: "red", hex: "#b22222", referenceSource: "common_usage", confidence: 0.85 },
  { id: "salmon", name: "Saumon", family: "pink", hex: "#fa8072", referenceSource: "common_usage", confidence: 0.85 },
  { id: "coral", name: "Corail", family: "orange", hex: "#ff7f50", referenceSource: "common_usage", confidence: 0.85 },
  { id: "orange", name: "Orange", family: "orange", hex: "#ffa500", referenceSource: "common_usage", confidence: 0.9 },
  { id: "amber", name: "Ambre", family: "yellow", hex: "#ffbf00", referenceSource: "common_usage", confidence: 0.8 },
  { id: "mustard", name: "Moutarde", family: "yellow", hex: "#c9a227", referenceSource: "common_usage", confidence: 0.75 },
  { id: "olive", name: "Olive", family: "green", hex: "#808000", referenceSource: "common_usage", confidence: 0.85 },
  { id: "forest_green", name: "Vert sapin", family: "green", hex: "#228b22", referenceSource: "common_usage", confidence: 0.85 },
  { id: "mint", name: "Vert menthe", family: "green", hex: "#98d8b1", referenceSource: "common_usage", confidence: 0.75 },
  { id: "teal", name: "Sarcelle", family: "cyan", hex: "#008080", referenceSource: "common_usage", confidence: 0.85 },
  { id: "turquoise", name: "Turquoise", family: "cyan", hex: "#30d5c8", referenceSource: "common_usage", confidence: 0.8 },
  { id: "sky_blue", name: "Bleu ciel", family: "blue", hex: "#87ceeb", referenceSource: "common_usage", confidence: 0.85 },
  { id: "cobalt_blue", name: "Bleu de cobalt", family: "blue", hex: "#0047ab", referenceSource: "common_usage", confidence: 0.85 },
  { id: "navy", name: "Bleu marine", family: "blue", hex: "#000080", referenceSource: "common_usage", confidence: 0.9 },
  { id: "indigo", name: "Indigo", family: "purple", hex: "#4b0082", referenceSource: "common_usage", confidence: 0.85 },
  { id: "violet", name: "Violet", family: "purple", hex: "#8a2be2", referenceSource: "common_usage", confidence: 0.8 },
  { id: "lavender", name: "Lavande", family: "purple", hex: "#b57edc", referenceSource: "common_usage", confidence: 0.75 },
  { id: "plum", name: "Prune", family: "purple", hex: "#5d3954", referenceSource: "common_usage", confidence: 0.75 },
  { id: "hot_pink", name: "Rose vif", family: "pink", hex: "#ff69b4", referenceSource: "common_usage", confidence: 0.85 },
  { id: "dusty_pink", name: "Rose poudré", family: "pink", hex: "#f4c2c2", referenceSource: "common_usage", confidence: 0.75 },
  { id: "brown", name: "Brun", family: "brown", hex: "#7b3f00", referenceSource: "common_usage", confidence: 0.85 },
  { id: "chocolate", name: "Chocolat", family: "brown", hex: "#3f2305", referenceSource: "common_usage", confidence: 0.8 },
  { id: "beige", name: "Beige", family: "brown", hex: "#e8dcc5", referenceSource: "common_usage", confidence: 0.75 },
  { id: "off_white", name: "Blanc cassé", family: "white", hex: "#f8f4e9", referenceSource: "common_usage", confidence: 0.8 },
  { id: "charcoal", name: "Noir charbon", family: "black", hex: "#1c1c1c", referenceSource: "common_usage", confidence: 0.85 },
];

/** The reference database, with all colorimetric fields derived. */
export const COLOR_DATABASE: ReferenceColor[] = RAW_REFERENCES.map(buildReferenceColor);

/** Looks an entry up by id, for tests and for resolving stored classifications. */
export function findReferenceById(id: string): ReferenceColor | undefined {
  return COLOR_DATABASE.find((color) => color.id === id);
}
