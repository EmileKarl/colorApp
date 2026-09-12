import { hsvToRgb, hueDistance, meanHue, rgbToHsv } from "../color-spaces/hsv";
import { labToLch, labToRgb, lchToLab, rgbToLab, xyzToLab } from "../color-spaces/lab";
import {
  delinearizeChannel,
  linearizeChannel,
  linearToRgb,
  relativeLuminance,
  rgbToLinear,
} from "../color-spaces/srgb";
import { D50, D65, adaptWhitePoint, rgbToXyz, xyzToRgb } from "../color-spaces/xyz";

const closeTo = (actual: number, expected: number, digits = 3) =>
  expect(actual).toBeCloseTo(expected, digits);

describe("sRGB transfer function", () => {
  it("maps the endpoints exactly", () => {
    closeTo(linearizeChannel(0), 0, 10);
    closeTo(linearizeChannel(1), 1, 10);
  });

  it("uses the linear segment below the 0.04045 threshold", () => {
    // Inside the linear segment the relation is exactly c/12.92.
    closeTo(linearizeChannel(0.04), 0.04 / 12.92, 10);
  });

  it("puts mid-gray well below 0.5 in linear light", () => {
    // The classic gamma gotcha: 50% encoded is ~21.4% of the light.
    closeTo(linearizeChannel(0.5), 0.2140, 3);
  });

  it("round-trips encode/decode for every 8-bit level", () => {
    for (let i = 0; i <= 255; i++) {
      const back = delinearizeChannel(linearizeChannel(i / 255)) * 255;
      expect(Math.abs(back - i)).toBeLessThan(1e-6);
    }
  });

  it("round-trips rgbToLinear/linearToRgb", () => {
    const original = { r: 12, g: 187, b: 240 };
    expect(linearToRgb(rgbToLinear(original))).toEqual(original);
  });
});

describe("relative luminance", () => {
  it("returns 0 for black and 1 for white", () => {
    closeTo(relativeLuminance({ r: 0, g: 0, b: 0 }), 0, 10);
    closeTo(relativeLuminance({ r: 255, g: 255, b: 255 }), 1, 10);
  });

  it("ranks primaries by their Rec. 709 weights", () => {
    const red = relativeLuminance({ r: 255, g: 0, b: 0 });
    const green = relativeLuminance({ r: 0, g: 255, b: 0 });
    const blue = relativeLuminance({ r: 0, g: 0, b: 255 });
    closeTo(red, 0.2126, 4);
    closeTo(green, 0.7152, 4);
    closeTo(blue, 0.0722, 4);
    expect(green).toBeGreaterThan(red);
    expect(red).toBeGreaterThan(blue);
  });
});

describe("XYZ conversion", () => {
  it("maps sRGB white to the D65 white point", () => {
    const xyz = rgbToXyz({ r: 255, g: 255, b: 255 });
    closeTo(xyz.x, D65.x, 3);
    closeTo(xyz.y, D65.y, 3);
    closeTo(xyz.z, D65.z, 3);
  });

  it("maps black to the origin", () => {
    const xyz = rgbToXyz({ r: 0, g: 0, b: 0 });
    closeTo(xyz.x, 0, 10);
    closeTo(xyz.y, 0, 10);
    closeTo(xyz.z, 0, 10);
  });

  it("round-trips sRGB through XYZ", () => {
    for (const rgb of [
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 128, b: 64 },
      { r: 18, g: 52, b: 86 },
      { r: 250, g: 250, b: 210 },
    ]) {
      expect(xyzToRgb(rgbToXyz(rgb))).toEqual(rgb);
    }
  });
});

describe("chromatic adaptation", () => {
  it("is a no-op when source and destination match", () => {
    const xyz = rgbToXyz({ r: 120, g: 90, b: 60 });
    const adapted = adaptWhitePoint(xyz, D65, D65);
    closeTo(adapted.x, xyz.x, 6);
    closeTo(adapted.y, xyz.y, 6);
    closeTo(adapted.z, xyz.z, 6);
  });

  it("maps the source white onto the destination white", () => {
    const adapted = adaptWhitePoint(D65, D65, D50);
    closeTo(adapted.x, D50.x, 4);
    closeTo(adapted.y, D50.y, 4);
    closeTo(adapted.z, D50.z, 4);
  });

  it("is reversible", () => {
    const xyz = rgbToXyz({ r: 200, g: 40, b: 90 });
    const round = adaptWhitePoint(adaptWhitePoint(xyz, D65, D50), D50, D65);
    closeTo(round.x, xyz.x, 6);
    closeTo(round.y, xyz.y, 6);
    closeTo(round.z, xyz.z, 6);
  });
});

describe("CIELAB", () => {
  it("maps the reference white to L*=100, a*=b*=0", () => {
    const lab = xyzToLab(D65);
    closeTo(lab.L, 100, 6);
    closeTo(lab.a, 0, 6);
    closeTo(lab.b, 0, 6);
  });

  it("maps black to L*=0", () => {
    const lab = rgbToLab({ r: 0, g: 0, b: 0 });
    closeTo(lab.L, 0, 6);
  });

  it("gives neutral grays zero chroma", () => {
    for (const level of [32, 64, 128, 200]) {
      const lab = rgbToLab({ r: level, g: level, b: level });
      closeTo(lab.a, 0, 2);
      closeTo(lab.b, 0, 2);
    }
  });

  it("matches published Lab values for the sRGB primaries", () => {
    // Reference values for sRGB primaries under D65 (2° observer).
    const red = rgbToLab({ r: 255, g: 0, b: 0 });
    closeTo(red.L, 53.24, 1);
    closeTo(red.a, 80.09, 1);
    closeTo(red.b, 67.2, 1);

    const green = rgbToLab({ r: 0, g: 255, b: 0 });
    closeTo(green.L, 87.73, 1);
    closeTo(green.a, -86.18, 1);
    closeTo(green.b, 83.18, 1);

    const blue = rgbToLab({ r: 0, g: 0, b: 255 });
    closeTo(blue.L, 32.3, 1);
    closeTo(blue.a, 79.19, 1);
    closeTo(blue.b, -107.86, 1);
  });

  it("puts mid-gray near L*=53.6, not 50", () => {
    // Perceptual lightness is not linear in encoded value — worth locking in,
    // because assuming #808080 is "L*=50" is a common source of drift.
    closeTo(rgbToLab({ r: 128, g: 128, b: 128 }).L, 53.585, 2);
  });

  it("round-trips sRGB through Lab", () => {
    for (const rgb of [
      { r: 10, g: 20, b: 30 },
      { r: 46, g: 134, b: 193 },
      { r: 231, g: 76, b: 60 },
      { r: 255, g: 255, b: 255 },
    ]) {
      expect(labToRgb(rgbToLab(rgb))).toEqual(rgb);
    }
  });
});

describe("LCh", () => {
  it("reports zero chroma for neutrals and leaves hue undefined-but-stable", () => {
    const lch = labToLch({ L: 50, a: 0, b: 0 });
    closeTo(lch.C, 0, 10);
    expect(lch.h).toBe(0);
  });

  it("places the four Lab axes at the expected hue angles", () => {
    closeTo(labToLch({ L: 50, a: 10, b: 0 }).h, 0, 6); // +a* = red
    closeTo(labToLch({ L: 50, a: 0, b: 10 }).h, 90, 6); // +b* = yellow
    closeTo(labToLch({ L: 50, a: -10, b: 0 }).h, 180, 6); // -a* = green
    closeTo(labToLch({ L: 50, a: 0, b: -10 }).h, 270, 6); // -b* = blue
  });

  it("computes chroma as the Euclidean norm of a* and b*", () => {
    closeTo(labToLch({ L: 50, a: 3, b: 4 }).C, 5, 10);
  });

  it("round-trips Lab through LCh", () => {
    const lab = { L: 42.5, a: -17.25, b: 38.9 };
    const back = lchToLab(labToLch(lab));
    closeTo(back.L, lab.L, 8);
    closeTo(back.a, lab.a, 8);
    closeTo(back.b, lab.b, 8);
  });
});

describe("HSV", () => {
  it("converts the primaries to canonical hue angles", () => {
    expect(rgbToHsv({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 1, v: 1 });
    closeTo(rgbToHsv({ r: 0, g: 255, b: 0 }).h, 120, 6);
    closeTo(rgbToHsv({ r: 0, g: 0, b: 255 }).h, 240, 6);
    closeTo(rgbToHsv({ r: 255, g: 255, b: 0 }).h, 60, 6);
  });

  it("reports zero saturation for grays and zero value for black", () => {
    expect(rgbToHsv({ r: 120, g: 120, b: 120 }).s).toBe(0);
    expect(rgbToHsv({ r: 0, g: 0, b: 0 })).toEqual({ h: 0, s: 0, v: 0 });
  });

  it("round-trips through hsvToRgb", () => {
    for (const rgb of [
      { r: 255, g: 0, b: 0 },
      { r: 12, g: 200, b: 90 },
      { r: 90, g: 90, b: 91 },
    ]) {
      expect(hsvToRgb(rgbToHsv(rgb))).toEqual(rgb);
    }
  });
});

describe("circular hue math", () => {
  it("measures distance across the 0/360 wrap-around", () => {
    expect(hueDistance(350, 10)).toBe(20);
    expect(hueDistance(10, 350)).toBe(20);
    expect(hueDistance(0, 180)).toBe(180);
    expect(hueDistance(45, 45)).toBe(0);
  });

  it("averages hues around the wrap-around correctly", () => {
    // A plain arithmetic mean would give 180 (cyan) instead of 0 (red).
    closeTo(meanHue([350, 10]), 0, 6);
    closeTo(meanHue([10, 20, 30]), 20, 6);
  });

  it("returns 0 for an empty list or perfectly opposed hues", () => {
    expect(meanHue([])).toBe(0);
    expect(meanHue([0, 180])).toBe(0);
  });
});
