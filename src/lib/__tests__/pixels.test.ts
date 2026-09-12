import UPNG from "upng-js";

import { rgbToHex } from "../color";
import { base64ToBytes, cropCenter, dominantColor } from "../pixels";

/** Builds an RGBA buffer from a grid of [r,g,b] triples (alpha forced opaque). */
function makeImage(grid: [number, number, number][][]): {
  rgba: Uint8Array;
  width: number;
  height: number;
} {
  const height = grid.length;
  const width = grid[0].length;
  const rgba = new Uint8Array(width * height * 4);
  let i = 0;
  for (const row of grid) {
    for (const [r, g, b] of row) {
      rgba[i++] = r;
      rgba[i++] = g;
      rgba[i++] = b;
      rgba[i++] = 255;
    }
  }
  return { rgba, width, height };
}

function solidGrid(size: number, color: [number, number, number]) {
  return Array.from({ length: size }, () => Array.from({ length: size }, () => color));
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Independent base64 encoder, so the decoder is never tested against itself. */
function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const chunk = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += ALPHABET[(chunk >> 18) & 63] + ALPHABET[(chunk >> 12) & 63];
    out += i + 1 < bytes.length ? ALPHABET[(chunk >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? ALPHABET[chunk & 63] : "=";
  }
  return out;
}

const asciiBytes = (text: string) =>
  Uint8Array.from(Array.from(text, (char) => char.charCodeAt(0)));
const bytesToAscii = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");

describe("base64ToBytes", () => {
  // Canonical test vectors from RFC 4648 §10 — fixed known answers rather
  // than a round-trip, so a symmetric bug in both directions can't hide.
  it.each([
    ["Zg==", "f"],
    ["Zm8=", "fo"],
    ["Zm9v", "foo"],
    ["Zm9vYg==", "foob"],
    ["Zm9vYmE=", "fooba"],
    ["Zm9vYmFy", "foobar"],
  ])("decodes %s to %s (RFC 4648 vector)", (encoded, expected) => {
    expect(bytesToAscii(base64ToBytes(encoded))).toBe(expected);
  });

  it("decodes binary data covering every possible byte value", () => {
    const original = Uint8Array.from({ length: 256 }, (_, i) => i);
    expect(Array.from(base64ToBytes(bytesToBase64(original)))).toEqual(Array.from(original));
  });

  it("tolerates line breaks inside the payload", () => {
    const encoded = bytesToBase64(asciiBytes("padding matters"));
    const withNewlines = `${encoded.slice(0, 4)}\n${encoded.slice(4)}`;
    expect(bytesToAscii(base64ToBytes(withNewlines))).toBe("padding matters");
  });

  it("returns an empty result for an empty string", () => {
    expect(base64ToBytes("").length).toBe(0);
  });

  it("rejects non-ASCII input", () => {
    expect(() => base64ToBytes("éé")).toThrow();
  });
});

describe("cropCenter", () => {
  it("keeps only the centered region, ignoring the border", () => {
    // 5x5 image: red everywhere except a single green center pixel.
    const grid = solidGrid(5, [255, 0, 0]);
    grid[2][2] = [0, 255, 0];
    const { rgba, width, height } = makeImage(grid);

    const patch = cropCenter(rgba, width, height, 0.2); // -> 1x1 center pixel
    expect(Array.from(patch)).toEqual([0, 255, 0, 255]);
  });

  it("returns a square of the expected size", () => {
    const { rgba, width, height } = makeImage(solidGrid(10, [10, 20, 30]));
    const patch = cropCenter(rgba, width, height, 0.4); // 4x4 = 16 px
    expect(patch.length).toBe(4 * 4 * 4);
  });

  it("handles non-square images using the smaller side", () => {
    const grid = Array.from({ length: 4 }, () =>
      Array.from({ length: 8 }, () => [1, 2, 3] as [number, number, number]),
    );
    const { rgba, width, height } = makeImage(grid);
    const patch = cropCenter(rgba, width, height, 0.5); // min(4,8)*0.5 = 2 -> 2x2
    expect(patch.length).toBe(2 * 2 * 4);
  });

  it("never returns an empty patch, even at a tiny fraction", () => {
    const { rgba, width, height } = makeImage(solidGrid(4, [7, 7, 7]));
    expect(cropCenter(rgba, width, height, 0.01).length).toBe(4);
  });

  it("rejects dimensions that do not match the buffer", () => {
    const { rgba } = makeImage(solidGrid(2, [0, 0, 0]));
    expect(() => cropCenter(rgba, 10, 10)).toThrow();
    expect(() => cropCenter(rgba, 0, 0)).toThrow();
  });
});

describe("dominantColor", () => {
  it("returns the exact color of a uniform patch", () => {
    const { rgba } = makeImage(solidGrid(4, [12, 200, 90]));
    expect(dominantColor(rgba)).toEqual({ r: 12, g: 200, b: 90 });
  });

  it("ignores a minority highlight instead of averaging it in", () => {
    // 15 blue pixels + 1 white specular highlight: a plain average would drift
    // toward white, the dominant-bin approach should stay blue.
    const grid = solidGrid(4, [20, 40, 200]);
    grid[0][0] = [255, 255, 255];
    const { rgba } = makeImage(grid);
    expect(dominantColor(rgba)).toEqual({ r: 20, g: 40, b: 200 });
  });

  it("averages near-identical shades within the same bin", () => {
    const grid = solidGrid(2, [100, 100, 100]);
    grid[0][0] = [102, 100, 100];
    grid[0][1] = [98, 100, 100];
    const { rgba } = makeImage(grid);
    expect(dominantColor(rgba)).toEqual({ r: 100, g: 100, b: 100 });
  });

  it("skips fully transparent pixels", () => {
    const rgba = new Uint8Array([
      255, 255, 255, 0, // transparent white, must be ignored
      10, 20, 30, 255,
    ]);
    expect(dominantColor(rgba)).toEqual({ r: 10, g: 20, b: 30 });
  });

  it("throws on an empty buffer or a fully transparent one", () => {
    expect(() => dominantColor(new Uint8Array([]))).toThrow();
    expect(() => dominantColor(new Uint8Array([1, 2, 3, 0]))).toThrow();
  });
});

describe("full extraction pipeline", () => {
  /**
   * Exercises the exact chain extractColor.ts runs after the native resize:
   * base64 -> PNG decode -> center crop -> dominant color -> hex.
   */
  function runPipeline(grid: [number, number, number][][]): string {
    const { rgba, width, height } = makeImage(grid);
    const png = UPNG.encode([rgba.buffer as ArrayBuffer], width, height, 0);
    const base64 = bytesToBase64(new Uint8Array(png));

    const decoded = UPNG.decode(base64ToBytes(base64).buffer as ArrayBuffer);
    const pixels = new Uint8Array(UPNG.toRGBA8(decoded)[0]);
    return rgbToHex(dominantColor(cropCenter(pixels, decoded.width, decoded.height)));
  }

  it("recovers the exact hex of a solid-color PNG", () => {
    expect(runPipeline(solidGrid(16, [0x2e, 0x86, 0xc1]))).toBe("#2e86c1");
  });

  it("reports the reticle color, not the surrounding background", () => {
    // Orange background with a teal square filling the middle of the frame.
    const grid = solidGrid(20, [0xff, 0x8c, 0x00]);
    for (let y = 6; y < 14; y++) {
      for (let x = 6; x < 14; x++) grid[y][x] = [0x00, 0x80, 0x80];
    }
    expect(runPipeline(grid)).toBe("#008080");
  });
});
