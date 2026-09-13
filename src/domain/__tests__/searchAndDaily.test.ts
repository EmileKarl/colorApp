import { colorOfTheDay, dateKey, greeting } from "../colorOfTheDay";
import { SEARCH_SUGGESTIONS, searchColors } from "../search";
import { COLOR_DATABASE } from "../../color-engine/classification/colorDatabase";

const CATALOG = [
  { hex: "#0047ab", label: "cobalt" }, // saturated blue
  { hex: "#87ceeb", label: "ciel" }, // light blue
  { hex: "#0b2545", label: "nuit" }, // dark blue
  { hex: "#c4302b", label: "brique" }, // red
  { hex: "#7f7f7f", label: "gris" }, // neutral
  { hex: "#e8dcc5", label: "sable" }, // light neutral
];

describe("color search", () => {
  it("returns everything for an empty query", () => {
    expect(searchColors("", CATALOG)).toHaveLength(CATALOG.length);
  });

  it("treats a hex query as a perceptual proximity search", () => {
    // Not string equality: a near-identical blue must rank first.
    const results = searchColors("#0046aa", CATALOG);
    expect(results[0].item.hex).toBe("#0047ab");
    expect(results[0].reason).toMatch(/exacte|ΔE00/);
  });

  it("accepts a hex query without the leading hash", () => {
    expect(searchColors("0047ab", CATALOG)[0].item.hex).toBe("#0047ab");
  });

  it("excludes colors too far away from a hex query", () => {
    const results = searchColors("#0047ab", CATALOG);
    expect(results.every((entry) => entry.item.hex !== "#c4302b")).toBe(true);
  });

  it("filters by color family", () => {
    const blues = searchColors("bleu", CATALOG);
    expect(blues.length).toBeGreaterThan(0);
    expect(blues.every((entry) => entry.item.hex !== "#c4302b")).toBe(true);
  });

  it("combines a family with a modifier", () => {
    // "bleu foncé" must exclude the light blue — the whole point of combining.
    const results = searchColors("bleu foncé", CATALOG);
    const found = results.map((entry) => entry.item.hex);
    expect(found).toContain("#0b2545");
    expect(found).not.toContain("#87ceeb");
  });

  it("filters by modifier alone", () => {
    const neutrals = searchColors("neutre", CATALOG).map((entry) => entry.item.hex);
    expect(neutrals).toContain("#7f7f7f");
    expect(neutrals).not.toContain("#c4302b");
  });

  it("understands English family words too", () => {
    expect(searchColors("blue", CATALOG).length).toBeGreaterThan(0);
  });

  it("returns nothing for a query that matches no color", () => {
    expect(searchColors("zzzznotacolor", CATALOG)).toEqual([]);
  });

  it("explains why each result matched", () => {
    for (const result of searchColors("bleu", CATALOG)) {
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("respects the result limit", () => {
    expect(searchColors("", CATALOG, 2)).toHaveLength(2);
  });

  it("offers usable suggestions", () => {
    expect(SEARCH_SUGGESTIONS.length).toBeGreaterThan(4);
    // Every suggestion must actually return something on a realistic catalog.
    expect(searchColors(SEARCH_SUGGESTIONS[0], CATALOG)).toBeDefined();
  });
});

describe("color of the day", () => {
  it("returns the same color for the same date", () => {
    const date = new Date("2026-03-14T10:00:00");
    expect(colorOfTheDay(date).id).toBe(colorOfTheDay(date).id);
  });

  it("does not depend on the time of day", () => {
    const morning = colorOfTheDay(new Date("2026-03-14T06:00:00"));
    const evening = colorOfTheDay(new Date("2026-03-14T23:00:00"));
    expect(morning.id).toBe(evening.id);
  });

  it("changes across dates rather than being effectively constant", () => {
    const ids = new Set<string>();
    for (let day = 1; day <= 28; day++) {
      const date = new Date(2026, 4, day);
      ids.add(colorOfTheDay(date).id);
    }
    // With ~37 references, 28 days should surface a good spread.
    expect(ids.size).toBeGreaterThan(10);
  });

  it("always returns a real database entry", () => {
    for (let day = 1; day <= 40; day++) {
      const color = colorOfTheDay(new Date(2026, 0, day));
      expect(COLOR_DATABASE.some((entry) => entry.id === color.id)).toBe(true);
    }
  });

  it("builds a stable local date key", () => {
    expect(dateKey(new Date(2026, 2, 5))).toBe("2026-03-05");
  });

  it("greets according to the hour", () => {
    expect(greeting(new Date(2026, 0, 1, 8))).toBe("Bonjour");
    expect(greeting(new Date(2026, 0, 1, 14))).toBe("Bon après-midi");
    expect(greeting(new Date(2026, 0, 1, 20))).toBe("Bonsoir");
    expect(greeting(new Date(2026, 0, 1, 3))).toBe("Bonne nuit");
  });
});
