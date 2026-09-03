import "server-only";

import { createHash } from "node:crypto";

/**
 * Development sign-in, used only when Supabase is not configured.
 *
 * It accepts an email and creates a local account with no verification, which
 * is exactly as insecure as it sounds — that is why it refuses to run in
 * production. It exists so the whole flow (sign in → vote → follow → notify)
 * can be exercised before anyone has provisioned a Supabase project, and so a
 * reviewer does not need credentials to see it work.
 */

export const DEV_SESSION_COOKIE = "flovoo_dev_session";
export const DEV_SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export const isDevAuthEnabled =
  process.env.NODE_ENV !== "production" &&
  !(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** Stable id from the email, so signing in twice lands on the same account. */
export function devUserId(email: string): string {
  return createHash("sha256")
    .update(`dev:${email.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 32);
}

export function encodeDevSession(email: string): string {
  return Buffer.from(email.trim().toLowerCase(), "utf8").toString("base64url");
}

export function decodeDevSession(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const email = Buffer.from(value, "base64url").toString("utf8");
    return email.includes("@") ? email : null;
  } catch {
    return null;
  }
}
