"use server";

import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { isLocale, type Locale } from "@/i18n/config";
import { REACTION_EMOJI } from "@/lib/types";
import { getCategories } from "@/lib/data/repository";
import {
  RateLimited,
  createSubmission,
  enqueueShippedNotifications,
  toggleFollow,
  toggleReaction,
  toggleVote,
  updateNotifyScope,
  type NotifyScope,
} from "@/lib/data/mutations";
import { getCurrentUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import {
  DEV_SESSION_COOKIE,
  DEV_SESSION_MAX_AGE,
  devUserId,
  encodeDevSession,
  isDevAuthEnabled,
} from "@/lib/auth/dev-session";
import { localUpsertProfile } from "@/lib/data/local-store";
import {
  validateDescription,
  validateEmail,
  validateName,
  validateTitle,
  validateCategory,
  type FieldError,
} from "@/lib/validation";

/**
 * Server actions.
 *
 * Voting and submitting require a signed-in account, so every action starts by
 * resolving the session server-side. Actions re-validate their input: the client
 * runs the same rules for instant feedback, but that copy is trivially bypassed.
 */

function revalidateBoard(locale: Locale) {
  revalidatePath(`/${locale}`);
}

/** The notification preference is shown on both pages, so both have to refresh. */
function revalidateAll(locale: Locale) {
  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/updates`);
}

/** Coarse, hashed, and only used for rate limiting — never stored in the clear. */
async function requestIpHash(): Promise<string | null> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || list.get("x-real-ip");
  return ip ? createHash("sha256").update(ip).digest("hex") : null;
}

// ---------------------------------------------------------------------------
// Sign in / out
// ---------------------------------------------------------------------------

export type AuthState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "signedIn" }
  | { status: "invalid"; errors: { email?: FieldError; name?: FieldError } }
  | { status: "error"; message: string };

/**
 * Starts Google sign-in. Returns the URL rather than redirecting, so the client
 * can send the browser there — a redirect out of an action is swallowed by the
 * action's own response handling.
 */
export async function googleSignInAction(
  locale: string,
  next: string,
): Promise<{ url: string } | { error: string }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "unconfigured" };

  const origin = (await headers()).get("origin") ?? "";
  const redirectTo = `${origin}/${locale}/auth/callback?next=${encodeURIComponent(next)}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error || !data.url) return { error: error?.message ?? "failed" };
  return { url: data.url };
}

/**
 * Email sign-in. With Supabase this sends a magic link and the person comes
 * back through the callback. Without it, the development stand-in signs them in
 * immediately — see `dev-session.ts` for why that is safe to ship.
 */
export async function emailSignInAction(
  locale: string,
  next: string,
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isLocale(locale)) return { status: "error", message: "failed" };

  const email = String(formData.get("email") ?? "");
  const name = String(formData.get("name") ?? "");

  const errors = {
    email: validateEmail(email) ?? undefined,
    name: name ? (validateName(name) ?? undefined) : undefined,
  };
  if (errors.email || errors.name) return { status: "invalid", errors };

  const supabase = await createSupabaseServerClient();

  if (supabase) {
    const origin = (await headers()).get("origin") ?? "";
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${origin}/${locale}/auth/callback?next=${encodeURIComponent(next)}`,
        data: name.trim() ? { full_name: name.trim() } : undefined,
      },
    });
    if (error) {
      // The two usual causes are configuration, not bad luck: an origin that
      // is not on Supabase's redirect allow list, and the shared mailer's
      // hourly cap. A generic "try again" sends people round in circles, so
      // the real reason goes to the platform logs and a mapped one to the UI.
      console.error("[flovoo] email sign-in failed", {
        origin,
        status: error.status,
        message: error.message,
      });
      return { status: "error", message: error.message };
    }
    return { status: "sent", email: email.trim() };
  }

  if (!isDevAuthEnabled) return { status: "error", message: "unconfigured" };

  const normalised = email.trim().toLowerCase();
  const id = devUserId(normalised);
  localUpsertProfile({
    id,
    email: normalised,
    name: name.trim() || null,
    notifyScope: "following",
    locale,
  });

  const store = await cookies();
  store.set(DEV_SESSION_COOKIE, encodeDevSession(normalised), {
    maxAge: DEV_SESSION_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
  });

  revalidateBoard(locale);
  return { status: "signedIn" };
}

export async function signOutAction(locale: string) {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut();

  const store = await cookies();
  store.delete(DEV_SESSION_COOKIE);

  if (isLocale(locale)) revalidateBoard(locale);
}

// ---------------------------------------------------------------------------
// Voting
// ---------------------------------------------------------------------------

export type VoteState =
  | { status: "idle" }
  | { status: "needsAuth" }
  | { status: "ok"; voted: boolean }
  | { status: "error"; reason: "rateLimited" | "failed" };

export async function voteAction(
  locale: string,
  featureId: string,
): Promise<VoteState> {
  if (!isLocale(locale)) return { status: "error", reason: "failed" };

  const user = await getCurrentUser();
  if (!user) return { status: "needsAuth" };

  try {
    const result = await toggleVote(featureId, user.id);
    revalidateBoard(locale);
    return { status: "ok", voted: result.voted };
  } catch (error) {
    if (error instanceof RateLimited) return { status: "error", reason: "rateLimited" };
    console.error("[flovoo] vote failed", error);
    return { status: "error", reason: "failed" };
  }
}

// ---------------------------------------------------------------------------
// Following a feature
// ---------------------------------------------------------------------------

export type FollowState =
  | { status: "idle" }
  | { status: "needsAuth" }
  | { status: "ok"; following: boolean }
  | { status: "error" };

export async function followAction(
  locale: string,
  featureId: string,
): Promise<FollowState> {
  if (!isLocale(locale)) return { status: "error" };

  const user = await getCurrentUser();
  if (!user) return { status: "needsAuth" };

  try {
    const following = await toggleFollow(featureId, user.id);
    revalidateBoard(locale);
    return { status: "ok", following };
  } catch (error) {
    console.error("[flovoo] follow failed", error);
    return { status: "error" };
  }
}

export async function updateNotifyScopeAction(locale: string, scope: NotifyScope) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const };

  try {
    await updateNotifyScope(user.id, scope);
    if (isLocale(locale)) revalidateAll(locale);
    return { ok: true as const };
  } catch (error) {
    console.error("[flovoo] preference save failed", error);
    return { ok: false as const };
  }
}

// ---------------------------------------------------------------------------
// Changelog reactions
// ---------------------------------------------------------------------------

export type ReactionState =
  | { status: "idle" }
  | { status: "needsAuth" }
  | { status: "ok"; reacted: boolean }
  | { status: "error" };

export async function reactAction(
  locale: string,
  entryId: string,
  emoji: string,
): Promise<ReactionState> {
  if (!isLocale(locale)) return { status: "error" };
  if (!(REACTION_EMOJI as readonly string[]).includes(emoji)) return { status: "error" };

  const user = await getCurrentUser();
  if (!user) return { status: "needsAuth" };

  try {
    const reacted = await toggleReaction(entryId, user.id, emoji);
    revalidatePath(`/${locale}/updates`);
    return { status: "ok", reacted };
  } catch (error) {
    console.error("[flovoo] reaction failed", error);
    return { status: "error" };
  }
}

// ---------------------------------------------------------------------------
// Idea submission
// ---------------------------------------------------------------------------

export type SubmitState =
  | { status: "idle" }
  | { status: "needsAuth" }
  | { status: "success" }
  | { status: "error"; reason: "rateLimited" | "failed" }
  | {
      status: "invalid";
      errors: Partial<
        Record<"title" | "description" | "category" | "name", FieldError>
      >;
    };

export async function submitIdeaAction(
  locale: string,
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  if (!isLocale(locale)) return { status: "error", reason: "failed" };

  // Honeypot: a field no person sees and no person fills. Answer with success
  // so a bot learns nothing from being refused.
  if (String(formData.get("company") ?? "").trim() !== "") {
    return { status: "success" };
  }

  const user = await getCurrentUser();
  if (!user) return { status: "needsAuth" };

  const title = String(formData.get("title") ?? "");
  const description = String(formData.get("description") ?? "");
  const categorySlug = String(formData.get("category") ?? "");
  const name = String(formData.get("name") ?? "") || user.name || "";

  const categories = await getCategories();
  const errors = {
    title: validateTitle(title) ?? undefined,
    description: validateDescription(description) ?? undefined,
    category: validateCategory(categorySlug, categories.map((c) => c.slug)) ?? undefined,
    name: validateName(name) ?? undefined,
  };
  if (Object.values(errors).some(Boolean)) return { status: "invalid", errors };

  try {
    await createSubmission({
      title: title.trim(),
      description: description.trim() || null,
      categoryId: categories.find((c) => c.slug === categorySlug)?.id ?? null,
      submitterName: name.trim(),
      submitterEmail: user.email,
      submittedBy: user.id,
      language: locale,
      ipHash: await requestIpHash(),
    });
    return { status: "success" };
  } catch (error) {
    if (error instanceof RateLimited) return { status: "error", reason: "rateLimited" };
    console.error("[flovoo] submission failed", error);
    return { status: "error", reason: "failed" };
  }
}

export { enqueueShippedNotifications };
