import { hexToLch, lchToHex } from "../objects/renderer/shading";
import type { ObjectModel, ProjectData, ZoneRole } from "../objects/types";

/**
 * Automatic variants — ColorLens page 15.
 *
 * Every variant is a **deterministic transform in LCh** of the object's source
 * color, not a generative re-imagining. The spec (§15) requires that form,
 * volume, proportion, zones, shadows and materials be preserved; recoloring
 * existing zones preserves all six by construction, which no image model can
 * promise.
 *
 * Each variant is expressed as a per-role recipe: how light, how saturated and
 * which hue each role takes relative to the source. Writing them as data
 * rather than as code means a unit test can check properties that ought to
 * hold across all of them — that Pastel is always lighter than Sombre, that
 * Minimaliste is never more saturated than Sportif — instead of each variant
 * being an untestable one-off.
 */

export type VariantId =
  | "original"
  | "monochrome"
  | "dark"
  | "pastel"
  | "premium"
  | "contrast"
  | "sport"
  | "streetwear"
  | "futuristic"
  | "minimal";

/**
 * How one role is derived from the source color.
 *
 * `L` is an absolute target lightness when given, `dL` a relative shift.
 * `chroma` multiplies the source chroma; `hueShift` rotates in degrees.
 * Absolute targets are what let a variant impose a *structure* (a near-black
 * sole under a mid-tone body) rather than only nudging whatever was there.
 */
type RoleRecipe = {
  L?: number;
  dL?: number;
  chroma: number;
  hueShift?: number;
};

export type Variant = {
  id: VariantId;
  label: string;
  description: string;
  /** Recipes by role; roles the variant does not mention keep the source. */
  roles: Partial<Record<ZoneRole, RoleRecipe>>;
};

export const VARIANTS: Variant[] = [
  {
    id: "original",
    label: "Original",
    description: "La couleur telle que tu l’as capturée.",
    roles: {},
  },
  {
    id: "monochrome",
    label: "Monochrome",
    description: "Une seule teinte, déclinée du plus clair au plus foncé.",
    roles: {
      body: { chroma: 1 },
      secondary: { dL: 18, chroma: 0.8 },
      detail: { dL: -16, chroma: 0.9 },
      accent: { dL: -30, chroma: 1 },
      trim: { dL: 28, chroma: 0.5 },
      hardware: { dL: -38, chroma: 0.6 },
    },
  },
  {
    id: "dark",
    label: "Sombre",
    description: "Tons profonds, contraste retenu.",
    roles: {
      body: { L: 24, chroma: 0.85 },
      secondary: { L: 16, chroma: 0.7 },
      detail: { L: 34, chroma: 0.9 },
      accent: { L: 52, chroma: 1.2 },
      trim: { L: 12, chroma: 0.4 },
      hardware: { L: 10, chroma: 0.3 },
    },
  },
  {
    id: "pastel",
    label: "Pastel",
    description: "Clair et doux : luminosité haute, saturation basse.",
    roles: {
      body: { L: 84, chroma: 0.42 },
      secondary: { L: 90, chroma: 0.3 },
      detail: { L: 76, chroma: 0.5 },
      accent: { L: 70, chroma: 0.65 },
      trim: { L: 93, chroma: 0.18 },
      hardware: { L: 62, chroma: 0.35 },
    },
  },
  {
    id: "premium",
    label: "Premium",
    description: "Base très sombre, un seul accent lumineux.",
    roles: {
      // Luxury product photography reads as expensive through restraint: a
      // near-black body, almost no chroma anywhere, and exactly one place
      // where the color is allowed to appear.
      body: { L: 18, chroma: 0.5 },
      secondary: { L: 14, chroma: 0.35 },
      detail: { L: 26, chroma: 0.4 },
      accent: { L: 66, chroma: 1.15 },
      trim: { L: 10, chroma: 0.2 },
      hardware: { L: 72, chroma: 0.25 },
    },
  },
  {
    id: "contrast",
    label: "Contrasté",
    description: "La couleur contre du noir et du blanc.",
    roles: {
      body: { chroma: 1.25 },
      secondary: { L: 96, chroma: 0.05 },
      detail: { L: 8, chroma: 0.05 },
      accent: { chroma: 1.35 },
      trim: { L: 96, chroma: 0.05 },
      hardware: { L: 8, chroma: 0.05 },
    },
  },
  {
    id: "sport",
    label: "Sportif",
    description: "Couleur vive sur blanc, un accent qui claque.",
    roles: {
      body: { L: 62, chroma: 1.45 },
      secondary: { L: 95, chroma: 0.06 },
      detail: { L: 55, chroma: 1.3, hueShift: 24 },
      accent: { L: 58, chroma: 1.6, hueShift: -150 },
      trim: { L: 95, chroma: 0.06 },
      hardware: { L: 20, chroma: 0.2 },
    },
  },
  {
    id: "streetwear",
    label: "Streetwear",
    description: "Base sourde, quincaillerie noire, un accent franc.",
    roles: {
      body: { L: 46, chroma: 0.6 },
      secondary: { L: 34, chroma: 0.45 },
      detail: { L: 14, chroma: 0.15 },
      accent: { L: 64, chroma: 1.5 },
      trim: { L: 26, chroma: 0.25 },
      hardware: { L: 12, chroma: 0.1 },
    },
  },
  {
    id: "futuristic",
    label: "Futuriste",
    description: "Fond froid et sombre, teinte poussée vers le cyan.",
    roles: {
      body: { L: 22, chroma: 0.9, hueShift: 42 },
      secondary: { L: 30, chroma: 0.7, hueShift: 50 },
      detail: { L: 70, chroma: 1.5, hueShift: 30 },
      accent: { L: 76, chroma: 1.7, hueShift: 18 },
      trim: { L: 16, chroma: 0.4, hueShift: 50 },
      hardware: { L: 82, chroma: 0.3 },
    },
  },
  {
    id: "minimal",
    label: "Minimaliste",
    description: "Presque neutre, très peu d’écart entre les zones.",
    roles: {
      body: { L: 78, chroma: 0.12 },
      secondary: { L: 84, chroma: 0.08 },
      detail: { L: 70, chroma: 0.14 },
      accent: { L: 58, chroma: 0.22 },
      trim: { L: 88, chroma: 0.05 },
      hardware: { L: 52, chroma: 0.1 },
    },
  },
];

export const VARIANT_BY_ID: Record<VariantId, Variant> = Object.fromEntries(
  VARIANTS.map((variant) => [variant.id, variant]),
) as Record<VariantId, Variant>;

/**
 * Applies one role recipe to a source color.
 *
 * Everything happens in a single LCh step — read the source's coordinates,
 * compute the target, convert back once — so the gamut mapping in
 * `lchToHex` (chroma traded for hue, never channels clipped) applies to the
 * result rather than to an intermediate.
 */
export function applyRecipe(sourceHex: string, recipe: RoleRecipe): string {
  const source = hexToLch(sourceHex);
  return lchToHex({
    L: recipe.L ?? source.L + (recipe.dL ?? 0),
    C: source.C * recipe.chroma,
    h: source.h + (recipe.hueShift ?? 0),
  });
}

/**
 * Produces the zone colors for a variant.
 *
 * The source color is the body zone's current color — the thing the user
 * captured and is reasoning about — so variants always relate to what is on
 * screen rather than to some earlier state.
 */
export function variantColors(
  variant: Variant,
  model: ObjectModel,
  sourceHex: string,
): Record<string, string> {
  const colors: Record<string, string> = {};
  for (const zone of model.zones) {
    const recipe = variant.roles[zone.role];
    colors[zone.id] = recipe ? applyRecipe(sourceHex, recipe) : sourceHex;
  }
  return colors;
}

/** Applies a variant to a project, keeping materials, lighting and render. */
export function applyVariant(
  project: ProjectData,
  model: ObjectModel,
  variant: Variant,
  sourceHex: string,
): ProjectData {
  if (variant.id === "original") {
    return { ...project, variant: "original" };
  }
  const colors = variantColors(variant, model, sourceHex);
  const zones = { ...project.zones };
  for (const zone of model.zones) {
    const current = zones[zone.id];
    if (current) zones[zone.id] = { ...current, color: colors[zone.id] };
  }
  return { ...project, zones, variant: variant.id };
}

/** The color a variant is derived from: the body zone's current color. */
export function sourceColorOf(project: ProjectData, model: ObjectModel): string {
  const body = model.zones.find((zone) => zone.role === "body") ?? model.zones[0];
  return project.zones[body.id]?.color ?? body.defaultColor;
}

// ---------------------------------------------------------------------------
// Adjustment requests (page 15, "l'utilisateur peut demander…")
// ---------------------------------------------------------------------------

export type AdjustmentId =
  | "subtler"
  | "more_luxurious"
  | "sportier"
  | "more_colorful"
  | "more_minimal"
  | "bolder"
  | "more_natural";

export type Adjustment = {
  id: AdjustmentId;
  label: string;
  /** Multiplies every zone's chroma. */
  chroma: number;
  /** Shifts every zone's lightness. */
  dL: number;
  /**
   * Pulls zones toward (>0) or pushes them away from (<0) their average
   * lightness — how "minimal" and "bold" differ from merely dull and vivid.
   */
  converge: number;
};

export const ADJUSTMENTS: Adjustment[] = [
  { id: "subtler", label: "Plus discret", chroma: 0.72, dL: 4, converge: 0.25 },
  { id: "more_luxurious", label: "Plus luxueux", chroma: 0.8, dL: -14, converge: 0.15 },
  { id: "sportier", label: "Plus sportif", chroma: 1.32, dL: 4, converge: -0.2 },
  { id: "more_colorful", label: "Plus coloré", chroma: 1.45, dL: 0, converge: 0 },
  { id: "more_minimal", label: "Plus minimaliste", chroma: 0.5, dL: 8, converge: 0.45 },
  { id: "bolder", label: "Plus audacieux", chroma: 1.55, dL: -4, converge: -0.35 },
  { id: "more_natural", label: "Plus naturel", chroma: 0.85, dL: 2, converge: 0.2 },
];

/**
 * Applies a relative adjustment to whatever is currently on the object.
 *
 * Unlike a variant, this composes: asking for "plus coloré" twice really does
 * saturate twice. That is what makes the buttons feel like a conversation with
 * the object rather than a set of presets.
 */
export function applyAdjustment(
  project: ProjectData,
  model: ObjectModel,
  adjustment: Adjustment,
): ProjectData {
  const lightnesses = model.zones
    .map((zone) => project.zones[zone.id]?.color)
    .filter((hex): hex is string => Boolean(hex))
    .map((hex) => hexToLch(hex).L);
  const averageL =
    lightnesses.length > 0
      ? lightnesses.reduce((total, value) => total + value, 0) / lightnesses.length
      : 50;

  const zones = { ...project.zones };
  for (const zone of model.zones) {
    const current = zones[zone.id];
    if (!current) continue;
    const lch = hexToLch(current.color);
    zones[zone.id] = {
      ...current,
      color: lchToHex({
        L: lch.L + (averageL - lch.L) * adjustment.converge + adjustment.dL,
        C: lch.C * adjustment.chroma,
        h: lch.h,
      }),
    };
  }
  // An adjustment moves away from whatever preset was applied, so the marker
  // no longer describes the state.
  return { ...project, zones, variant: undefined };
}
