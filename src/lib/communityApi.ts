import { supabase } from "./supabase";
import {
  SAME_COLOR_THRESHOLD,
  colorDistance,
  hexToRgb,
  isValidHex,
  normalizeHex,
} from "./color";
import type { ColorFamily } from "./color";
import type { ColorNameRankingRow, ColorRow } from "../types/database";

/**
 * Looks for an existing community color close enough to `hex` to be treated
 * as "the same color" (§31 flow). Uses the indexed 16-step RGB bucket to
 * fetch only a small neighborhood, then applies the exact tested distance
 * function client-side — this never trusts client input for anything that
 * writes data, it's a read-only lookup.
 */
export async function findExistingColor(hex: string): Promise<ColorRow | null> {
  if (!isValidHex(hex)) throw new Error(`Invalid hex: ${hex}`);
  const { r, g, b } = hexToRgb(hex);
  const bucketOf = (channel: number) => Math.floor(channel / 16) * 16;
  const [br, bg, bb] = [bucketOf(r), bucketOf(g), bucketOf(b)];

  const { data, error } = await supabase
    .from("colors")
    .select("*")
    .eq("status", "active")
    .gte("bucket_r", Math.max(0, br - 16))
    .lte("bucket_r", br + 16)
    .gte("bucket_g", Math.max(0, bg - 16))
    .lte("bucket_g", bg + 16)
    .gte("bucket_b", Math.max(0, bb - 16))
    .lte("bucket_b", bb + 16);

  if (error) throw error;
  if (!data || data.length === 0) return null;

  const normalized = normalizeHex(hex);
  let closest: ColorRow | null = null;
  let closestDistance = Infinity;
  for (const candidate of data as ColorRow[]) {
    const distance = colorDistance({ r, g, b }, { r: candidate.r, g: candidate.g, b: candidate.b });
    if (distance < closestDistance) {
      closestDistance = distance;
      closest = candidate;
    }
  }

  if (closest && closestDistance <= SAME_COLOR_THRESHOLD) return closest;
  // Also expose an "exact" hex match regardless of distance, cheap safety net.
  return (data as ColorRow[]).find((c) => c.hex === normalized) ?? null;
}

export async function createColor(params: {
  hex: string;
  family: ColorFamily;
  discoveredBy: string;
  coverImageUrl?: string;
}): Promise<ColorRow> {
  const { hex, family, discoveredBy, coverImageUrl } = params;
  const { r, g, b } = hexToRgb(hex);
  const { data, error } = await supabase
    .from("colors")
    .insert({
      hex: normalizeHex(hex),
      r,
      g,
      b,
      family,
      discovered_by: discoveredBy,
      cover_image_url: coverImageUrl ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ColorRow;
}

export async function proposeColorName(params: {
  colorId: string;
  name: string;
  proposedBy: string;
}) {
  const name = params.name.trim();
  if (name.length < 2 || name.length > 40) {
    throw new Error("Le nom doit contenir entre 2 et 40 caractères.");
  }
  const { error } = await supabase.from("color_names").insert({
    color_id: params.colorId,
    name,
    proposed_by: params.proposedBy,
  });
  if (error) throw error;
}

export async function castVote(params: {
  colorNameId: string;
  voterId: string;
  value: 1 | -1;
}) {
  const { error } = await supabase.from("votes").upsert(
    {
      color_name_id: params.colorNameId,
      voter_id: params.voterId,
      value: params.value,
    },
    { onConflict: "color_name_id,voter_id" },
  );
  if (error) throw error;
}

export async function removeVote(params: { colorNameId: string; voterId: string }) {
  const { error } = await supabase
    .from("votes")
    .delete()
    .eq("color_name_id", params.colorNameId)
    .eq("voter_id", params.voterId);
  if (error) throw error;
}

export async function fetchTopRankedNames(limit = 50): Promise<ColorNameRankingRow[]> {
  const { data, error } = await supabase
    .from("color_name_rankings")
    .select("*")
    .order("score", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ColorNameRankingRow[];
}

export async function reportContent(params: {
  reporterId: string;
  targetType: "color" | "color_name" | "profile";
  targetId: string;
  reason: string;
}) {
  const reason = params.reason.trim();
  if (reason.length < 3) throw new Error("Merci de préciser la raison du signalement.");
  const { error } = await supabase.from("reports").insert({
    reporter_id: params.reporterId,
    target_type: params.targetType,
    target_id: params.targetId,
    reason,
  });
  if (error) throw error;
}
