"use server";

import { revalidatePath } from "next/cache";

import { isLocale } from "@/i18n/config";
import { getAdminSession } from "@/lib/auth/admin";
import { getServiceSupabase } from "@/lib/data/supabase-admin";

/**
 * The question set, and the manual spot-checks logged against it.
 *
 * Every action re-resolves the session itself: a Server Action is a reachable
 * endpoint whether or not a page renders a button for it.
 */

export type PromptState = { status: "idle" } | { status: "ok" } | { status: "error" };

/**
 * A Server Action is a reachable endpoint whether or not a page renders a
 * button for it, so each one resolves the session itself.
 */
async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("forbidden");
  return session;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function addGeoPromptAction(
  locale: string,
  _prev: PromptState,
  formData: FormData,
): Promise<PromptState> {
  await requireAdmin();
  if (!isLocale(locale)) return { status: "error" };

  const prompt = String(formData.get("prompt") ?? "").trim();
  const language = String(formData.get("language") ?? "");
  if (prompt.length < 8 || prompt.length > 400 || !isLocale(language)) return { status: "error" };

  const supabase = getServiceSupabase();
  if (!supabase) return { status: "error" };
  const { error } = await supabase
    .from("help_geo_prompts")
    .insert({ prompt, language, source: "team" });
  if (error) {
    console.error("[flovoo] adding a GEO prompt failed", error);
    return { status: "error" };
  }
  revalidatePath(`/${locale}/admin/help/ai/prompts`);
  return { status: "ok" };
}

export async function toggleGeoPromptAction(locale: string, id: string, active: boolean) {
  await requireAdmin();
  if (!isLocale(locale) || !UUID.test(id)) return;
  const supabase = getServiceSupabase();
  if (!supabase) return;
  await supabase.from("help_geo_prompts").update({ is_active: active }).eq("id", id);
  revalidatePath(`/${locale}/admin/help/ai/prompts`);
}

/**
 * A verdict a person reached by asking the assistant themselves.
 *
 * The automated run measures what we can measure; a person checking by hand
 * catches what it cannot — a citation of the wrong page, for instance, which
 * the domain match would happily count as a win.
 */
export async function logManualCheckAction(
  locale: string,
  _prev: PromptState,
  formData: FormData,
): Promise<PromptState> {
  await requireAdmin();
  if (!isLocale(locale)) return { status: "error" };

  const promptId = String(formData.get("promptId") ?? "");
  const provider = String(formData.get("provider") ?? "").trim();
  const verdict = String(formData.get("verdict") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!UUID.test(promptId) || !provider) return { status: "error" };
  if (!["cited", "not_cited", "cited_wrong_page"].includes(verdict)) return { status: "error" };

  const supabase = getServiceSupabase();
  if (!supabase) return { status: "error" };
  const { error } = await supabase
    .from("help_geo_manual_checks")
    .insert({ prompt_id: promptId, provider, verdict, note });
  if (error) {
    console.error("[flovoo] logging a manual check failed", error);
    return { status: "error" };
  }
  revalidatePath(`/${locale}/admin/help/ai/prompts`);
  return { status: "ok" };
}
