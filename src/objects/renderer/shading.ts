import { labToLch, labToXyz, lchToLab, rgbToLab } from "../../color-engine/color-spaces/lab";
import { xyzToLinearRgb } from "../../color-engine/color-spaces/xyz";
import { linearToRgb } from "../../color-engine/color-spaces/srgb";
import { lighting as lightingFor, material as materialFor } from "../../domain/materials";
import type { Lighting, Material } from "../../domain/materials";
import { hexToRgb, rgbToHex } from "../../lib/color";
import type {
  ObjectModel,
  ProjectData,
  RenderPlan,
  RenderSettings,
  ZoneRender,
  ZoneState,
} from "../types";

/**
 * Turns a Studio state into concrete colors and opacities — the arithmetic
 * half of the renderer.
 *
 * Everything here is pure, so the appearance rules can be unit-tested without
 * a GPU. The canvas consumes the `RenderPlan` this produces and does nothing
 * but draw it.
 *
 * The governing idea, from §6: recoloring must preserve shadows, highlights,
 * textures and volumes. That is achieved by never painting a flat color — a
 * zone is always a base fill plus a shaded side plus a lit side, whose colors
 * are derived from the user's color rather than replacing it.
 */

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Linear interpolation between two sRGB colors, channel-wise. */
function mixSrgb(a: string, b: string, t: number): string {
  const from = hexToRgb(a);
  const to = hexToRgb(b);
  const k = clamp01(t);
  return rgbToHex({
    r: Math.round(from.r + (to.r - from.r) * k),
    g: Math.round(from.g + (to.g - from.g) * k),
    b: Math.round(from.b + (to.b - from.b) * k),
  });
}

/**
 * Shifts a color's lightness and chroma without touching its hue.
 *
 * Done in LCh rather than by scaling RGB channels. Multiplying sRGB by 0.7 to
 * "darken" also drags the hue — most visibly, darkened yellows turn olive and
 * darkened cyans turn blue — because the channels do not scale
 * proportionally in perceptual terms. Working in LCh moves exactly the two
 * dimensions intended and leaves the captured hue intact, which is the whole
 * point of a color the user went out and measured.
 */
export function shiftLightnessChroma(hex: string, dL: number, dC: number): string {
  const lch = labToLch(rgbToLab(hexToRgb(hex)));
  return rgbToHex(
    gamutMap({
      L: Math.min(100, Math.max(0, lch.L + dL)),
      // Chroma cannot go negative: below zero it would wrap through grey and
      // come back out on the opposite hue.
      C: Math.max(0, lch.C + dC),
      h: lch.h,
    }),
  );
}

/**
 * Converts an LCh color to sRGB, reducing chroma if needed to stay in gamut.
 *
 * The one entry point for "I have a lightness, a chroma and a hue, give me a
 * color". Exported so that variants and adjustments go through the same gamut
 * handling as the renderer instead of re-deriving it.
 */
export function lchToHex(lch: { L: number; C: number; h: number }): string {
  return rgbToHex(
    gamutMap({
      L: Math.min(100, Math.max(0, lch.L)),
      C: Math.max(0, lch.C),
      h: ((lch.h % 360) + 360) % 360,
    }),
  );
}

/** The LCh coordinates of a hex color. */
export function hexToLch(hex: string): { L: number; C: number; h: number } {
  return labToLch(rgbToLab(hexToRgb(hex)));
}

/** True when an LCh color has an exact sRGB representation. */
function inGamut(lch: { L: number; C: number; h: number }): boolean {
  const linear = xyzToLinearRgb(labToXyz(lchToLab(lch)));
  const EPSILON = 1e-4;
  return (
    linear.r >= -EPSILON &&
    linear.r <= 1 + EPSILON &&
    linear.g >= -EPSILON &&
    linear.g <= 1 + EPSILON &&
    linear.b >= -EPSILON &&
    linear.b <= 1 + EPSILON
  );
}

/**
 * Brings an LCh color inside the sRGB gamut by reducing chroma, never by
 * clipping channels.
 *
 * Darkening a saturated color pushes it outside what sRGB can show. The naive
 * response — clamp each channel to 0–255 — clips the channels unequally and
 * therefore *rotates the hue*: measured on a saturated green, a 20-unit
 * darkening drifted more than 4°, which is exactly the failure that working in
 * LCh was meant to avoid in the first place.
 *
 * Trading chroma for hue is the standard resolution, and the right one here:
 * the user chose a hue, not a saturation. A binary search converges in ~16
 * steps, which is immaterial next to the drawing that follows.
 */
function gamutMap(lch: { L: number; C: number; h: number }): { r: number; g: number; b: number } {
  if (inGamut(lch)) return linearToRgb(xyzToLinearRgb(labToXyz(lchToLab(lch))));

  let low = 0;
  let high = lch.C;
  for (let step = 0; step < 16; step++) {
    const mid = (low + high) / 2;
    if (inGamut({ ...lch, C: mid })) low = mid;
    else high = mid;
  }
  return linearToRgb(xyzToLinearRgb(labToXyz(lchToLab({ ...lch, C: low }))));
}

/**
 * The color a material makes a given pigment appear.
 *
 * The same dye reads darker and duller on suede than on satin because raised
 * fibres trap light. `dL`/`dC` in the material table encode that, in
 * perceptual units.
 */
export function materialTint(hex: string, material: Material): string {
  return shiftLightnessChroma(hex, material.dL, material.dC);
}

/**
 * The color of the specular highlight.
 *
 * This is the one rule that most determines whether a recolored mockup looks
 * real: **conductors tint their reflection, dielectrics do not.** A red
 * plastic surface has a white highlight; a red-anodised metal one has a red
 * highlight. Blending toward the base color by `metallic` reproduces that,
 * and blending toward the *light's* color for everything else is what makes a
 * warm or neon setup read as warm or neon.
 */
export function specularColor(baseHex: string, material: Material, light: Lighting): string {
  const dielectric = light.color;
  if (material.metallic <= 0) return dielectric;
  // A metal's specular is its own color, brightened — a polished surface
  // reflects more light than its diffuse body returns.
  const metallicSpecular = shiftLightnessChroma(baseHex, 18, -4);
  return mixSrgb(dielectric, metallicSpecular, material.metallic);
}

/**
 * The color of the shaded side.
 *
 * Not black, and not the base color darkened either: an unlit surface is still
 * lit — by the fill, the sky, the walls of the room. So the shadow is the base
 * color darkened *toward the ambient light's color*. This is why outdoor
 * shadows look blue (lit by the sky) and why painting shadows grey is the
 * classic giveaway of a fake render.
 */
export function shadowColor(baseHex: string, light: Lighting): string {
  const darkened = shiftLightnessChroma(baseHex, -26, -4);
  return mixSrgb(darkened, light.ambientColor, 0.22);
}

/**
 * Resolves one zone's appearance.
 *
 * @param state The user's choices for this zone: color, material, opacity.
 * @param light The scene lighting.
 * @param settings Global render adjustments from the Studio sliders.
 */
export function renderZone(
  zoneId: string,
  state: ZoneState,
  light: Lighting,
  settings: RenderSettings,
): ZoneRender {
  const material = materialFor(state.material);
  const fill = materialTint(state.color, material);

  // Roughness scales the highlight down and spreads it out; the two move
  // together because a rough surface scatters the same energy over more area,
  // so any given point receives less of it.
  const roughness = clamp01(material.roughness * (0.5 + settings.roughness));
  const glossStrength = clamp01(material.gloss * (0.4 + settings.gloss * 1.2));

  const highlightOpacity = clamp01(
    glossStrength * (1 - roughness * 0.75) * (0.45 + settings.lightIntensity * 0.9) +
      // Sheen is retroreflection at grazing angles: velvet and suede glow at
      // their edges even though they have almost no gloss, so it contributes
      // independently of the specular term.
      material.sheen * 0.22,
  );

  // §6 requires that recoloring preserve volume. Without a floor, a user who
  // pulls shadows to zero and contrast to its minimum gets shadowOpacity 0 —
  // a flat silhouette with no form at all. The floor keeps the object
  // readable as an object while still letting the slider do most of its range.
  const MINIMUM_SHADOW = 0.08;
  const shadowOpacity = Math.max(
    MINIMUM_SHADOW,
    clamp01(
      light.contrast * (0.4 + settings.shadows) * (0.75 + material.roughness * 0.35) +
        settings.contrast * 0.2,
    ),
  );

  return {
    zoneId,
    fill,
    shadowColor: shadowColor(fill, light),
    shadowOpacity,
    highlightColor: specularColor(fill, material, light),
    highlightOpacity,
    // A mirror concentrates its reflection into a point; suede smears it over
    // the whole form. Tightness is the inverse of roughness, and drives where
    // the highlight gradient's stop sits.
    specularTightness: clamp01(1 - roughness),
    opacity: clamp01(state.opacity * material.opacity),
  };
}

/** Builds the full plan the canvas draws. */
export function buildRenderPlan(model: ObjectModel, project: ProjectData): RenderPlan {
  const light = lightingFor(project.lighting);

  const zones = model.zones.map((zone) => {
    // A project saved before a zone existed — or one whose object gained a
    // zone in an update — falls back to the zone's own defaults rather than
    // rendering nothing.
    const state: ZoneState = project.zones[zone.id] ?? {
      color: zone.defaultColor,
      material: zone.defaultMaterial,
      opacity: 1,
    };
    return renderZone(zone.id, state, light, project.render);
  });

  return {
    zones,
    ambientColor: light.ambientColor,
    lightAngle: light.angle,
    background: project.background,
  };
}

/** Convenience for callers that only need one zone's resolved colors. */
export function findZoneRender(plan: RenderPlan, zoneId: string): ZoneRender | undefined {
  return plan.zones.find((zone) => zone.zoneId === zoneId);
}
