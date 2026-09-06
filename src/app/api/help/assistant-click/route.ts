import { NextResponse } from "next/server";

import { isLocale } from "@/i18n/config";
import { getServiceSupabase } from "@/lib/data/supabase-admin";

const TARGETS = new Set(["copy", "markdown", "chatgpt", "claude", "perplexity"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A tally of which assistant readers reach for, per article and language.
 *
 * Deliberately not an event log: no visitor, no session, no address. The row
 * is `(article, language, target) → count`, so there is nothing here that
 * could be tied back to a person even in principle.
 */
export async function POST(request: Request) {
  let body: { articleId?: string; language?: string; target?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { articleId, language, target } = body;
  if (!articleId || !UUID.test(articleId)) return NextResponse.json({ ok: false }, { status: 400 });
  if (!language || !isLocale(language)) return NextResponse.json({ ok: false }, { status: 400 });
  if (!target || !TARGETS.has(target)) return NextResponse.json({ ok: false }, { status: 400 });

  const supabase = getServiceSupabase();
  if (!supabase) return NextResponse.json({ ok: true });

  const { error } = await supabase.rpc("help_note_assistant_click", {
    target_article: articleId,
    target_language: language,
    target_name: target,
  });
  // A counter is not worth failing a click over.
  if (error) console.warn(`assistant click: ${error.message}`);
  return NextResponse.json({ ok: true });
}
