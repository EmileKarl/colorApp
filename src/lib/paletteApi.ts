import { isValidHex, normalizeHex } from "./color";
import { supabase } from "./supabase";
import type { PaletteColorRole, PaletteColorRow, PaletteRow } from "../types/database";

export type PaletteEntry = { hex: string; role?: PaletteColorRole; colorId?: string };

export type SavedPalette = PaletteRow & { colors: PaletteColorRow[] };

/**
 * Palettes (ColorLens §9, page 7).
 *
 * Colors are written as a separate row set rather than a jsonb array so that
 * "which palettes contain this color" stays a plain indexed query — the
 * Explorer and collection screens both need it.
 */
export async function createPalette(params: {
  userId: string;
  name: string;
  colors: PaletteEntry[];
  description?: string;
  sourceScheme?: string;
  isPublic?: boolean;
}): Promise<SavedPalette> {
  const name = params.name.trim();
  if (name.length === 0) throw new Error("Le nom de la palette est requis.");
  if (params.colors.length === 0) throw new Error("Une palette doit contenir au moins une couleur.");
  for (const entry of params.colors) {
    if (!isValidHex(entry.hex)) throw new Error(`Invalid hex: ${entry.hex}`);
  }

  const { data, error } = await supabase
    .from("palettes")
    .insert({
      user_id: params.userId,
      name,
      description: params.description?.trim() || null,
      source_scheme: params.sourceScheme ?? null,
      is_public: params.isPublic ?? false,
    })
    .select()
    .single();
  if (error) throw error;
  const palette = data as PaletteRow;

  const rows = params.colors.map((entry, index) => ({
    palette_id: palette.id,
    position: index,
    hex: normalizeHex(entry.hex),
    role: entry.role ?? null,
    color_id: entry.colorId ?? null,
  }));

  const { data: inserted, error: colorError } = await supabase
    .from("palette_colors")
    .insert(rows)
    .select();

  if (colorError) {
    // Without this, a failed color insert would leave a palette with no
    // colors — a row the user sees as an empty card and cannot explain.
    // RLS already restricts the delete to this user's own palette.
    await supabase.from("palettes").delete().eq("id", palette.id);
    throw colorError;
  }

  return { ...palette, colors: (inserted ?? []) as PaletteColorRow[] };
}

export async function listPalettes(userId: string, limit = 100): Promise<SavedPalette[]> {
  const { data, error } = await supabase
    .from("palettes")
    .select("*, palette_colors(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return ((data ?? []) as (PaletteRow & { palette_colors: PaletteColorRow[] })[]).map(
    ({ palette_colors, ...palette }) => ({
      ...palette,
      colors: [...(palette_colors ?? [])].sort((a, b) => a.position - b.position),
    }),
  );
}

export async function getPalette(id: string): Promise<SavedPalette | null> {
  const { data, error } = await supabase
    .from("palettes")
    .select("*, palette_colors(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { palette_colors, ...palette } = data as PaletteRow & {
    palette_colors: PaletteColorRow[];
  };
  return {
    ...palette,
    colors: [...(palette_colors ?? [])].sort((a, b) => a.position - b.position),
  };
}

export async function renamePalette(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error("Le nom de la palette est requis.");
  const { error } = await supabase.from("palettes").update({ name: trimmed }).eq("id", id);
  if (error) throw error;
}

export async function setPaletteVisibility(id: string, isPublic: boolean): Promise<void> {
  const { error } = await supabase.from("palettes").update({ is_public: isPublic }).eq("id", id);
  if (error) throw error;
}

export async function deletePalette(id: string): Promise<void> {
  // palette_colors cascades from the palette's foreign key.
  const { error } = await supabase.from("palettes").delete().eq("id", id);
  if (error) throw error;
}
