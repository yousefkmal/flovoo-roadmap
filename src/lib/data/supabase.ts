import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Returns an anon-key client, or `null` when Supabase isn't configured yet — in
 * which case the repository falls back to the local seed data. This is the one
 * switch that takes the portal from seed content to live content.
 */
export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  client ??= createClient(url, anonKey, { auth: { persistSession: false } });
  return client;
}

export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;
