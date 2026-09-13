import { deltaE2000 } from "../../color-engine/metrics/deltaE2000";
import { rgbToLab } from "../../color-engine/color-spaces/lab";
import { hexToLch } from "../../objects/renderer/shading";
import { hexToRgb } from "../../lib/color";
import {
  brightnessOf,
  colorFacts,
  rgbToCmyk,
  saturationOf,
  temperatureOf,
} from "../colorFacts";
import {
  adjustChroma,
  adjustLightness,
  mixColors,
  pushMix,
  surpriseColor,
  tonalRamp,
} from "../colorMix";
import { buildColorStory } from "../colorStory";
import { paletteMetrics, paletteMoods, suggestedUses } from "../paletteMood";

describe("CMYK approximation", () => {
  it("converts the primaries the way the formula defines", () => {
    expect(rgbToCmyk("#ff0000")).toEqual({ c: 0, m: 100, y: 100, k: 0 });
    expect(rgbToCmyk("#00ff00")).toEqual({ c: 100, m: 0, y: 100, k: 0 });
    expect(rgbToCmyk("#0000ff")).toEqual({ c: 100, m: 100, y: 0, k: 0 });
    expect(rgbToCmyk("#ffffff")).toEqual({ c: 0, m: 0, y: 0, k: 0 });
  });

  it("reports pure black as K only", () => {
    // The chromatic channels are a division by zero here; anything other than
    // zero would be invented.
    expect(rgbToCmyk("#000000")).toEqual({ c: 0, m: 0, y: 0, k: 100 });
  });

  it("keeps every channel inside 0–100", () => {
    for (const hex of ["#c4302b", "#0047ab", "#f2c200", "#1e824c", "#7f7f7f", "#010203"]) {
      const cmyk = rgbToCmyk(hex);
      for (const value of [cmyk.c, cmyk.m, cmyk.y, cmyk.k]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("temperature", () => {
  it("calls reds and oranges warm", () => {
    expect(temperatureOf("#c4302b")).toBe("warm");
    expect(temperatureOf("#e8730c")).toBe("warm");
  });

  it("calls blues and cyans cool", () => {
    expect(temperatureOf("#0047ab")).toBe("cool");
    expect(temperatureOf("#00a2c7")).toBe("cool");
  });

  it("refuses to read a temperature off a near-grey", () => {
    // A near-neutral has a hue angle, but it is rounding noise. Calling it
    // warm would be reporting that noise as a finding.
    expect(temperatureOf("#807e7d")).toBe("neutral");
    expect(temperatureOf("#7f7f7f")).toBe("neutral");
  });
});

describe("brightness and saturation bands", () => {
  it("orders brightness monotonically with lightness", () => {
    const order = ["very_dark", "dark", "medium", "light", "very_light"];
    const samples = ["#0a0a0a", "#3a3a3a", "#808080", "#c9c9c9", "#f7f7f7"];
    const found = samples.map((hex) => order.indexOf(brightnessOf(hex)));
    for (let i = 1; i < found.length; i++) expect(found[i]).toBeGreaterThan(found[i - 1]);
  });

  it("calls a grey desaturated and a pure primary intense", () => {
    expect(saturationOf("#808080")).toBe("muted");
    expect(saturationOf("#ff0000")).toBe("intense");
  });

  it("reports lightness, chroma and hue alongside the labels", () => {
    const facts = colorFacts("#0047ab");
    expect(facts.chroma).toBeGreaterThan(40);
    expect(facts.hue).toBeGreaterThan(250);
    expect(facts.hue).toBeLessThan(320);
  });
});

describe("mixing in Lab", () => {
  it("does not turn blue and yellow into mud", () => {
    // The canonical sRGB-averaging failure: (#0000ff + #ffff00) / 2 in sRGB is
    // #7f7f7f, a dead grey. In Lab the midpoint keeps real chroma.
    const midpoint = mixColors("#0000ff", "#ffff00", 0.5);
    expect(hexToLch(midpoint).C).toBeGreaterThan(20);
  });

  it("returns the endpoints exactly at 0 and 1", () => {
    // Small rounding through Lab is acceptable; a visible shift is not.
    expect(deltaE2000(rgbToLab(hexToRgb(mixColors("#c4302b", "#0047ab", 0))), rgbToLab(hexToRgb("#c4302b")))).toBeLessThan(1);
    expect(deltaE2000(rgbToLab(hexToRgb(mixColors("#c4302b", "#0047ab", 1))), rgbToLab(hexToRgb("#0047ab")))).toBeLessThan(1);
  });

  it("moves monotonically along the ratio", () => {
    const a = "#0047ab";
    const b = "#f2c200";
    let previous = 0;
    for (let ratio = 0; ratio <= 1.0001; ratio += 0.1) {
      const distance = deltaE2000(
        rgbToLab(hexToRgb(a)),
        rgbToLab(hexToRgb(mixColors(a, b, ratio))),
      );
      expect(distance).toBeGreaterThanOrEqual(previous - 0.5);
      previous = distance;
    }
  });

  it("clamps a ratio outside 0–1 instead of extrapolating", () => {
    expect(mixColors("#c4302b", "#0047ab", -1)).toBe(mixColors("#c4302b", "#0047ab", 0));
    expect(mixColors("#c4302b", "#0047ab", 5)).toBe(mixColors("#c4302b", "#0047ab", 1));
  });
});

describe("lightness and chroma adjustment", () => {
  it("moves in the direction asked and keeps the hue", () => {
    const source = "#c4302b";
    const lighter = adjustLightness(source, 20);
    expect(hexToLch(lighter).L).toBeGreaterThan(hexToLch(source).L);
    expect(Math.abs(hexToLch(lighter).h - hexToLch(source).h)).toBeLessThan(6);
  });

  it("cannot push chroma below zero into the opposite hue", () => {
    const result = hexToLch(adjustChroma("#807e7d", -50));
    expect(result.C).toBeGreaterThanOrEqual(0);
  });
});

describe("tonal ramp", () => {
  it("produces distinct steps from dark to light", () => {
    const ramp = tonalRamp("#0047ab", 9);
    expect(ramp).toHaveLength(9);
    const lightnesses = ramp.map((hex) => hexToLch(hex).L);
    for (let i = 1; i < lightnesses.length; i++) {
      expect(lightnesses[i]).toBeGreaterThan(lightnesses[i - 1]);
    }
    // Every step must be visibly different, or the ramp is decorative.
    expect(new Set(ramp).size).toBe(ramp.length);
  });
});

describe("surprise color", () => {
  it("is deterministic when the randomness is", () => {
    const fixed = () => 0.42;
    expect(surpriseColor(fixed)).toBe(surpriseColor(fixed));
  });

  it("never returns a muddy mid-grey", () => {
    // The reason it samples in LCh rather than three random bytes: random RGB
    // lands in the desaturated middle most of the time.
    let value = 0;
    const cycling = () => {
      value = (value + 0.137) % 1;
      return value;
    };
    for (let index = 0; index < 40; index++) {
      expect(hexToLch(surpriseColor(cycling)).C).toBeGreaterThan(12);
    }
  });
});

describe("mix history", () => {
  const entry = (result: string) => ({ a: "#000000", b: "#ffffff", ratio: 0.5, result });

  it("keeps the newest first", () => {
    const history = pushMix(pushMix([], entry("#111111")), entry("#222222"));
    expect(history[0].result).toBe("#222222");
  });

  it("does not fill up with one slider drag", () => {
    let history: ReturnType<typeof entry>[] = [];
    for (let index = 0; index < 20; index++) history = pushMix(history, entry("#333333"));
    expect(history).toHaveLength(1);
  });

  it("caps its length", () => {
    let history: ReturnType<typeof entry>[] = [];
    for (let index = 0; index < 30; index++) {
      history = pushMix(history, entry(`#0000${index.toString(16).padStart(2, "0")}`));
    }
    expect(history.length).toBeLessThanOrEqual(12);
  });
});

describe("palette metrics", () => {
  it("measures angular hue spread across the 0/360 wrap", () => {
    // Naive max-minus-min would report 340° for hues at 350 and 10, which are
    // actually 20° apart. Every mood score depends on getting this right.
    const nearWrap = paletteMetrics(["#ff0033", "#ff3300"]);
    expect(nearWrap.hueSpread).toBeLessThan(90);
  });

  it("ignores near-greys when measuring hue", () => {
    const withGrey = paletteMetrics(["#0047ab", "#0a5fd0", "#808080"]);
    expect(withGrey.hueSpread).toBeLessThan(60);
  });

  it("finds the highest contrast pair", () => {
    const metrics = paletteMetrics(["#000000", "#ffffff", "#808080"]);
    expect(metrics.maxContrast).toBeGreaterThan(20);
  });
});

describe("palette moods", () => {
  it("ranks all nine readings with a reason each", () => {
    const moods = paletteMoods(["#c4302b", "#f2c200", "#7a3b1d"]);
    expect(moods).toHaveLength(9);
    for (const mood of moods) {
      expect(mood.reason.length).toBeGreaterThan(0);
      expect(mood.score).toBeGreaterThanOrEqual(0);
      expect(mood.score).toBeLessThanOrEqual(1);
    }
  });

  it("is sorted best first", () => {
    const moods = paletteMoods(["#111111", "#1c1c22", "#d4af37"]);
    for (let i = 1; i < moods.length; i++) {
      expect(moods[i].score).toBeLessThanOrEqual(moods[i - 1].score);
    }
  });

  it("reads a dark restrained palette as more luxurious than a vivid one", () => {
    const score = (palette: string[], mood: string) =>
      paletteMoods(palette).find((entry) => entry.mood === mood)!.score;
    expect(score(["#141414", "#1f1d1a", "#2b2723"], "luxurious")).toBeGreaterThan(
      score(["#ff2d00", "#00d4ff", "#ffe400"], "luxurious"),
    );
  });

  it("reads a bright wide-hue palette as more energetic than a muted one", () => {
    const score = (palette: string[], mood: string) =>
      paletteMoods(palette).find((entry) => entry.mood === mood)!.score;
    expect(score(["#ff2d00", "#00d4ff", "#ffe400"], "energetic")).toBeGreaterThan(
      score(["#8a8378", "#9a958c", "#77736c"], "energetic"),
    );
  });

  it("reads a pale low-chroma palette as more soft than a dark one", () => {
    const score = (palette: string[], mood: string) =>
      paletteMoods(palette).find((entry) => entry.mood === mood)!.score;
    expect(score(["#f2e9e0", "#e8dcd2", "#f7f1ea"], "soft")).toBeGreaterThan(
      score(["#141414", "#221f1c", "#0d0d0f"], "soft"),
    );
  });

  it("returns nothing for an empty palette rather than a default reading", () => {
    expect(paletteMoods([])).toEqual([]);
  });
});

describe("suggested uses", () => {
  it("only suggests UI when a pair actually passes WCAG AA", () => {
    // The point of the whole module: a palette that cannot carry readable text
    // must not be suggested for interfaces, at any rank.
    const readable = suggestedUses(["#111111", "#ffffff"]).map((entry) => entry.use);
    expect(readable).toContain("ui");

    const unreadable = suggestedUses(["#8a8a8a", "#949494", "#909090"]).map((entry) => entry.use);
    expect(unreadable).not.toContain("ui");
  });

  it("explains every suggestion with a measurement", () => {
    for (const suggestion of suggestedUses(["#0047ab", "#f2c200", "#ffffff"])) {
      expect(suggestion.reason.length).toBeGreaterThan(0);
    }
  });

  it("suggests nothing for an empty palette", () => {
    expect(suggestedUses([])).toEqual([]);
  });
});

describe("color story", () => {
  it("builds a story from measurements", () => {
    const story = buildColorStory(["#c4302b", "#0b2545", "#e8dcc5"], "Sneaker basse");
    expect(story).not.toBeNull();
    expect(story!.title).toContain("Sneaker basse");
    expect(story!.description.length).toBeGreaterThan(40);
    expect(story!.keywords.length).toBeGreaterThan(2);
    expect(story!.style.length).toBeGreaterThan(0);
  });

  it("is deterministic — the same palette always tells the same story", () => {
    const palette = ["#0047ab", "#f2c200"];
    expect(buildColorStory(palette)).toEqual(buildColorStory(palette));
  });

  it("includes the measurement behind its aesthetic claim", () => {
    // The description must remain auditable: the user can see the number the
    // adjective came from and disagree with it.
    const story = buildColorStory(["#141414", "#1f1d1a", "#d4af37"]);
    expect(story!.description).toMatch(/\d/);
  });

  it("returns null rather than inventing a story for nothing", () => {
    expect(buildColorStory([])).toBeNull();
  });

  it("recommends materials that exist", () => {
    const story = buildColorStory(["#c4302b", "#111111"]);
    expect(story!.materials.length).toBeGreaterThan(0);
  });
});
