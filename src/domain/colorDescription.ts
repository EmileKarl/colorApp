import { rgbToHsv } from "../color-engine/color-spaces/hsv";
import { rgbToLab } from "../color-engine/color-spaces/lab";
import { getColorFamily, hexToRgb, rgbToHsl } from "../lib/color";
import type { ColorFamilyRow, StoredHsl, StoredHsv, StoredLab, StoredRgb } from "../types/database";

export type ColorDescription = {
  rgb: StoredRgb;
  hsl: StoredHsl;
  hsv: StoredHsv;
  lab: StoredLab;
  family: ColorFamilyRow;
};

/**
 * Derives every color space the `colors` table stores, from a hex.
 *
 * It lives in the domain layer rather than next to the Supabase call so that
 * it stays testable: importing anything under `src/lib/*Api.ts` pulls in the
 * Supabase client, which needs AsyncStorage's native module and therefore
 * cannot run under Jest. Keeping the arithmetic on this side of that boundary
 * is what lets the stored values be verified at all.
 */
export function describeColor(hex: string): ColorDescription {
  const rgb = hexToRgb(hex);
  const lab = rgbToLab(rgb);
  return {
    rgb,
    hsl: rgbToHsl(rgb),
    hsv: rgbToHsv(rgb),
    lab: { L: lab.L, a: lab.a, b: lab.b },
    family: getColorFamily(rgb),
  };
}
