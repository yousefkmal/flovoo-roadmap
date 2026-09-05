import "server-only";

import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { getServiceSupabase } from "@/lib/data/supabase-admin";

/**
 * Where article images live and how they are addressed.
 *
 * With Supabase the files sit in the public `help-media` bucket and
 * `storage_path` is the path inside it. Without Supabase they are written to
 * `public/help-uploads/` (git-ignored) and the path is prefixed `local/` so
 * the two can never be confused. Either way, pages get a plain URL.
 */

export const HELP_MEDIA_BUCKET = "help-media";
export const HELP_MEDIA_MAX_BYTES = 8 * 1024 * 1024;
export const HELP_MEDIA_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

const LOCAL_PREFIX = "local/";
const localDir = join(process.cwd(), "public", "help-uploads");

export function mediaPublicUrl(storagePath: string): string {
  if (storagePath.startsWith(LOCAL_PREFIX)) {
    return `/help-uploads/${storagePath.slice(LOCAL_PREFIX.length)}`;
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  return `${base}/storage/v1/object/public/${HELP_MEDIA_BUCKET}/${storagePath}`;
}

/** Stores the bytes and returns the `storage_path` to record. */
export async function storeHelpMediaFile(
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  const ext = HELP_MEDIA_TYPES[contentType];
  if (!ext) throw new Error(`Unsupported media type: ${contentType}`);

  const now = new Date();
  const name = `${crypto.randomUUID()}.${ext}`;
  const supabase = getServiceSupabase();

  if (!supabase) {
    await mkdir(localDir, { recursive: true });
    await writeFile(join(localDir, name), bytes);
    return `${LOCAL_PREFIX}${name}`;
  }

  const path = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${name}`;
  const { error } = await supabase.storage
    .from(HELP_MEDIA_BUCKET)
    .upload(path, bytes, { contentType, upsert: false, cacheControl: "31536000" });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  return path;
}

export async function removeHelpMediaFile(storagePath: string): Promise<void> {
  if (storagePath.startsWith(LOCAL_PREFIX)) {
    const name = storagePath.slice(LOCAL_PREFIX.length);
    if (!/^[\w.-]+$/.test(name)) return;
    await unlink(join(localDir, name)).catch(() => undefined);
    return;
  }
  const supabase = getServiceSupabase();
  if (!supabase) return;
  const { error } = await supabase.storage.from(HELP_MEDIA_BUCKET).remove([storagePath]);
  if (error) console.warn(`help media: could not remove ${storagePath}: ${error.message}`);
}
