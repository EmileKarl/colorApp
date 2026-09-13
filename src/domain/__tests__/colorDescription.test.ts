import { describeColor } from "../colorDescription";

/**
 * Every saved color's rgb/hsl/hsv/lab columns come from this function, so a
 * drift here would silently corrupt stored data rather than throwing.
 */
describe("describeColor", () => {
  it("derives every color space the schema stores", () => {
    const described = describeColor("#0047ab");
    expect(described.rgb).toEqual({ r: 0, g: 71, b: 171 });
    expect(described.hsl.h).toBeGreaterThan(200);
    expect(described.hsl.h).toBeLessThan(230);
    expect(described.hsv.v).toBeCloseTo(171 / 255, 5);
    expect(described.family).toBe("blue");
  });

  it("agrees with the reference Lab values for pure white and black", () => {
    // White under D65 is L*=100, a*=b*=0 by definition; black is L*=0. These
    // are the two anchors of the CIELAB scale, so if either drifts the whole
    // stored lab column is wrong.
    const white = describeColor("#ffffff");
    expect(white.lab.L).toBeCloseTo(100, 3);
    expect(white.lab.a).toBeCloseTo(0, 3);
    expect(white.lab.b).toBeCloseTo(0, 3);

    const black = describeColor("#000000");
    expect(black.lab.L).toBeCloseTo(0, 6);
  });

  it("is case-insensitive about the input hex", () => {
    expect(describeColor("#0047AB")).toEqual(describeColor("#0047ab"));
  });

  it("produces a family that matches the hue it derived", () => {
    expect(describeColor("#c4302b").family).toBe("red");
    expect(describeColor("#1e824c").family).toBe("green");
    // A near-neutral must not be classified by its faint hue.
    expect(describeColor("#7f7f7f").family).toBe("gray");
  });
});
