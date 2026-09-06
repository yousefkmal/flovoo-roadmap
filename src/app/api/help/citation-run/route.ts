import { NextResponse, type NextRequest } from "next/server";

import { runCitationCheck } from "@/lib/help/citations";

/**
 * The weekly citation run.
 *
 * Triggered by a scheduler (Vercel Cron, or anything that can send a header),
 * not by a person, so it is guarded by a secret rather than a session. Each
 * run asks every configured provider the active prompts and records what came
 * back — including the answer text, so a surprising verdict can be checked
 * rather than argued about.
 *
 * Volume is deliberately small: sixty prompts a week per provider.
 */
export const maxDuration = 300;

async function run(request: NextRequest) {
  const secret = process.env.CITATION_RUN_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, reason: "not configured" }, { status: 503 });
  }
  // Vercel Cron sends its own header; anything else must present the secret.
  const authorized =
    request.headers.get("x-citation-secret") === secret ||
    request.headers.get("authorization") === `Bearer ${secret}` ||
    // Vercel Cron presents CRON_SECRET, which is its own variable.
    (process.env.CRON_SECRET
      ? request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`
      : false);
  if (!authorized) return NextResponse.json({ ok: false }, { status: 401 });

  // Leave a minute of headroom under `maxDuration` so the function reports
  // what it managed rather than being killed mid-answer.
  const summaries = await runCitationCheck({ deadline: Date.now() + 240_000 });
  const remaining = summaries.reduce((total, s) => total + s.remaining, 0);
  return NextResponse.json({ ok: true, done: remaining === 0, remaining, summaries });
}

/** Vercel Cron sends GET with its own bearer token; a person would send POST. */
export const GET = run;
export const POST = run;
