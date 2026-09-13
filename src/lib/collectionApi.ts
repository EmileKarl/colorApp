import { supabase } from "./supabase";
import type { CollectionItemRow, CollectionItemType, CollectionRow } from "../types/database";

/**
 * Named collections (ColorLens page 20).
 *
 * Replaces the old flat "saved colors" list. A collection is heterogeneous —
 * it can hold colors, palettes and creations side by side — because the
 * examples the spec gives ("Palette de ma chambre", "Idées de sneakers") mix
 * those kinds naturally.
 */

export type CollectionWithItems = CollectionRow & { items: CollectionItemRow[] };

export async function createCollection(params: {
  userId: string;
  name: string;
  description?: string;
  isPublic?: boolean;
}): Promise<CollectionRow> {
  const name = params.name.trim();
  if (name.length === 0) throw new Error("Donne un nom à ta collection.");
  const { data, error } = await supabase
    .from("collections")
    .insert({
      user_id: params.userId,
      name,
      description: params.description?.trim() || null,
      is_public: params.isPublic ?? false,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CollectionRow;
}

export async function listCollections(userId: string): Promise<CollectionWithItems[]> {
  const { data, error } = await supabase
    .from("collections")
    .select("*, collection_items(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as (CollectionRow & { collection_items: CollectionItemRow[] })[]).map(
    ({ collection_items, ...collection }) => ({
      ...collection,
      items: [...(collection_items ?? [])].sort((a, b) => a.position - b.position),
    }),
  );
}

export async function getCollection(id: string): Promise<CollectionWithItems | null> {
  const { data, error } = await supabase
    .from("collections")
    .select("*, collection_items(*)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { collection_items, ...collection } = data as CollectionRow & {
    collection_items: CollectionItemRow[];
  };
  return {
    ...collection,
    items: [...(collection_items ?? [])].sort((a, b) => a.position - b.position),
  };
}

export async function addToCollection(params: {
  collectionId: string;
  itemType: CollectionItemType;
  itemId: string;
}): Promise<void> {
  // Appending needs the current maximum position. Reading it and writing back
  // is not atomic, so two rapid adds can land on the same position; the
  // primary key is (collection, type, item) rather than position, so that
  // collides harmlessly into an arbitrary but stable order rather than
  // failing. Reordering is explicit anyway (`reorderCollection`).
  const { data, error: readError } = await supabase
    .from("collection_items")
    .select("position")
    .eq("collection_id", params.collectionId)
    .order("position", { ascending: false })
    .limit(1);
  if (readError) throw readError;
  const nextPosition = ((data?.[0] as { position: number } | undefined)?.position ?? -1) + 1;

  const { error } = await supabase.from("collection_items").upsert(
    {
      collection_id: params.collectionId,
      item_type: params.itemType,
      item_id: params.itemId,
      position: nextPosition,
    },
    { onConflict: "collection_id,item_type,item_id" },
  );
  if (error) throw error;
}

export async function removeFromCollection(params: {
  collectionId: string;
  itemType: CollectionItemType;
  itemId: string;
}): Promise<void> {
  const { error } = await supabase
    .from("collection_items")
    .delete()
    .eq("collection_id", params.collectionId)
    .eq("item_type", params.itemType)
    .eq("item_id", params.itemId);
  if (error) throw error;
}

/** Persists a new order after a drag (page 20, "réorganiser"). */
export async function reorderCollection(
  collectionId: string,
  ordered: { itemType: CollectionItemType; itemId: string }[],
): Promise<void> {
  const rows = ordered.map((item, index) => ({
    collection_id: collectionId,
    item_type: item.itemType,
    item_id: item.itemId,
    position: index,
  }));
  const { error } = await supabase
    .from("collection_items")
    .upsert(rows, { onConflict: "collection_id,item_type,item_id" });
  if (error) throw error;
}

export async function renameCollection(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error("Donne un nom à ta collection.");
  const { error } = await supabase.from("collections").update({ name: trimmed }).eq("id", id);
  if (error) throw error;
}

export async function setCollectionVisibility(id: string, isPublic: boolean): Promise<void> {
  const { error } = await supabase.from("collections").update({ is_public: isPublic }).eq("id", id);
  if (error) throw error;
}

export async function deleteCollection(id: string): Promise<void> {
  // Items cascade. The colors, palettes and creations themselves are not
  // touched — deleting a collection must never destroy its contents.
  const { error } = await supabase.from("collections").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateCollection(
  source: CollectionWithItems,
  userId: string,
): Promise<CollectionRow> {
  const copy = await createCollection({
    userId,
    name: `${source.name} (copie)`,
    description: source.description ?? undefined,
    isPublic: false,
  });
  if (source.items.length > 0) {
    const rows = source.items.map((item, index) => ({
      collection_id: copy.id,
      item_type: item.item_type,
      item_id: item.item_id,
      position: index,
    }));
    const { error } = await supabase.from("collection_items").insert(rows);
    if (error) throw error;
  }
  return copy;
}
