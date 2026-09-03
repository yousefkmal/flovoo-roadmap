import "server-only";

import { getCurrentUser, type AppUser } from "@/lib/auth/session";
import { isDevAuthEnabled } from "@/lib/auth/dev-session";
import { getServiceSupabase } from "@/lib/data/supabase-admin";

/**
 * Who counts as an admin.
 *
 * Two sources, in order:
 *  1. `ADMIN_EMAILS` — the bootstrap list. Something has to grant the first
 *     admin, and it cannot be the admin table.
 *  2. `admin_users` — the durable roster, and what every RLS policy checks
 *     through `is_admin()`.
 *
 * In development without Supabase the sign-in stub already accepts any address
 * without verification, so gating admin behind it would prove nothing. Everyone
 * is an admin there — bounded by the same guard that keeps the stub out of
 * production.
 */

const bootstrapAdmins = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export async function isAdmin(user: AppUser | null): Promise<boolean> {
  if (!user) return false;
  if (isDevAuthEnabled) return true;
  if (bootstrapAdmins.includes(user.email.toLowerCase())) return true;

  const supabase = getServiceSupabase();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[flovoo] admin lookup failed", error);
    return false;
  }
  return Boolean(data);
}

export interface AdminSession {
  user: AppUser;
}

/**
 * Resolves the admin session, or null. Every admin page and every admin action
 * calls this — a page guard alone would leave the actions open to anyone who
 * can post to them.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const user = await getCurrentUser();
  return (await isAdmin(user)) ? { user: user! } : null;
}
