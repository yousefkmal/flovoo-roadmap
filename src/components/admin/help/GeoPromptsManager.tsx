"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Plus } from "lucide-react";

import {
  addGeoPromptAction,
  logManualCheckAction,
  toggleGeoPromptAction,
  type PromptState,
} from "@/app/[locale]/admin/help/ai/actions";
import { FIELD_CLASS } from "@/components/ui/Field";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/lib/types";

interface Prompt {
  id: string;
  prompt: string;
  language: Locale;
  is_active: boolean;
  source: string;
}

interface ManualCheck {
  prompt_id: string;
  provider: string;
  verdict: string;
  ts: string;
}

/**
 * The question set, and the helper for checking one by hand.
 *
 * The automated run measures what an API can measure. A person pasting the
 * question into ChatGPT catches what it cannot — most usefully, a citation of
 * the *wrong* page, which a domain match counts as a win.
 */
export function GeoPromptsManager({
  locale,
  dict,
  prompts,
  checks,
}: {
  locale: Locale;
  dict: Dictionary;
  prompts: Prompt[];
  checks: ManualCheck[];
}) {
  const t = dict.adminHelp;
  const [addState, addAction, adding] = useActionState<PromptState, FormData>(
    addGeoPromptAction.bind(null, locale),
    { status: "idle" },
  );
  const [checkState, checkAction] = useActionState<PromptState, FormData>(
    logManualCheckAction.bind(null, locale),
    { status: "idle" },
  );
  const [copied, setCopied] = useState<string | null>(null);

  const checksByPrompt = new Map<string, number>();
  for (const check of checks) {
    checksByPrompt.set(check.prompt_id, (checksByPrompt.get(check.prompt_id) ?? 0) + 1);
  }

  async function copy(prompt: Prompt) {
    try {
      await navigator.clipboard.writeText(prompt.prompt);
      setCopied(prompt.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard refused; the text is on screen to copy by hand */
    }
  }

  return (
    <>
      <form action={addAction} className="mt-6 flex flex-wrap items-end gap-2 rounded-card border border-border bg-card p-4">
        <label className="flex min-w-64 flex-1 flex-col gap-1 text-xs font-semibold text-text-secondary">
          {t.promptsNew}
          <input name="prompt" required minLength={8} maxLength={400} className={`${FIELD_CLASS} text-start`} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-text-secondary">
          {t.promptsLanguage}
          <select name="language" defaultValue="ar" className={FIELD_CLASS}>
            <option value="ar">{t.promptsArabic}</option>
            <option value="en">{t.promptsEnglish}</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={adding}
          className="inline-flex h-10 items-center gap-2 rounded-control bg-brand-solid px-4 text-sm font-semibold text-brand-solid-text disabled:opacity-70"
        >
          <Plus className="size-4" strokeWidth={2} aria-hidden />
          {t.promptsAdd}
        </button>
        {addState.status === "error" ? (
          <p role="alert" className="text-sm text-danger">{t.saveFailed}</p>
        ) : null}
      </form>

      <ul className="mt-6 flex flex-col gap-2">
        {prompts.map((prompt) => (
          <li key={prompt.id} className="rounded-card border border-border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-pill bg-subtle px-2 py-0.5 text-xs font-semibold text-text-tertiary">
                {prompt.language}
              </span>
              <span className="min-w-0 flex-1 text-sm text-text">{prompt.prompt}</span>
              <button
                type="button"
                onClick={() => copy(prompt)}
                aria-label={t.promptsCopy}
                className="inline-flex h-8 items-center gap-1.5 rounded-control border border-border px-2.5 text-xs font-semibold text-text-secondary hover:text-text"
              >
                {copied === prompt.id ? (
                  <Check className="size-3.5 text-success-label" strokeWidth={2.5} aria-hidden />
                ) : (
                  <Copy className="size-3.5" strokeWidth={2} aria-hidden />
                )}
                {t.promptsCopy}
              </button>
              <form action={() => toggleGeoPromptAction(locale, prompt.id, !prompt.is_active)}>
                <button
                  type="submit"
                  className="inline-flex h-8 items-center rounded-control border border-border px-2.5 text-xs font-semibold text-text-secondary hover:text-text"
                >
                  {prompt.is_active ? t.promptsPause : t.promptsResume}
                </button>
              </form>
            </div>

            {/* Log what you saw when you asked it yourself. */}
            <form action={checkAction} className="mt-2 flex flex-wrap items-center gap-2">
              <input type="hidden" name="promptId" value={prompt.id} />
              <select name="provider" className={`${FIELD_CLASS} h-8 max-w-40 py-0 text-xs`}>
                <option value="chatgpt">ChatGPT</option>
                <option value="claude">Claude</option>
                <option value="perplexity">Perplexity</option>
                <option value="gemini">Gemini</option>
              </select>
              <select name="verdict" className={`${FIELD_CLASS} h-8 max-w-48 py-0 text-xs`}>
                <option value="cited">{t.promptsCited}</option>
                <option value="not_cited">{t.promptsNotCited}</option>
                <option value="cited_wrong_page">{t.promptsWrongPage}</option>
              </select>
              <input name="note" placeholder={t.promptsNote} className={`${FIELD_CLASS} h-8 max-w-64 py-0 text-xs`} />
              <button
                type="submit"
                className="inline-flex h-8 items-center rounded-control border border-border px-2.5 text-xs font-semibold text-text-secondary hover:text-text"
              >
                {t.promptsLog}
              </button>
              {checksByPrompt.get(prompt.id) ? (
                <span className="numeral text-xs text-text-tertiary">
                  {t.promptsChecked.replace("{count}", String(checksByPrompt.get(prompt.id)))}
                </span>
              ) : null}
            </form>
          </li>
        ))}
        {prompts.length === 0 ? (
          <li className="text-sm text-text-tertiary">{t.promptsEmpty}</li>
        ) : null}
      </ul>
      {checkState.status === "error" ? (
        <p role="alert" className="mt-3 text-sm text-danger">{t.saveFailed}</p>
      ) : null}
    </>
  );
}
