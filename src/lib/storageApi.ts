import { Directory, File, Paths } from "expo-file-system";
import { supabase } from "./supabase";

/**
 * Supabase Storage access for source images and creation previews.
 *
 * §11 requires resizing before upload, temporary-file cleanup and a retention
 * policy. The resize itself belongs to whoever produced the image (the Studio
 * exports at the size it renders; the scanner already downsamples), so this
 * module enforces the two things a caller cannot: a hard size ceiling, and
 * deleting the local temporary file once it has been uploaded.
 */

/** Buckets are created in the Supabase dashboard — see supabase/README.md. */
export const BUCKETS = {
  /** Photos a color was captured from. Private: readable only by the owner. */
  sources: "sources",
  /** Rendered creation previews. Public read, so a shared creation renders. */
  previews: "previews",
  /** Avatars. Public read. */
  avatars: "avatars",
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

/**
 * 8 MB. Large enough for a full-resolution phone photo after the app's own
 * downsampling, small enough that a failed upload on a weak connection has
 * not already cost the user a minute.
 */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export class UploadTooLargeError extends Error {
  constructor(readonly bytes: number) {
    super(`Image trop lourde : ${Math.round(bytes / 1024 / 1024)} Mo (maximum 8 Mo).`);
    this.name = "UploadTooLargeError";
  }
}

function readLocalFile(uri: string): { bytes: Uint8Array; size: number } {
  const file = new File(uri);
  if (!file.exists) throw new Error(`Fichier introuvable : ${uri}`);
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadTooLargeError(file.size);
  return { bytes: file.bytesSync(), size: file.size };
}

/**
 * Uploads a local file and returns the storage path.
 *
 * Returns the *path*, not a URL: a private bucket has no permanent URL, and
 * storing one would either break or, worse, keep working after the object was
 * meant to become inaccessible.
 */
export async function uploadImage(params: {
  bucket: BucketName;
  userId: string;
  localUri: string;
  contentType?: string;
  /** Deletes the local file after a successful upload (§11). */
  cleanupLocal?: boolean;
}): Promise<string> {
  const { bytes } = readLocalFile(params.localUri);
  const extension = params.localUri.split(".").pop()?.toLowerCase() ?? "jpg";
  // The user id prefixes every path so that storage policies can be written
  // as a prefix match on auth.uid(), the same shape as the table RLS.
  const path = `${params.userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const { error } = await supabase.storage.from(params.bucket).upload(path, bytes, {
    contentType: params.contentType ?? (extension === "png" ? "image/png" : "image/jpeg"),
    upsert: false,
  });
  if (error) throw error;

  if (params.cleanupLocal) {
    // Best-effort: failing to delete a cache file must not fail the upload the
    // user is waiting on.
    try {
      new File(params.localUri).delete();
    } catch {
      // The file was already gone, or the OS reclaimed it. Either is fine.
    }
  }

  return path;
}

/** Permanent URL. Only valid for buckets configured as public. */
export function publicUrl(bucket: BucketName, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Time-limited URL for a private bucket. Default one hour. */
export async function signedUrl(
  bucket: BucketName,
  path: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteImage(bucket: BucketName, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}

/**
 * Clears the app's cached temporary images (§11, settings page 24).
 *
 * @returns the number of files removed, so the settings screen can report a
 * real result instead of an unverifiable "cache vidé".
 */
export function clearTemporaryImages(): number {
  const cache: Directory = Paths.cache;
  if (!cache.exists) return 0;

  let removed = 0;
  for (const entry of cache.list()) {
    if (entry instanceof Directory) continue;
    if (!/\.(jpe?g|png|webp)$/i.test(entry.uri)) continue;
    try {
      entry.delete();
      removed++;
    } catch {
      // A file currently open, or already removed — skip it rather than
      // aborting the whole sweep.
    }
  }
  return removed;
}
