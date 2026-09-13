import { CAR, SNEAKER, TSHIRT } from "../../objects/models";
import { applyColor, createProject } from "../../objects/project";
import { hexToLch } from "../../objects/renderer/shading";
import {
  ADJUSTMENTS,
  VARIANTS,
  VARIANT_BY_ID,
  applyAdjustment,
  applyVariant,
  sourceColorOf,
  variantColors,
} from "../variants";

const SOURCE = "#c4302b";

/** Mean lightness across an object's zones, for comparing whole variants. */
function meanLightness(colors: Record<string, string>): number {
  const values = Object.values(colors).map((hex) => hexToLch(hex).L);
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function meanChroma(colors: Record<string, string>): number {
  const values = Object.values(colors).map((hex) => hexToLch(hex).C);
  return values.reduce((total, value) => total + value, 0) / values.length;
}

describe("variant catalogue", () => {
  it("provides the ten presets page 15 lists", () => {
    expect(VARIANTS).toHaveLength(10);
    for (const id of [
      "original",
      "monochrome",
      "dark",
      "pastel",
      "premium",
      "contrast",
      "sport",
      "streetwear",
      "futuristic",
      "minimal",
    ] as const) {
      expect(VARIANT_BY_ID[id]).toBeDefined();
    }
  });

  it("labels and describes every variant", () => {
    for (const variant of VARIANTS) {
      expect(variant.label.length).toBeGreaterThan(0);
      expect(variant.description.length).toBeGreaterThan(0);
    }
  });

  it("produces a valid color for every zone of every object", () => {
    for (const model of [TSHIRT, SNEAKER, CAR]) {
      for (const variant of VARIANTS) {
        const colors = variantColors(variant, model, SOURCE);
        for (const zone of model.zones) {
          expect(colors[zone.id]).toMatch(/^#[0-9a-f]{6}$/);
        }
      }
    }
  });
});

describe("variants mean what they are called", () => {
  // These are the properties that make the names honest. A user who taps
  // "Pastel" and gets something darker than "Sombre" has been lied to, and
  // that is exactly the kind of drift a table of magic numbers invites.
  const colorsFor = (id: (typeof VARIANTS)[number]["id"]) =>
    variantColors(VARIANT_BY_ID[id], SNEAKER, SOURCE);

  it("makes Pastel lighter than Sombre", () => {
    expect(meanLightness(colorsFor("pastel"))).toBeGreaterThan(
      meanLightness(colorsFor("dark")) + 20,
    );
  });

  it("makes Pastel less saturated than Sportif", () => {
    expect(meanChroma(colorsFor("pastel"))).toBeLessThan(meanChroma(colorsFor("sport")));
  });

  it("makes Minimaliste the least saturated preset", () => {
    const minimal = meanChroma(colorsFor("minimal"));
    for (const variant of VARIANTS) {
      if (variant.id === "minimal" || variant.id === "original") continue;
      expect(minimal).toBeLessThanOrEqual(meanChroma(colorsFor(variant.id)));
    }
  });

  it("makes Premium dark overall with one bright accent", () => {
    const colors = colorsFor("premium");
    expect(meanLightness(colors)).toBeLessThan(45);
    // The logo is the sneaker's accent role.
    expect(hexToLch(colors.logo).L).toBeGreaterThan(hexToLch(colors.body).L + 25);
  });

  it("gives Contrasté both a near-white and a near-black zone", () => {
    const lightnesses = Object.values(colorsFor("contrast")).map((hex) => hexToLch(hex).L);
    expect(Math.max(...lightnesses)).toBeGreaterThan(88);
    expect(Math.min(...lightnesses)).toBeLessThan(20);
  });

  it("keeps Minimaliste's zones close together in lightness", () => {
    const lightnesses = Object.values(colorsFor("minimal")).map((hex) => hexToLch(hex).L);
    expect(Math.max(...lightnesses) - Math.min(...lightnesses)).toBeLessThan(45);
  });

  it("moves Futuriste's hue toward cyan without inventing a new color", () => {
    const source = hexToLch(SOURCE);
    const body = hexToLch(colorsFor("futuristic").body);
    // A shift, not a replacement: the rotation is bounded, so the result is
    // still recognisably derived from what the user captured.
    const shift = ((body.h - source.h + 540) % 360) - 180;
    expect(shift).toBeGreaterThan(10);
    expect(shift).toBeLessThan(90);
  });
});

describe("applyVariant", () => {
  it("recolors zones without touching materials, lighting or render", () => {
    const project = applyColor(createProject(SNEAKER, { lighting: "neon" }), SNEAKER, SOURCE);
    const applied = applyVariant(project, SNEAKER, VARIANT_BY_ID.premium, SOURCE);

    // §15: form, volumes, proportions, zones, shadows and materials must all
    // be preserved. Materials and lighting are the two this function could
    // plausibly damage.
    expect(applied.lighting).toBe("neon");
    expect(applied.render).toEqual(project.render);
    for (const zone of SNEAKER.zones) {
      expect(applied.zones[zone.id].material).toBe(project.zones[zone.id].material);
      expect(Object.keys(applied.zones)).toContain(zone.id);
    }
  });

  it("records which preset produced the state", () => {
    const project = createProject(TSHIRT);
    expect(applyVariant(project, TSHIRT, VARIANT_BY_ID.pastel, SOURCE).variant).toBe("pastel");
  });

  it("leaves colors alone for Original", () => {
    const project = applyColor(createProject(CAR), CAR, SOURCE);
    const applied = applyVariant(project, CAR, VARIANT_BY_ID.original, SOURCE);
    for (const zone of CAR.zones) {
      expect(applied.zones[zone.id].color).toBe(project.zones[zone.id].color);
    }
  });

  it("derives from the body zone's current color", () => {
    const project = applyColor(createProject(SNEAKER), SNEAKER, "#0047ab");
    expect(sourceColorOf(project, SNEAKER)).toBe("#0047ab");
  });
});

describe("adjustments", () => {
  it("offers the seven requests page 15 lists", () => {
    expect(ADJUSTMENTS).toHaveLength(7);
  });

  const base = applyColor(createProject(SNEAKER), SNEAKER, SOURCE);
  const chromaOf = (project: typeof base) =>
    meanChroma(
      Object.fromEntries(SNEAKER.zones.map((zone) => [zone.id, project.zones[zone.id].color])),
    );

  it("saturates on 'plus coloré' and desaturates on 'plus discret'", () => {
    const bolder = applyAdjustment(base, SNEAKER, ADJUSTMENTS.find((a) => a.id === "more_colorful")!);
    const subtler = applyAdjustment(base, SNEAKER, ADJUSTMENTS.find((a) => a.id === "subtler")!);
    expect(chromaOf(bolder)).toBeGreaterThan(chromaOf(base));
    expect(chromaOf(subtler)).toBeLessThan(chromaOf(base));
  });

  it("composes, so asking twice goes twice as far", () => {
    // This is what makes the buttons feel like a conversation with the object
    // rather than a set of mutually-exclusive presets.
    const adjustment = ADJUSTMENTS.find((a) => a.id === "more_colorful")!;
    const once = applyAdjustment(base, SNEAKER, adjustment);
    const twice = applyAdjustment(once, SNEAKER, adjustment);
    expect(chromaOf(twice)).toBeGreaterThan(chromaOf(once));
  });

  it("pulls zones together on 'plus minimaliste'", () => {
    const adjustment = ADJUSTMENTS.find((a) => a.id === "more_minimal")!;
    const spread = (project: typeof base) => {
      const values = SNEAKER.zones.map((zone) => hexToLch(project.zones[zone.id].color).L);
      return Math.max(...values) - Math.min(...values);
    };
    // Start from a preset with a real spread, since a freshly-applied single
    // color has almost none to reduce.
    const varied = applyVariant(base, SNEAKER, VARIANT_BY_ID.contrast, SOURCE);
    expect(spread(applyAdjustment(varied, SNEAKER, adjustment))).toBeLessThan(spread(varied));
  });

  it("pushes zones apart on 'plus audacieux'", () => {
    const adjustment = ADJUSTMENTS.find((a) => a.id === "bolder")!;
    const spread = (project: typeof base) => {
      const values = SNEAKER.zones.map((zone) => hexToLch(project.zones[zone.id].color).L);
      return Math.max(...values) - Math.min(...values);
    };
    const varied = applyVariant(base, SNEAKER, VARIANT_BY_ID.streetwear, SOURCE);
    expect(spread(applyAdjustment(varied, SNEAKER, adjustment))).toBeGreaterThan(spread(varied));
  });

  it("clears the preset marker, since the state is no longer that preset", () => {
    const preset = applyVariant(base, SNEAKER, VARIANT_BY_ID.pastel, SOURCE);
    expect(applyAdjustment(preset, SNEAKER, ADJUSTMENTS[0]).variant).toBeUndefined();
  });

  it("keeps every color inside sRGB however many times it is applied", () => {
    let project = base;
    const adjustment = ADJUSTMENTS.find((a) => a.id === "more_colorful")!;
    for (let round = 0; round < 12; round++) {
      project = applyAdjustment(project, SNEAKER, adjustment);
    }
    for (const zone of SNEAKER.zones) {
      expect(project.zones[zone.id].color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
