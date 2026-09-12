import * as ImageManipulator from "expo-image-manipulator";
import UPNG from "upng-js";

import { rgbToHex } from "./color";
import { base64ToBytes, cropCenter, dominantColor } from "./pixels";

/** Width the captured frame is downscaled to before analysis. */
const ANALYSIS_WIDTH = 64;

/**
 * Extracts the color the user aimed at, using only Expo SDK modules plus pure
 * JavaScript, so it runs in Expo Go without a custom development build.
 *
 * The frame is downscaled and saved as lossless PNG (JPEG's chroma subsampling
 * would shift the very values we are trying to report), decoded in JS, cropped
 * to the reticle area, and reduced to a single dominant color.
 *
 * IMPORTANT (see docs/PRODUCT_DISCOVERY.md §3): the result reflects what the
 * camera perceived under the current white balance, exposure and lighting — it
 * is not a colorimetric measurement, and the UI must never present it as one.
 */
export async function extractDominantColor(imageUri: string): Promise<string> {
  const downscaled = await ImageManipulator.manipulateAsync(
    imageUri,
    [{ resize: { width: ANALYSIS_WIDTH } }],
    { base64: true, compress: 1, format: ImageManipulator.SaveFormat.PNG },
  );

  if (!downscaled.base64) {
    throw new Error("Image manipulation returned no pixel data");
  }

  const png = UPNG.decode(base64ToBytes(downscaled.base64).buffer as ArrayBuffer);
  const rgba = new Uint8Array(UPNG.toRGBA8(png)[0]);

  const patch = cropCenter(rgba, png.width, png.height);
  return rgbToHex(dominantColor(patch));
}
