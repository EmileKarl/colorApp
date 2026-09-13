import {
  dataFormatExtension,
  exportPalette,
  slugify,
  type ExportPalette,
} from "../colorExport";

const PALETTE: ExportPalette = {
  name: "Bleu côtier",
  colors: [
    { hex: "#0047AB", role: "dominant" },
    { hex: "#87ceeb", role: "accent" },
    { hex: "#e8dcc5", role: null },
  ],
};

describe("slugify", () => {
  it("strips accents rather than escaping them", () => {
    // `--bleu-cotier` works everywhere; `--bleu-côtier` is legal CSS but
    // breaks build tools that assume ASCII identifiers.
    expect(slugify("Bleu côtier")).toBe("bleu-cotier");
    expect(slugify("Été à Paris")).toBe("ete-a-paris");
  });

  it("never produces an identifier starting with a digit", () => {
    // Illegal in CSS custom properties without escaping.
    expect(slugify("2024 collection")).toBe("c-2024-collection");
  });

  it("falls back to a usable name rather than an empty one", () => {
    expect(slugify("")).toBe("palette");
    expect(slugify("!!!")).toBe("palette");
  });

  it("collapses separators instead of stacking dashes", () => {
    expect(slugify("rouge   /  orange")).toBe("rouge-orange");
  });
});

describe("palette export", () => {
  it("normalises hex casing so exports are consistent", () => {
    expect(exportPalette(PALETTE, "hex")).toContain("#0047AB");
    expect(exportPalette(PALETTE, "json")).toContain('"#0047ab"');
  });

  it("exports one color per line for the plain formats", () => {
    expect(exportPalette(PALETTE, "hex").split("\n")).toHaveLength(3);
    expect(exportPalette(PALETTE, "rgb").split("\n")).toHaveLength(3);
    expect(exportPalette(PALETTE, "hsl").split("\n")).toHaveLength(3);
  });

  it("writes RGB and HSL in the notation CSS actually accepts", () => {
    expect(exportPalette(PALETTE, "rgb")).toMatch(/^rgb\(0, 71, 171\)/);
    expect(exportPalette(PALETTE, "hsl")).toMatch(/^hsl\(\d+, \d+%, \d+%\)/);
  });

  it("produces parseable JSON carrying every space the app measured", () => {
    const parsed = JSON.parse(exportPalette(PALETTE, "json"));
    expect(parsed.name).toBe("Bleu côtier");
    expect(parsed.colors).toHaveLength(3);
    for (const color of parsed.colors) {
      expect(color.rgb).toBeDefined();
      expect(color.hsl).toBeDefined();
      expect(color.lch).toBeDefined();
      expect(color.cmyk).toBeDefined();
    }
  });

  it("names CSS variables by role, and by position when there is none", () => {
    const css = exportPalette(PALETTE, "css");
    expect(css).toContain("--bleu-cotier-dominant: #0047ab;");
    expect(css).toContain("--bleu-cotier-accent: #87ceeb;");
    // The third color has no role, so it falls back to its position.
    expect(css).toContain("--bleu-cotier-3: #e8dcc5;");
    expect(css.startsWith(":root {")).toBe(true);
    expect(css.trimEnd().endsWith("}")).toBe(true);
  });

  it("emits design tokens in the W3C draft shape", () => {
    // The shape Figma, Style Dictionary and most token pipelines consume.
    const parsed = JSON.parse(exportPalette(PALETTE, "tokens"));
    expect(parsed["bleu-cotier"].dominant).toEqual({ $type: "color", $value: "#0047ab" });
  });

  it("emits an SVG strip whose swatches tile the full width", () => {
    const svg = exportPalette(PALETTE, "svg");
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.match(/<rect/g)).toHaveLength(3);
    expect(svg).toContain('fill="#0047ab"');
  });

  it("handles a single-color palette without dividing by zero", () => {
    const svg = exportPalette({ name: "Un", colors: [{ hex: "#111111" }] }, "svg");
    expect(svg).toContain('width="100.000"');
  });

  it("handles an empty palette without producing broken output", () => {
    const empty: ExportPalette = { name: "Vide", colors: [] };
    expect(exportPalette(empty, "hex")).toBe("");
    expect(() => JSON.parse(exportPalette(empty, "json"))).not.toThrow();
    expect(() => JSON.parse(exportPalette(empty, "tokens"))).not.toThrow();
    expect(exportPalette(empty, "css")).toBe(":root {\n}");
  });

  it("gives each format the right file extension", () => {
    expect(dataFormatExtension("json")).toBe("json");
    expect(dataFormatExtension("tokens")).toBe("json");
    expect(dataFormatExtension("css")).toBe("css");
    expect(dataFormatExtension("svg")).toBe("svg");
    expect(dataFormatExtension("hex")).toBe("txt");
  });
});
