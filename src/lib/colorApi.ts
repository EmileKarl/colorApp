import { isValidHex, normalizeHex } from "./color";
import { supabase } from "./supabase";
import { describeColor } from "../domain/colorDescription";
import type { ColorRow, ColorSourceType } from "../types/database";

export { describeColor };

/**
 * A user's own captured colors (ColorLens §9) — what used to be
 * `saved_colors`.
 *
 * Every save derives rgb/hsl/hsv/lab here rather than asking the caller for
 * them, so that a color saved from the Studio and one saved from a scan carry
 * exactly the same fields. The derivation uses the same color engine the rest
 * of the app measures with, never a language model (§8).
 */

export type SaveColorParams = {
  userId: string;
  hex: string;
  name?: string;
  sourceType?: ColorSourceType;
  sourceImageUrl?: string;
  /** Measured ΔE00 uncertainty, when the color came from a capture. */
  uncertainty?: number;
  isPublic?: boolean;
  communityColorId?: string;
};

export async function saveColor(params: SaveColorParams): Promise<ColorRow> {
  if (!isValidHex(params.hex)) throw new Error(`Invalid hex: ${params.hex}`);
  const hex = normalizeHex(params.hex);
  const derived = describeColor(hex);

  const { data, error } = await supabase
    .from("colors")
    .insert({
      user_id: params.userId,
      hex,
      name: params.name?.trim() || null,
      rgb: derived.rgb,
      hsl: derived.hsl,
      hsv: derived.hsv,
      lab: derived.lab,
      family: derived.family,
      source_type: params.sourceType ?? "camera",
      source_image_url: params.sourceImageUrl ?? null,
      uncertainty: params.uncertainty ?? null,
      // Never defaulted to true: §11 requires that publication is always a
      // deliberate act.
      is_public: params.isPublic ?? false,
      community_color_id: params.communityColorId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ColorRow;
}

export async function listColors(userId: string, limit = 200): Promise<ColorRow[]> {
  const { data, error } = await supabase
    .from("colors")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ColorRow[];
}

export async function getColor(id: string): Promise<ColorRow | null> {
  const { data, error } = await supabase.from("colors").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as ColorRow | null) ?? null;
}

export async function renameColor(id: string, name: string): Promise<void> {
  const { error } = await supabase
    .from("colors")
    .update({ name: name.trim() || null })
    .eq("id", id);
  if (error) throw error;
}

export async function setColorVisibility(id: string, isPublic: boolean): Promise<void> {
  const { error } = await supabase.from("colors").update({ is_public: isPublic }).eq("id", id);
  if (error) throw error;
}

export async function deleteColor(id: string): Promise<void> {
  const { error } = await supabase.from("colors").delete().eq("id", id);
  if (error) throw error;
}
