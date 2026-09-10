import { supabase } from "./supabase";
import { isValidHex, normalizeHex } from "./color";
import type { SavedColorRow } from "../types/database";

export async function saveColorToCollection(params: {
  userId: string;
  hex: string;
  colorId?: string;
  label?: string;
  sourceImageUrl?: string;
}): Promise<SavedColorRow> {
  if (!isValidHex(params.hex)) throw new Error(`Invalid hex: ${params.hex}`);
  const { data, error } = await supabase
    .from("saved_colors")
    .insert({
      user_id: params.userId,
      hex: normalizeHex(params.hex),
      color_id: params.colorId ?? null,
      label: params.label?.trim() || null,
      source_image_url: params.sourceImageUrl ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as SavedColorRow;
}

export async function listSavedColors(userId: string): Promise<SavedColorRow[]> {
  const { data, error } = await supabase
    .from("saved_colors")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SavedColorRow[];
}

export async function deleteSavedColor(id: string): Promise<void> {
  const { error } = await supabase.from("saved_colors").delete().eq("id", id);
  if (error) throw error;
}
