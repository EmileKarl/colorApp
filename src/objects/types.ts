/**
 * The object mockup format — ColorLens §6.
 *
 * One format serves both kinds of model, which is what lets the Studio ship
 * before any photographic mockup exists (audit decision 1, option C):
 *
 * - `vector` models are authored as SVG paths inside the app bundle. They work
 *   offline, recolor exactly, and cost nothing to produce.
 * - `raster` models are photographic mockups with PNG mask layers, downloaded
 *   and cached on demand. They look real. They require images the project must
 *   source.
 *
 * A raster model can replace a vector one without any screen changing, because
 * both resolve to the same `RenderPlan`.
 */

import type { ObjectCategory } from "../types/database";

export type { ObjectCategory };

/** A recolorable region of an object: the sneaker's sole, the car's roof. */
export type ObjectZone = {
  id: string;
  label: string;
  /**
   * Which palette slot fills this zone when a whole palette is applied.
   * `body` takes the dominant color, `detail` an accent, and so on — this is
   * what makes "apply this palette" produce a sensible result rather than
   * assigning colors in arbitrary order.
   */
  role: ZoneRole;
  /** Restricts the material picker where a zone only makes sense in a few. */
  allowedMaterials?: MaterialId[];
  defaultMaterial: MaterialId;
  /** Fallback color when no palette has been applied yet. */
  defaultColor: string;
};

export type ZoneRole = "body" | "secondary" | "detail" | "accent" | "trim" | "hardware";

export const ZONE_ROLE_ORDER: ZoneRole[] = [
  "body",
  "secondary",
  "detail",
  "accent",
  "trim",
  "hardware",
];

export type MaterialId =
  | "cotton"
  | "leather"
  | "suede"
  | "plastic"
  | "metal"
  | "glass"
  | "wood"
  | "fabric"
  | "rubber"
  | "car_paint"
  | "satin"
  | "velvet";

export type LightingId =
  | "studio"
  | "natural"
  | "warm"
  | "cool"
  | "neon"
  | "outdoor"
  | "premium";

// ---------------------------------------------------------------------------
// Model geometry
// ---------------------------------------------------------------------------

/**
 * One drawing instruction in a vector model.
 *
 * Layers are painted in array order. A layer either fills a zone with the
 * user's color (`zone`), or contributes shading that must survive recoloring
 * (`shade`). Keeping shading as its own layer kind — rather than baking it
 * into the zone's fill — is what preserves volume when the color changes,
 * which §6 requires.
 */
export type VectorLayer =
  | { kind: "zone"; zone: string; d: string }
  | { kind: "shade"; role: ShadeRole; d: string; opacity: number; zone?: string }
  | { kind: "outline"; d: string; width: number; opacity: number };

export type ShadeRole = "shadow" | "highlight" | "occlusion" | "contact";

export type VectorModel = {
  /** SVG user units. Everything else scales to fit this box. */
  viewBox: { width: number; height: number };
  layers: VectorLayer[];
};

/** Photographic mockup: one base image plus per-zone masks and shading maps. */
export type RasterModel = {
  baseUrl: string;
  /** zone id → mask image. White where the zone is, black elsewhere. */
  maskUrls: Record<string, string>;
  shadowsUrl?: string;
  highlightsUrl?: string;
  textureUrl?: string;
  width: number;
  height: number;
};

export type ObjectModel = {
  id: string;
  name: string;
  category: ObjectCategory;
  zones: ObjectZone[];
  /** Extra camera angles, when the model has them. Empty means a single view. */
  views: string[];
  model3dUrl?: string;
} & ({ kind: "vector"; vector: VectorModel } | { kind: "raster"; raster: RasterModel });

// ---------------------------------------------------------------------------
// Studio state
// ---------------------------------------------------------------------------

export type ZoneState = {
  color: string;
  material: MaterialId;
  /** 0–1. Below 1 the zone shows what is behind it (glass, mesh). */
  opacity: number;
};

/**
 * Everything needed to reproduce a creation exactly. Persisted as
 * `creations.project_data`.
 *
 * `version` is present from the first release: a creation saved today must
 * still open after the material model changes, and without a version marker
 * there is no way to migrate it.
 */
export type ProjectData = {
  version: 1;
  objectId: string;
  zones: Record<string, ZoneState>;
  lighting: LightingId;
  /** Global render adjustments, each 0–1 unless noted. */
  render: RenderSettings;
  background: BackgroundStyle;
  /** Which variant preset produced this state, when one did. */
  variant?: string;
};

export type RenderSettings = {
  shadows: number;
  gloss: number;
  reflection: number;
  roughness: number;
  lightIntensity: number;
  /** -1 to 1, 0 being neutral. */
  contrast: number;
};

export type BackgroundStyle =
  | { kind: "solid"; color: string }
  | { kind: "gradient"; from: string; to: string }
  | { kind: "transparent" };

export const DEFAULT_RENDER_SETTINGS: RenderSettings = {
  shadows: 0.65,
  gloss: 0.5,
  reflection: 0.35,
  roughness: 0.5,
  lightIntensity: 0.6,
  contrast: 0,
};

// ---------------------------------------------------------------------------
// Render plan — what the canvas actually draws
// ---------------------------------------------------------------------------

/**
 * The resolved appearance of one zone: concrete colors and opacities, with all
 * material and lighting reasoning already applied.
 *
 * This type is the seam that makes the engine testable. Everything up to here
 * is arithmetic that runs under Jest; only the drawing of these values needs a
 * GPU.
 */
export type ZoneRender = {
  zoneId: string;
  /** The color the zone is painted, after material tinting. */
  fill: string;
  /** Color and strength of the shaded side. */
  shadowColor: string;
  shadowOpacity: number;
  /** Color and strength of the lit side. */
  highlightColor: string;
  highlightOpacity: number;
  /**
   * How tightly the highlight is concentrated, 0–1. A mirror-like surface
   * concentrates it into a small bright spot; suede spreads it over the whole
   * form. Consumed as a gradient stop position.
   */
  specularTightness: number;
  opacity: number;
};

export type RenderPlan = {
  zones: ZoneRender[];
  /** Ambient light color, used for the overall cast. */
  ambientColor: string;
  /** Direction the light comes from, in degrees clockwise from the top. */
  lightAngle: number;
  background: BackgroundStyle;
};
