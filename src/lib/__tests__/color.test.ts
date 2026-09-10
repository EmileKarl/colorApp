import {
  colorDistance,
  colorLocalId,
  getColorFamily,
  hexToRgb,
  hslToRgb,
  isSameColor,
  isValidHex,
  nearestNamedColor,
  normalizeHex,
  rgbToHex,
  rgbToHsl,
} from "../color";

describe("hex <-> rgb", () => {
  it("converts a 6-digit hex to rgb", () => {
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("00ff00")).toEqual({ r: 0, g: 255, b: 0 });
  });

  it("expands and converts a 3-digit hex", () => {
    expect(hexToRgb("#0f0")).toEqual({ r: 0, g: 255, b: 0 });
  });

  it("round-trips rgb -> hex", () => {
    expect(rgbToHex({ r: 18, g: 52, b: 86 })).toBe("#123456");
  });

  it("clamps out-of-range channel values", () => {
    expect(rgbToHex({ r: 300, g: -10, b: 128 })).toBe("#ff0080");
  });

  it("rejects invalid hex strings", () => {
    expect(isValidHex("not-a-color")).toBe(false);
    expect(() => hexToRgb("not-a-color")).toThrow();
  });

  it("normalizes hex casing and shorthand", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("AABBCC")).toBe("#aabbcc");
  });
});

describe("rgb <-> hsl", () => {
  it("converts pure red to hsl", () => {
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 });
  });

  it("converts white and black correctly", () => {
    expect(rgbToHsl({ r: 255, g: 255, b: 255 })).toEqual({ h: 0, s: 0, l: 100 });
    expect(rgbToHsl({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, l: 0 });
  });

  it("round-trips hsl -> rgb within rounding tolerance", () => {
    const original = { r: 200, g: 100, b: 50 };
    const roundTripped = hslToRgb(rgbToHsl(original));
    expect(Math.abs(roundTripped.r - original.r)).toBeLessThanOrEqual(2);
    expect(Math.abs(roundTripped.g - original.g)).toBeLessThanOrEqual(2);
    expect(Math.abs(roundTripped.b - original.b)).toBeLessThanOrEqual(2);
  });
});

describe("getColorFamily", () => {
  it.each([
    [{ r: 255, g: 0, b: 0 }, "red"],
    [{ r: 0, g: 200, b: 0 }, "green"],
    [{ r: 0, g: 0, b: 255 }, "blue"],
    [{ r: 255, g: 255, b: 255 }, "white"],
    [{ r: 0, g: 0, b: 0 }, "black"],
    [{ r: 128, g: 128, b: 128 }, "gray"],
    [{ r: 139, g: 69, b: 19 }, "brown"],
  ] as const)("classifies %j as %s", (rgb, expected) => {
    expect(getColorFamily(rgb)).toBe(expected);
  });
});

describe("nearestNamedColor", () => {
  const dictionary = [
    { name: "Rouge tomate", hex: "#ff4433", family: "red" as const },
    { name: "Bleu ciel", hex: "#66ccff", family: "blue" as const },
    { name: "Vert sapin", hex: "#0b5f3c", family: "green" as const },
  ];

  it("returns the closest entry by rgb distance", () => {
    expect(nearestNamedColor("#ff4030", dictionary)?.name).toBe("Rouge tomate");
    expect(nearestNamedColor("#0b5f40", dictionary)?.name).toBe("Vert sapin");
  });

  it("returns null for an empty dictionary", () => {
    expect(nearestNamedColor("#ffffff", [])).toBeNull();
  });
});

describe("isSameColor / colorLocalId", () => {
  it("treats near-identical colors as the same community entry", () => {
    expect(isSameColor("#ff0000", "#fa0505")).toBe(true);
    expect(isSameColor("#ff0000", "#00ff00")).toBe(false);
  });

  it("derives a stable local id from a hex value", () => {
    expect(colorLocalId("#ABC")).toBe("aabbcc");
    expect(colorDistance({ r: 0, g: 0, b: 0 }, { r: 0, g: 0, b: 0 })).toBe(0);
  });
});
