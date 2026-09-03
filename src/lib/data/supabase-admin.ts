import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. Server only — this key bypasses RLS and must never reach
 * the browser, which is why this module is `server-only` and the variable has
 * no `NEXT_PUBLIC_` prefix.
 *
 * Writes go through here rather than the anon client for one concrete reason:
 * a visitor has to be able to see their own votes, and the anon role cannot
 * read the `votes` table by design — the policies keep who-voted-for-what
 * private. The server holds the signed-in user's id from their session and
 * reads on their behalf.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let client: SupabaseClient | null = null;

export function getServiceSupabase(): SupabaseClient | null {
  if (!url || !serviceKey) return null;
  client ??= createClient(url, serviceKey, { auth: { persistSession: false } });
  return client;
}

export const isServiceConfigured = Boolean(url && serviceKey);
