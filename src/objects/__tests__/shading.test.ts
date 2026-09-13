import { deltaE2000 } from "../../color-engine/metrics/deltaE2000";
import { labToLch, rgbToLab } from "../../color-engine/color-spaces/lab";
import { lighting, material } from "../../domain/materials";
import { hexToRgb } from "../../lib/color";
import { BUILTIN_OBJECTS, CAR, SNEAKER, TSHIRT } from "../models";
import { applyColor, applyPalette, createProject, parseProject, projectPalette, resetProject, setZone } from "../project";
import {
  buildRenderPlan,
  materialTint,
  renderZone,
  shadowColor,
  shiftLightnessChroma,
  specularColor,
} from "../renderer/shading";
import { DEFAULT_RENDER_SETTINGS, type ZoneState } from "../types";

const lch = (hex: string) => labToLch(rgbToLab(hexToRgb(hex)));
const RED = "#c4302b";
const BLUE = "#0047ab";

describe("shiftLightnessChroma", () => {
  it("keeps the hue it was given", () => {
    // This is the reason the shift is done in LCh at all. Scaling sRGB
    // channels to darken drags the hue — most visibly, darkened yellows turn
    // olive — and the captured hue is the one thing the user actually chose.
    for (const hex of [RED, BLUE, "#f2c200", "#00a884", "#7a3fbf"]) {
      const before = lch(hex);
      const after = lch(shiftLightnessChroma(hex, -20, 0));
      // Rounding to 8-bit sRGB moves the hue slightly; 2° is the quantisation
      // floor, not a tolerance for the algorithm being wrong.
      expect(Math.abs(after.h - before.h)).toBeLessThan(2);
    }
  });

  it("darkens and lightens in the direction asked", () => {
    expect(lch(shiftLightnessChroma(RED, -20, 0)).L).toBeLessThan(lch(RED).L);
    expect(lch(shiftLightnessChroma(RED, 20, 0)).L).toBeGreaterThan(lch(RED).L);
  });

  it("never lets chroma cross zero into the opposite hue", () => {
    // A naive implementation subtracting chroma from a near-neutral produces a
    // negative C, which wraps through grey and comes back out 180° away — a
    // grey that turns orange when you desaturate it.
    const nearNeutral = "#807e7d";
    const result = lch(shiftLightnessChroma(nearNeutral, 0, -40));
    expect(result.C).toBeGreaterThanOrEqual(0);
    expect(result.C).toBeLessThan(lch(nearNeutral).C + 1);
  });

  it("clamps lightness to the 0–100 range", () => {
    expect(lch(shiftLightnessChroma("#ffffff", 50, 0)).L).toBeLessThanOrEqual(100.001);
    expect(lch(shiftLightnessChroma("#000000", -50, 0)).L).toBeGreaterThanOrEqual(0);
  });
});

describe("specular color", () => {
  it("gives a dielectric the light's color, not its own", () => {
    // A red plastic ball has a white highlight. Getting this wrong is the most
    // visible way a recolored mockup looks fake.
    const studio = lighting("studio");
    expect(specularColor(RED, material("plastic"), studio)).toBe(studio.color);
    expect(specularColor(RED, material("cotton"), studio)).toBe(studio.color);
    expect(specularColor(BLUE, material("glass"), studio)).toBe(studio.color);
  });

  it("gives a metal a highlight tinted with its own hue", () => {
    // Conductors reflect their own color: gold reflects gold. The highlight
    // must therefore sit near the base hue rather than near white.
    const specular = specularColor(RED, material("metal"), lighting("studio"));
    const specularHue = lch(specular).h;
    const baseHue = lch(RED).h;
    expect(Math.abs(specularHue - baseHue)).toBeLessThan(15);
    expect(lch(specular).C).toBeGreaterThan(5);
  });

  it("carries the lighting's color into a dielectric highlight", () => {
    // What makes a warm or neon scene read as warm or neon without staining
    // the object's own color.
    const warm = hexToRgb(specularColor(BLUE, material("cotton"), lighting("warm")));
    const cool = hexToRgb(specularColor(BLUE, material("cotton"), lighting("cool")));
    expect(warm.r).toBeGreaterThan(warm.b);
    expect(cool.b).toBeGreaterThan(cool.r);
  });

  it("places car paint between the two, as a clear coat over pigment", () => {
    const specular = specularColor(RED, material("car_paint"), lighting("studio"));
    // Partially metallic: tinted, but far closer to the light than a true
    // metal's highlight is.
    const towardBase = deltaE2000(rgbToLab(hexToRgb(specular)), rgbToLab(hexToRgb(RED)));
    const metalSpecular = specularColor(RED, material("metal"), lighting("studio"));
    const metalTowardBase = deltaE2000(rgbToLab(hexToRgb(metalSpecular)), rgbToLab(hexToRgb(RED)));
    expect(towardBase).toBeGreaterThan(metalTowardBase);
  });
});

describe("shadow color", () => {
  it("is darker than the base but not black", () => {
    const shadow = shadowColor(RED, lighting("studio"));
    expect(lch(shadow).L).toBeLessThan(lch(RED).L);
    // An unlit surface is still lit — by the fill, the sky, the room. Painting
    // shadows black is the classic giveaway of a fake render.
    expect(lch(shadow).L).toBeGreaterThan(3);
  });

  it("takes its cast from the ambient light", () => {
    // Outdoor shadows read blue because they are lit by the sky. A warm fill
    // must push the shadow the other way.
    const cool = hexToRgb(shadowColor("#808080", lighting("cool")));
    const warm = hexToRgb(shadowColor("#808080", lighting("warm")));
    expect(cool.b - cool.r).toBeGreaterThan(warm.b - warm.r);
  });

  it("keeps the base hue recognisable", () => {
    // A shadowed red must still read as red, not as a new color.
    const shadow = shadowColor(RED, lighting("studio"));
    expect(Math.abs(lch(shadow).h - lch(RED).h)).toBeLessThan(20);
  });
});

describe("material tint", () => {
  it("makes suede darker and duller than satin for the same dye", () => {
    // Raised fibres trap light; that is a real property of the material, not a
    // stylistic choice.
    const suede = lch(materialTint(RED, material("suede")));
    const satin = lch(materialTint(RED, material("satin")));
    expect(suede.L).toBeLessThan(satin.L);
    expect(suede.C).toBeLessThan(satin.C);
  });

  it("deepens car paint rather than dulling it", () => {
    expect(lch(materialTint(RED, material("car_paint"))).C).toBeGreaterThan(lch(RED).C);
  });

  it("never moves the hue", () => {
    for (const id of ["cotton", "leather", "suede", "metal", "car_paint", "velvet"] as const) {
      const tinted = lch(materialTint(BLUE, material(id)));
      expect(Math.abs(tinted.h - lch(BLUE).h)).toBeLessThan(3);
    }
  });
});

describe("renderZone", () => {
  const state = (overrides?: Partial<ZoneState>): ZoneState => ({
    color: RED,
    material: "plastic",
    opacity: 1,
    ...overrides,
  });

  it("produces opacities inside 0–1 for every material and lighting", () => {
    // The sliders multiply several factors together; without clamping, a
    // maxed-out combination produces an opacity above 1, which Skia renders
    // as an abrupt hard edge rather than an error.
    const materials = ["cotton", "leather", "suede", "plastic", "metal", "glass", "wood", "fabric", "rubber", "car_paint", "satin", "velvet"] as const;
    const lightings = ["studio", "natural", "warm", "cool", "neon", "outdoor", "premium"] as const;
    const extremeSettings = { ...DEFAULT_RENDER_SETTINGS, shadows: 1, gloss: 1, roughness: 1, lightIntensity: 1, contrast: 1 };

    for (const m of materials) {
      for (const l of lightings) {
        for (const settings of [DEFAULT_RENDER_SETTINGS, extremeSettings]) {
          const render = renderZone("z", state({ material: m }), lighting(l), settings);
          for (const value of [render.shadowOpacity, render.highlightOpacity, render.opacity, render.specularTightness]) {
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it("gives a glossy material a tighter, stronger highlight than a matte one", () => {
    const metal = renderZone("z", state({ material: "metal" }), lighting("studio"), DEFAULT_RENDER_SETTINGS);
    const suede = renderZone("z", state({ material: "suede" }), lighting("studio"), DEFAULT_RENDER_SETTINGS);
    expect(metal.highlightOpacity).toBeGreaterThan(suede.highlightOpacity);
    expect(metal.specularTightness).toBeGreaterThan(suede.specularTightness);
  });

  it("makes glass the only transparent material by default", () => {
    expect(renderZone("z", state({ material: "glass" }), lighting("studio"), DEFAULT_RENDER_SETTINGS).opacity).toBeLessThan(1);
    expect(renderZone("z", state({ material: "leather" }), lighting("studio"), DEFAULT_RENDER_SETTINGS).opacity).toBe(1);
  });

  it("deepens shadows under a high-contrast lighting", () => {
    const premium = renderZone("z", state(), lighting("premium"), DEFAULT_RENDER_SETTINGS);
    const studio = renderZone("z", state(), lighting("studio"), DEFAULT_RENDER_SETTINGS);
    expect(premium.shadowOpacity).toBeGreaterThan(studio.shadowOpacity);
  });

  it("still shows volume even when the user flattens every slider", () => {
    // §6 requires that recoloring preserve volume. A zone rendered with no
    // shadow and no highlight at all is a flat silhouette — the failure mode
    // this asserts against.
    const flat = { ...DEFAULT_RENDER_SETTINGS, shadows: 0, gloss: 0, lightIntensity: 0, contrast: -1 };
    const render = renderZone("z", state({ material: "cotton" }), lighting("studio"), flat);
    expect(render.shadowOpacity).toBeGreaterThan(0);
    expect(render.shadowColor).not.toBe(render.fill);
  });
});

describe("buildRenderPlan", () => {
  it("resolves every zone of every built-in model", () => {
    for (const model of BUILTIN_OBJECTS) {
      const plan = buildRenderPlan(model, createProject(model));
      expect(plan.zones).toHaveLength(model.zones.length);
      for (const zone of plan.zones) {
        expect(zone.fill).toMatch(/^#[0-9a-f]{6}$/);
        expect(zone.shadowColor).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it("falls back to a zone's defaults when the project predates it", () => {
    // A creation saved before a zone existed must still render, not vanish.
    const project = createProject(TSHIRT);
    delete project.zones.logo;
    const plan = buildRenderPlan(TSHIRT, project);
    expect(plan.zones.find((zone) => zone.zoneId === "logo")).toBeDefined();
  });
});

describe("built-in models", () => {
  it("references only zones it declares", () => {
    // A layer pointing at a missing zone renders nothing, silently — the kind
    // of defect that only shows up as a hole in the object on a device.
    for (const model of BUILTIN_OBJECTS) {
      if (model.kind !== "vector") continue;
      const declared = new Set(model.zones.map((zone) => zone.id));
      for (const layer of model.vector.layers) {
        const zone = layer.kind === "outline" ? undefined : layer.zone;
        if (zone) expect(declared.has(zone)).toBe(true);
      }
    }
  });

  it("paints every declared zone at least once", () => {
    // The mirror of the previous test: a zone offered in the editor that no
    // layer paints is a control that does nothing, which §13 forbids.
    for (const model of BUILTIN_OBJECTS) {
      if (model.kind !== "vector") continue;
      const painted = new Set(
        model.vector.layers.filter((layer) => layer.kind === "zone").map((layer) => layer.zone),
      );
      for (const zone of model.zones) expect(painted.has(zone.id)).toBe(true);
    }
  });

  it("gives every model exactly one body zone to receive the captured color", () => {
    for (const model of BUILTIN_OBJECTS) {
      expect(model.zones.filter((zone) => zone.role === "body")).toHaveLength(1);
    }
  });

  it("only offers materials a zone actually allows", () => {
    for (const model of BUILTIN_OBJECTS) {
      for (const zone of model.zones) {
        if (!zone.allowedMaterials) continue;
        expect(zone.allowedMaterials).toContain(zone.defaultMaterial);
      }
    }
  });

  it("declares valid hex defaults", () => {
    for (const model of BUILTIN_OBJECTS) {
      for (const zone of model.zones) expect(zone.defaultColor).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("has unique ids across the catalogue and within each model", () => {
    expect(new Set(BUILTIN_OBJECTS.map((m) => m.id)).size).toBe(BUILTIN_OBJECTS.length);
    for (const model of BUILTIN_OBJECTS) {
      expect(new Set(model.zones.map((z) => z.id)).size).toBe(model.zones.length);
    }
  });
});

describe("project editing", () => {
  it("applies a captured color to the body only", () => {
    // Painting every zone the same hue produces a monochrome blob in which the
    // object's structure disappears — the opposite of "see your color on this".
    const project = applyColor(createProject(SNEAKER), SNEAKER, RED);
    expect(project.zones.body.color).toBe(RED);
    expect(project.zones.sole.color).not.toBe(RED);
  });

  it("distributes a palette across roles in order", () => {
    const palette = ["#111111", "#222222", "#333333"];
    const project = applyPalette(createProject(SNEAKER), SNEAKER, palette);
    expect(project.zones.body.color).toBe(palette[0]);
    // Body, secondary, detail, accent, trim, hardware — the sole is secondary.
    expect(project.zones.sole.color).toBe(palette[1]);
  });

  it("wraps a short palette rather than leaving zones at a clashing default", () => {
    const project = applyPalette(createProject(CAR), CAR, ["#111111", "#222222"]);
    for (const zone of CAR.zones) {
      expect(["#111111", "#222222"]).toContain(project.zones[zone.id].color);
    }
  });

  it("ignores an empty palette instead of blanking the object", () => {
    const before = createProject(CAR);
    expect(applyPalette(before, CAR, [])).toBe(before);
  });

  it("clears the variant marker on any manual edit", () => {
    // Otherwise a creation would claim to be the "Pastel" preset after the
    // user had hand-edited it away from that preset.
    const project = { ...createProject(TSHIRT), variant: "pastel" };
    expect(setZone(project, "body", { color: RED }).variant).toBeUndefined();
    expect(applyColor(project, TSHIRT, RED).variant).toBeUndefined();
  });

  it("leaves other zones untouched when one is edited", () => {
    const before = createProject(TSHIRT);
    const after = setZone(before, "body", { color: RED });
    expect(after.zones.collar).toEqual(before.zones.collar);
  });

  it("ignores an edit to a zone the model does not have", () => {
    const before = createProject(TSHIRT);
    expect(setZone(before, "nonexistent", { color: RED })).toBe(before);
  });

  it("lists the palette in use without duplicates", () => {
    const project = applyColor(createProject(TSHIRT), TSHIRT, RED);
    const palette = projectPalette(project, TSHIRT);
    expect(palette[0]).toBe(RED);
    expect(new Set(palette).size).toBe(palette.length);
  });

  it("resets colors while keeping the scene the user set up", () => {
    const project = setZone(
      { ...createProject(CAR), lighting: "neon" },
      "body",
      { color: RED },
    );
    const reset = resetProject(project, CAR);
    expect(reset.zones.body.color).toBe(CAR.zones[0].defaultColor);
    expect(reset.lighting).toBe("neon");
  });
});

describe("parseProject", () => {
  it("round-trips a project it created", () => {
    const project = applyColor(createProject(SNEAKER), SNEAKER, RED);
    const parsed = parseProject(JSON.parse(JSON.stringify(project)), SNEAKER);
    expect(parsed).toEqual(project);
  });

  it("rejects anything it does not recognise", () => {
    // §10 requires a failure the user can be told about, rather than a
    // half-rendered object.
    expect(parseProject(null, SNEAKER)).toBeNull();
    expect(parseProject("not an object", SNEAKER)).toBeNull();
    expect(parseProject({ version: 2, objectId: "x", zones: {} }, SNEAKER)).toBeNull();
    expect(parseProject({ version: 1, zones: {} }, SNEAKER)).toBeNull();
  });

  it("fills in a zone the model gained since the creation was saved", () => {
    const stored = { version: 1, objectId: SNEAKER.id, zones: { body: { color: RED, material: "leather", opacity: 1 } } };
    const parsed = parseProject(stored, SNEAKER);
    expect(parsed?.zones.body.color).toBe(RED);
    for (const zone of SNEAKER.zones) expect(parsed?.zones[zone.id]).toBeDefined();
  });

  it("keeps render settings it did not store at their defaults", () => {
    const stored = { version: 1, objectId: CAR.id, zones: {}, render: { gloss: 0.9 } };
    const parsed = parseProject(stored, CAR);
    expect(parsed?.render.gloss).toBe(0.9);
    expect(parsed?.render.shadows).toBe(DEFAULT_RENDER_SETTINGS.shadows);
  });
});
