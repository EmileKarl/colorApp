import { getColors } from "react-native-image-colors";

import { normalizeHex } from "./color";

/**
 * Extracts a representative color from a captured/picked image URI using
 * the platform's native image analysis (Android Palette API / iOS
 * UIImageColors via react-native-image-colors), rather than reading raw
 * pixels in JS.
 *
 * IMPORTANT (see docs/PRODUCT_DISCOVERY.md §3): this is what the camera and
 * OS *perceived*, affected by white balance, exposure, ambient lighting and
 * reflections — not a colorimetric measurement. Never present this as
 * professional-grade color measurement in the UI copy.
 */
export async function extractDominantColor(imageUri: string): Promise<string> {
  const result = await getColors(imageUri, {
    fallback: "#999999",
    cache: false,
    quality: "high",
  });

  let hex: string;
  switch (result.platform) {
    case "android":
      hex = result.dominant ?? result.average ?? result.vibrant ?? "#999999";
      break;
    case "ios":
      hex = result.background ?? result.primary ?? result.detail ?? "#999999";
      break;
    default:
      hex = result.dominant ?? "#999999";
  }

  return normalizeHex(hex);
}
