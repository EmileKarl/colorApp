import type { LightingId, MaterialId } from "../objects/types";

/**
 * Materials and lighting — ColorLens §13 (page 13).
 *
 * The parameters below are not arbitrary sliders. They follow the one split
 * that actually governs how a surface looks:
 *
 * **Metals tint their specular reflection; everything else does not.** Gold
 * reflects gold, copper reflects copper, because a conductor's reflectance
 * varies with wavelength. A dielectric — cotton, plastic, paint, glass — has a
 * near-colorless specular, which is why a red plastic ball has a *white*
 * highlight while a red-anodised metal one has a red highlight. That single
 * fact is what `metallic` encodes, and getting it wrong is the most visible
 * way a recolored mockup looks fake.
 *
 * The second parameter that matters is roughness: it does not change how much
 * light is reflected, it changes how *spread out* the reflection is. A mirror
 * and a sheet of brushed steel reflect similar energy; the mirror concentrates
 * it into a point, the brushed steel smears it across the surface.
 */

export type Material = {
  id: MaterialId;
  label: string;
  /** How much specular reflection the surface has, 0–1. */
  gloss: number;
  /** How spread out that reflection is, 0–1. Higher is more diffuse. */
  roughness: number;
  /** 1 for conductors, whose specular takes the surface's own hue. */
  metallic: number;
  /**
   * Retroreflection at grazing angles, 0–1. What makes velvet and suede glow
   * at their edges and look darker face-on than they "should".
   */
  sheen: number;
  /** Default opacity — only glass is below 1. */
  opacity: number;
  /**
   * Perceptual shift applied to the user's color, in CIELAB units.
   * `dL` darkens or lightens, `dC` saturates or desaturates.
   *
   * These exist because a material genuinely changes how a pigment reads: the
   * same dye on suede is darker and duller than on satin, because the raised
   * fibres trap light. Expressed in Lab so the hue the user captured survives
   * — the same reason harmonies rotate in LCh rather than HSL.
   */
  dL: number;
  dC: number;
  /** Relief strength, 0–1: how much surface texture is suggested. */
  relief: number;
};

const MATERIAL_LIST: Material[] = [
  {
    id: "cotton",
    label: "Coton",
    gloss: 0.06,
    roughness: 0.92,
    metallic: 0,
    sheen: 0.12,
    opacity: 1,
    dL: -1,
    dC: -3,
    relief: 0.35,
  },
  {
    id: "leather",
    label: "Cuir",
    gloss: 0.34,
    roughness: 0.58,
    metallic: 0,
    sheen: 0.2,
    opacity: 1,
    dL: -3,
    dC: 2,
    relief: 0.5,
  },
  {
    id: "suede",
    // Raised fibres trap light: suede is the darkest and dullest rendering of
    // a given dye, and its highlight is almost entirely diffuse.
    label: "Daim",
    gloss: 0.04,
    roughness: 0.96,
    metallic: 0,
    sheen: 0.55,
    opacity: 1,
    dL: -6,
    dC: -8,
    relief: 0.6,
  },
  {
    id: "plastic",
    label: "Plastique",
    gloss: 0.55,
    roughness: 0.3,
    metallic: 0,
    sheen: 0,
    opacity: 1,
    dL: 0,
    dC: 3,
    relief: 0.08,
  },
  {
    id: "metal",
    label: "Métal",
    gloss: 0.95,
    roughness: 0.18,
    metallic: 1,
    sheen: 0,
    opacity: 1,
    dL: 2,
    dC: -4,
    relief: 0.12,
  },
  {
    id: "glass",
    label: "Verre",
    gloss: 0.9,
    roughness: 0.05,
    metallic: 0,
    sheen: 0,
    opacity: 0.45,
    dL: 6,
    dC: -6,
    relief: 0,
  },
  {
    id: "wood",
    label: "Bois",
    gloss: 0.22,
    roughness: 0.7,
    metallic: 0,
    sheen: 0.08,
    opacity: 1,
    dL: -2,
    dC: 4,
    relief: 0.7,
  },
  {
    id: "fabric",
    label: "Tissu",
    gloss: 0.1,
    roughness: 0.88,
    metallic: 0,
    sheen: 0.18,
    opacity: 1,
    dL: -1,
    dC: -2,
    relief: 0.4,
  },
  {
    id: "rubber",
    label: "Caoutchouc",
    gloss: 0.18,
    roughness: 0.75,
    metallic: 0,
    sheen: 0.05,
    opacity: 1,
    dL: -4,
    dC: -5,
    relief: 0.3,
  },
  {
    id: "car_paint",
    // Clear-coat over a pigmented base: a strong, tight, colorless specular
    // sitting on a deep, saturated body color.
    label: "Peinture auto",
    gloss: 0.88,
    roughness: 0.12,
    metallic: 0.25,
    sheen: 0,
    opacity: 1,
    dL: -1,
    dC: 6,
    relief: 0.03,
  },
  {
    id: "satin",
    label: "Satin",
    gloss: 0.45,
    roughness: 0.42,
    metallic: 0,
    sheen: 0.4,
    opacity: 1,
    dL: 2,
    dC: 2,
    relief: 0.2,
  },
  {
    id: "velvet",
    label: "Velours",
    gloss: 0.08,
    roughness: 0.9,
    metallic: 0,
    sheen: 0.75,
    opacity: 1,
    dL: -5,
    dC: 3,
    relief: 0.55,
  },
];

export const MATERIALS: Record<MaterialId, Material> = Object.fromEntries(
  MATERIAL_LIST.map((material) => [material.id, material]),
) as Record<MaterialId, Material>;

export const ALL_MATERIALS = MATERIAL_LIST;

export function material(id: MaterialId): Material {
  return MATERIALS[id];
}

// ---------------------------------------------------------------------------
// Lighting
// ---------------------------------------------------------------------------

export type Lighting = {
  id: LightingId;
  label: string;
  /**
   * The light's own color. Applied to highlights, which is what makes a
   * "warm" setup read as warm without staining the object's actual color.
   */
  color: string;
  /** Fill light color — what the shadow side is lit by. */
  ambientColor: string;
  /** Overall strength, 0–1. */
  intensity: number;
  /**
   * How dark the unlit side goes, 0–1. Low contrast is a softbox; high is a
   * single hard source.
   */
  contrast: number;
  /** Light direction, degrees clockwise from the top. */
  angle: number;
};

const LIGHTING_LIST: Lighting[] = [
  {
    id: "studio",
    label: "Studio",
    // Neutral by definition: a studio setup is what you use precisely when you
    // do not want the light to editorialise the color.
    color: "#ffffff",
    ambientColor: "#e9ecf2",
    intensity: 0.7,
    contrast: 0.45,
    angle: 315,
  },
  {
    id: "natural",
    label: "Naturel",
    // Daylight is slightly blue and its fill comes from the sky, which is why
    // outdoor shadows read cool rather than grey.
    color: "#fff8ee",
    ambientColor: "#cfd9e8",
    intensity: 0.65,
    contrast: 0.4,
    angle: 330,
  },
  {
    id: "warm",
    label: "Chaud",
    color: "#ffd7a3",
    ambientColor: "#e0c3ab",
    intensity: 0.72,
    contrast: 0.5,
    angle: 300,
  },
  {
    id: "cool",
    label: "Froid",
    color: "#d6ecff",
    ambientColor: "#b9c6d8",
    intensity: 0.68,
    contrast: 0.5,
    angle: 20,
  },
  {
    id: "neon",
    label: "Néon",
    color: "#ff5fd2",
    ambientColor: "#3a2a66",
    intensity: 0.85,
    contrast: 0.78,
    angle: 250,
  },
  {
    id: "outdoor",
    label: "Extérieur",
    color: "#fff4d9",
    ambientColor: "#b6c6da",
    intensity: 0.8,
    contrast: 0.62,
    angle: 340,
  },
  {
    id: "premium",
    label: "Produit premium",
    // Low fill, tight key: the look that makes a product photograph read as
    // expensive — deep falloff, one clean highlight.
    color: "#ffffff",
    ambientColor: "#2b2f36",
    intensity: 0.78,
    contrast: 0.82,
    angle: 305,
  },
];

export const LIGHTINGS: Record<LightingId, Lighting> = Object.fromEntries(
  LIGHTING_LIST.map((entry) => [entry.id, entry]),
) as Record<LightingId, Lighting>;

export const ALL_LIGHTINGS = LIGHTING_LIST;

export function lighting(id: LightingId): Lighting {
  return LIGHTINGS[id];
}
