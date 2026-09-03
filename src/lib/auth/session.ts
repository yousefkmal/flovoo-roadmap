import "server-only";

import { cookies } from "next/headers";

import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import {
  DEV_SESSION_COOKIE,
  decodeDevSession,
  devUserId,
  isDevAuthEnabled,
} from "@/lib/auth/dev-session";
import { localGetProfile, localUpsertProfile } from "@/lib/data/local-store";
import { getServiceSupabase } from "@/lib/data/supabase-admin";
import type { Locale } from "@/i18n/config";

export type NotifyScope = "all" | "following" | "none";

/** The shape the UI needs, whichever backend produced it. */
export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  notifyScope: NotifyScope;
  locale: Locale;
}

/**
 * The signed-in person, or null. Reads Supabase when it is configured and the
 * development session otherwise, so every caller can ignore which is in play.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    // `getUser` revalidates against the auth server; the cookie alone is not
    // proof, because it can be tampered with.
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, notify_scope, locale, email")
      .eq("id", data.user.id)
      .maybeSingle();

    return {
      id: data.user.id,
      email: profile?.email ?? data.user.email ?? "",
      name:
        profile?.display_name ??
        (data.user.user_metadata?.full_name as string | undefined) ??
        null,
      avatarUrl:
        profile?.avatar_url ??
        (data.user.user_metadata?.avatar_url as string | undefined) ??
        null,
      notifyScope: (profile?.notify_scope as NotifyScope) ?? "following",
      locale: (profile?.locale as Locale) ?? "ar",
    };
  }

  if (!isDevAuthEnabled) return null;

  const email = decodeDevSession((await cookies()).get(DEV_SESSION_COOKIE)?.value);
  if (!email) return null;

  const id = devUserId(email);

  // The development profile store is process memory while the session cookie
  // outlives a restart, so a returning session can find itself without a
  // profile. Recreate it from what the cookie carries rather than presenting a
  // signed-in person with no name.
  let profile = localGetProfile(id);
  if (!profile) {
    profile = {
      id,
      email,
      name: email.split("@")[0],
      notifyScope: "following",
      locale: "ar",
    };
    localUpsertProfile(profile);
  }

  return {
    id,
    email,
    name: profile.name,
    avatarUrl: null,
    notifyScope: profile.notifyScope,
    locale: profile.locale,
  };
}

/** Whether real accounts are available, as opposed to the development stand-in. */
export const isSupabaseAuthConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export { getServiceSupabase };
