import * as ImageManipulator from "expo-image-manipulator";
import UPNG from "upng-js";

import { analyzeColor, type AnalyzeColorResult , CameraContext } from "../color-engine/pipeline/analyzeColor";
import { base64ToBytes } from "./pixels";

/**
 * Bridge between Expo's image APIs and the pure color engine.
 *
 * Everything device-specific lives here; everything analytical lives in
 * `src/color-engine`, which has no React Native dependency and is therefore
 * unit-testable in Node. Keep that boundary — it is the reason the engine's
 * math can be verified against published CIE data at all.
 */

/**
 * Width the captured frame is downscaled to before analysis.
 *
 * 96px keeps the whole pipeline in the low milliseconds (k-means over ~1500 ROI
 * pixels) while leaving enough surround for the illuminant estimator to work
 * with. Larger buffers improve the statistics only marginally and risk
 * noticeable jank on the JS thread.
 */
const ANALYSIS_WIDTH = 96;

export type DecodedImage = { rgba: Uint8Array; width: number; height: number };

/**
 * Decodes an image URI into raw RGBA pixels via a lossless PNG round-trip.
 *
 * Exported so tap-to-color can decode once and then sample many regions from
 * the same buffer — re-decoding the file on every tap would make the
 * interaction sluggish for no benefit.
 */
export async function decodeImageToRgba(imageUri: string): Promise<DecodedImage> {
  const downscaled = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: ANALYSIS_WIDTH } }],
    // PNG, not JPEG: JPEG's chroma subsampling would alter the very values we
    // are trying to measure.
    { base64: true, compress: 1, format: ImageManipulator.SaveFormat.PNG },
  );

  if (!downscaled.base64) {
    throw new Error("Image manipulation returned no pixel data");
  }

  const png = UPNG.decode(base64ToBytes(downscaled.base64).buffer as ArrayBuffer);
  return {
    rgba: new Uint8Array(UPNG.toRGBA8(png)[0]),
    width: png.width,
    height: png.height,
  };
}

/**
 * Runs the full analysis pipeline on a captured image.
 *
 * @param imageUri Local file URI from the camera or picker.
 * @param camera Optional EXIF-derived capture context. Recorded on the result;
 * it never alters the measured color, since EXIF is self-reported by the
 * camera and cannot be independently verified.
 * @returns The full measurement, including confidence and its limitations.
 */
export async function analyzeImageColor(
  imageUri: string,
  camera?: CameraContext,
): Promise<AnalyzeColorResult> {
  const image = await decodeImageToRgba(imageUri);
  return analyzeColor(image, { camera });
}

/**
 * Analyses an already-decoded image, optionally at a specific point.
 *
 * Synchronous by design: on a 96px buffer the whole pipeline runs in a few
 * milliseconds, so tap-to-color can update its readout within the same frame
 * as the touch rather than through a promise.
 *
 * @param point Where to sample, as fractions of width/height in 0–1. Omitted
 * means the centre of the frame.
 */
export function analyzeDecodedImage(
  image: DecodedImage,
  point?: { x: number; y: number },
): AnalyzeColorResult {
  return analyzeColor(image, { roiCenter: point });
}

/**
 * Convenience wrapper returning just the hex.
 *
 * Prefer {@link analyzeImageColor} in new code: a bare hex discards the
 * confidence and uncertainty, and showing a color without them is exactly the
 * false-precision this engine exists to avoid.
 */
export async function extractDominantColor(imageUri: string): Promise<string> {
  const result = await analyzeImageColor(imageUri);
  return result.dominantColor.hex;
}
