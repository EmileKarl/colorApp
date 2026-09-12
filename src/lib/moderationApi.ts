import { supabase } from "./supabase";
import type { ColorFamilyRow } from "../types/database";

export type PendingColorName = {
  id: string;
  name: string;
  created_at: string;
  proposed_by: string | null;
  color: { hex: string; family: ColorFamilyRow } | null;
};

/**
 * Pending name proposals awaiting moderation. RLS on color_names only lets
 * a non-moderator see their own proposals here (see
 * supabase/migrations/20260910090200_color_names.sql) — this call is safe
 * to make from any authenticated screen, moderator or not; a regular user
 * just gets an empty/short list back instead of an error.
 */
export async function fetchPendingColorNames(): Promise<PendingColorName[]> {
  const { data, error } = await supabase
    .from("color_names")
    .select("id, name, created_at, proposed_by, color:colors(hex, family)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    created_at: row.created_at as string,
    proposed_by: row.proposed_by as string | null,
    // Supabase's embed comes back as an object for a to-one relationship,
    // but the generated type is looser — normalize defensively.
    color: Array.isArray(row.color) ? (row.color[0] ?? null) : (row.color ?? null),
  }));
}

export async function moderateColorName(params: {
  id: string;
  approve: boolean;
  moderatorId: string;
  reason?: string;
}): Promise<void> {
  const { error } = await supabase
    .from("color_names")
    .update({
      status: params.approve ? "approved" : "rejected",
      moderated_by: params.moderatorId,
      moderated_at: new Date().toISOString(),
      moderation_reason: params.reason?.trim() || null,
    })
    .eq("id", params.id);
  if (error) throw error;
}
