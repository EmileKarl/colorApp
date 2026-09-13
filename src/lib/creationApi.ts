import { supabase } from "./supabase";
import type { CreationRow } from "../types/database";

/**
 * Creations — a recolored object (ColorLens page 18).
 *
 * `projectData` is the whole Studio state. It is stored opaquely here and
 * validated where it is consumed (`src/objects/`), so that adding a material
 * parameter does not require a migration or a change in this file.
 */

export type SaveCreationParams = {
  userId: string;
  objectId: string;
  name: string;
  projectData: unknown;
  description?: string;
  sourceColorId?: string;
  paletteId?: string;
  previewUrl?: string;
  tags?: string[];
  isPublic?: boolean;
  remixedFrom?: string;
};

export async function saveCreation(params: SaveCreationParams): Promise<CreationRow> {
  const name = params.name.trim();
  if (name.length === 0) throw new Error("Donne un nom à ta création.");

  const { data, error } = await supabase
    .from("creations")
    .insert({
      user_id: params.userId,
      object_id: params.objectId,
      name,
      description: params.description?.trim() || null,
      source_color_id: params.sourceColorId ?? null,
      palette_id: params.paletteId ?? null,
      preview_url: params.previewUrl ?? null,
      project_data: params.projectData,
      tags: params.tags ?? [],
      // §11: publication is never automatic.
      is_public: params.isPublic ?? false,
      remixed_from: params.remixedFrom ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as CreationRow;
}

export async function updateCreation(
  id: string,
  patch: Partial<{
    name: string;
    description: string | null;
    projectData: unknown;
    previewUrl: string | null;
    tags: string[];
    isPublic: boolean;
  }>,
): Promise<void> {
  const { error } = await supabase
    .from("creations")
    .update({
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.projectData !== undefined ? { project_data: patch.projectData } : {}),
      ...(patch.previewUrl !== undefined ? { preview_url: patch.previewUrl } : {}),
      ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
      ...(patch.isPublic !== undefined ? { is_public: patch.isPublic } : {}),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function listCreations(userId: string, limit = 100): Promise<CreationRow[]> {
  const { data, error } = await supabase
    .from("creations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as CreationRow[];
}

export async function getCreation(id: string): Promise<CreationRow | null> {
  const { data, error } = await supabase.from("creations").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as CreationRow | null) ?? null;
}

/**
 * Public feed. Ordered by recency rather than popularity: ranking by likes
 * before there are users produces a "trending" list built from a handful of
 * rows, which the spec explicitly forbids fabricating.
 */
export async function listPublicCreations(limit = 50, before?: string): Promise<CreationRow[]> {
  let query = supabase
    .from("creations")
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CreationRow[];
}

export async function deleteCreation(id: string): Promise<void> {
  const { error } = await supabase.from("creations").delete().eq("id", id);
  if (error) throw error;
}

/** Duplicate a creation into the current user's library (page 18, "Dupliquer"). */
export async function duplicateCreation(
  source: CreationRow,
  userId: string,
  name?: string,
): Promise<CreationRow> {
  return saveCreation({
    userId,
    objectId: source.object_id,
    name: name ?? `${source.name} (copie)`,
    description: source.description ?? undefined,
    sourceColorId: source.source_color_id ?? undefined,
    paletteId: source.palette_id ?? undefined,
    projectData: source.project_data,
    tags: source.tags,
    // A copy never inherits the original's public flag — §11 again.
    isPublic: false,
  });
}

/**
 * Remix someone else's public creation (page 22).
 *
 * Distinct from duplicate in that it records the lineage, which is what makes
 * a remix attributable back to its author.
 */
export async function remixCreation(
  source: CreationRow,
  userId: string,
  name?: string,
): Promise<CreationRow> {
  return saveCreation({
    userId,
    objectId: source.object_id,
    name: name ?? `${source.name} — remix`,
    sourceColorId: source.source_color_id ?? undefined,
    paletteId: source.palette_id ?? undefined,
    projectData: source.project_data,
    tags: source.tags,
    isPublic: false,
    remixedFrom: source.id,
  });
}

export async function likeCreation(userId: string, creationId: string): Promise<void> {
  const { error } = await supabase
    .from("likes")
    .upsert({ user_id: userId, creation_id: creationId }, { onConflict: "user_id,creation_id" });
  if (error) throw error;
}

export async function unlikeCreation(userId: string, creationId: string): Promise<void> {
  const { error } = await supabase
    .from("likes")
    .delete()
    .eq("user_id", userId)
    .eq("creation_id", creationId);
  if (error) throw error;
}

export async function fetchLikeCounts(creationIds: string[]): Promise<Map<string, number>> {
  if (creationIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("creation_like_counts")
    .select("*")
    .in("creation_id", creationIds);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { creation_id: string; likes: number }[]) {
    counts.set(row.creation_id, row.likes);
  }
  return counts;
}
