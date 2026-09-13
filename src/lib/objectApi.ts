import { supabase } from "./supabase";
import { BUILTIN_OBJECTS, builtinObject } from "../objects/models";
import type { ObjectModel } from "../objects/types";
import type { ObjectRow } from "../types/database";

/**
 * The object catalogue.
 *
 * Built-in vector models are always available, with no network and no
 * account. Remote models from the `objects` table are layered on top, which is
 * how a photographic mockup reaches the app once one exists (audit decision 1)
 * without any screen changing.
 *
 * A remote row wins over a built-in with the same id, so a vector model can be
 * upgraded to a photographic one by inserting a row.
 */

export type CatalogueEntry = {
  model: ObjectModel;
  /** True when the model ships in the app bundle and works offline. */
  builtin: boolean;
  thumbnailUrl?: string;
};

/** Available immediately, before any network call resolves. */
export function builtinCatalogue(): CatalogueEntry[] {
  return BUILTIN_OBJECTS.map((model) => ({ model, builtin: true }));
}

/**
 * Turns a database row into a model, or null when its configuration does not
 * describe one.
 *
 * Validation is deliberate rather than a cast: `configuration` is jsonb, so
 * nothing in the schema guarantees its shape, and a malformed row must show as
 * one missing object rather than crash the library screen.
 */
export function parseObjectRow(row: ObjectRow): ObjectModel | null {
  const config = row.configuration;
  if (!config || typeof config !== "object") return null;
  const candidate = config as Partial<ObjectModel>;
  if (!Array.isArray(candidate.zones) || candidate.zones.length === 0) return null;

  if (row.kind === "vector") {
    const vector = (candidate as Extract<ObjectModel, { kind: "vector" }>).vector;
    if (!vector?.viewBox || !Array.isArray(vector.layers)) return null;
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      zones: candidate.zones,
      views: candidate.views ?? [],
      model3dUrl: row.model_3d_url ?? undefined,
      kind: "vector",
      vector,
    };
  }

  const raster = (candidate as Extract<ObjectModel, { kind: "raster" }>).raster;
  if (!raster?.baseUrl || !raster.maskUrls) return null;
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    zones: candidate.zones,
    views: candidate.views ?? [],
    model3dUrl: row.model_3d_url ?? undefined,
    kind: "raster",
    raster,
  };
}

/**
 * Built-in models merged with whatever the server offers.
 *
 * A network failure is not an error here: the built-in catalogue is the
 * fallback, and the app stays usable offline (§11, "traitement local lorsque
 * possible"). The caller is told whether the remote half loaded so it can say
 * so rather than silently showing a short list.
 */
export async function loadCatalogue(): Promise<{
  entries: CatalogueEntry[];
  remoteLoaded: boolean;
}> {
  const builtins = builtinCatalogue();
  try {
    const { data, error } = await supabase
      .from("objects")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;

    const byId = new Map(builtins.map((entry) => [entry.model.id, entry]));
    for (const row of (data ?? []) as ObjectRow[]) {
      const model = parseObjectRow(row);
      if (!model) continue;
      byId.set(row.id, {
        model,
        builtin: false,
        thumbnailUrl: row.thumbnail_url ?? undefined,
      });
    }
    return { entries: [...byId.values()], remoteLoaded: true };
  } catch {
    return { entries: builtins, remoteLoaded: false };
  }
}

/** Resolves one model by id, preferring the server's version. */
export async function loadObject(id: string): Promise<ObjectModel | null> {
  try {
    const { data, error } = await supabase
      .from("objects")
      .select("*")
      .eq("id", id)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      const model = parseObjectRow(data as ObjectRow);
      if (model) return model;
    }
  } catch {
    // Fall through to the built-in copy.
  }
  return builtinObject(id) ?? null;
}

export async function listFavoriteObjectIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("object_favorites")
    .select("object_id")
    .eq("user_id", userId);
  if (error) throw error;
  return ((data ?? []) as { object_id: string }[]).map((row) => row.object_id);
}

export async function setObjectFavorite(
  userId: string,
  objectId: string,
  favorite: boolean,
): Promise<void> {
  if (favorite) {
    const { error } = await supabase
      .from("object_favorites")
      .upsert({ user_id: userId, object_id: objectId }, { onConflict: "user_id,object_id" });
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("object_favorites")
    .delete()
    .eq("user_id", userId)
    .eq("object_id", objectId);
  if (error) throw error;
}
