import { supabase } from "./supabase";
import type { ProfileRow, ProfileStatsRow } from "../types/database";

/**
 * Profile and statistics — ColorLens page 23.
 *
 * Statistics come from the `profile_stats` view, which counts on read. They
 * are never estimated, rounded up or filled in with plausible numbers: the
 * spec forbids fabricating statistics, and a profile is exactly where that
 * temptation is strongest.
 */

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as ProfileRow | null) ?? null;
}

export async function getProfileStats(userId: string): Promise<ProfileStatsRow | null> {
  const { data, error } = await supabase
    .from("profile_stats")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as ProfileStatsRow | null) ?? null;
}

export async function updateProfile(
  userId: string,
  patch: { username?: string; displayName?: string | null; bio?: string | null; avatarUrl?: string | null },
): Promise<void> {
  const username = patch.username?.trim();
  if (username !== undefined && (username.length < 3 || username.length > 24)) {
    // Mirrors the database check constraint, so the user gets a readable
    // message instead of a Postgres error string.
    throw new Error("Le nom d’utilisateur doit contenir entre 3 et 24 caractères.");
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      ...(username !== undefined ? { username } : {}),
      ...(patch.displayName !== undefined ? { display_name: patch.displayName } : {}),
      ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
      ...(patch.avatarUrl !== undefined ? { avatar_url: patch.avatarUrl } : {}),
    })
    .eq("id", userId);

  if (error) {
    // 23505 is a unique violation; the only unique column here is username.
    if ((error as { code?: string }).code === "23505") {
      throw new Error("Ce nom d’utilisateur est déjà pris.");
    }
    throw error;
  }
}
