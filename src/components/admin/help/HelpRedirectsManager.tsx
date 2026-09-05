"use client";

import { useRouter } from "next/navigation";
import { Trash2, Upload } from "lucide-react";
import { useActionState, useEffect, useTransition } from "react";

import {
  deleteHelpRedirectAction,
  importHelpRedirectsAction,
  saveHelpRedirectAction,
  type ImportRedirectsState,
  type RedirectState,
} from "@/app/[locale]/admin/help/actions";
import { errorLabel } from "@/components/admin/help/HelpCollectionsManager";
import { EmptyState } from "@/components/ui/EmptyState";
import { FIELD_CLASS, Field } from "@/components/ui/Field";
import { t, type Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { redirectCountLabel } from "@/lib/help/format";

export interface RedirectRow {
  id: string;
  sourcePath: string;
  targetPath: string;
  statusCode: number;
  hits: number;
  createdLabel: string;
}

export interface NotFoundRow {
  path: string;
  hits: number;
  lastSeenLabel: string;
}

/**
 * A5 — redirects from old addresses. One-at-a-time entry, CSV bulk import for
 * an Intercom export, hit counts to see which old links still matter, and the
 * paths people arrive at that match nothing — the ones that want a redirect.
 */
export function HelpRedirectsManager({
  redirects,
  notFound,
  locale,
  dict,
}: {
  redirects: RedirectRow[];
  notFound: NotFoundRow[];
  locale: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saveState, saveAction, saving] = useActionState<RedirectState, FormData>(
    saveHelpRedirectAction.bind(null, locale),
    { status: "idle" },
  );
  const [importState, importAction, importing] = useActionState<ImportRedirectsState, FormData>(
    importHelpRedirectsAction.bind(null, locale),
    { status: "idle" },
  );

  useEffect(() => {
    if (saveState.status === "saved" || importState.status === "done") router.refresh();
  }, [saveState, importState, router]);

  const errors = saveState.status === "invalid" ? saveState.errors : {};
  const a = dict.adminHelp;

  function remove(row: RedirectRow) {
    if (!window.confirm(t(a.redirectDeleteConfirm, { path: row.sourcePath }))) return;
    startTransition(async () => {
      await deleteHelpRedirectAction(locale, row.id);
      router.refresh();
    });
  }

  return (
    <div className="mt-6 flex flex-col gap-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <form action={saveAction} className="flex flex-col gap-3 rounded-card border border-border bg-card p-5">
          <h2 className="text-sm font-bold text-text">{a.redirectAdd}</h2>
          <Field id="redirect-source" label={a.redirectSource} hint={a.redirectSourceHint} error={errors.source_path ? errorLabel(dict, errors.source_path) : undefined}>
            <input id="redirect-source" name="source_path" dir="ltr" required placeholder="/en/articles/123456-old-title" className={`${FIELD_CLASS} numeral text-start`} />
          </Field>
          <Field id="redirect-target" label={a.redirectTarget} hint={a.redirectTargetHint} error={errors.target_path ? errorLabel(dict, errors.target_path) : undefined}>
            <input id="redirect-target" name="target_path" dir="ltr" required placeholder="/ar/articles/ربط-واتساب-بفلوفو" className={`${FIELD_CLASS} numeral text-start`} />
          </Field>
          {saveState.status === "error" ? <p role="alert" className="text-sm font-medium text-danger">{a.saveFailed}</p> : null}
          <button type="submit" disabled={saving} className="self-start rounded-control bg-brand-solid px-4 py-2 text-sm font-semibold text-brand-solid-text disabled:opacity-60">
            {saving ? a.saving : a.redirectAdd}
          </button>
        </form>

        <form action={importAction} className="flex flex-col gap-3 rounded-card border border-border bg-card p-5">
          <h2 className="text-sm font-bold text-text">{a.redirectImportTitle}</h2>
          <p className="text-xs text-text-tertiary">{a.redirectImportHint}</p>
          <textarea name="csv" dir="ltr" rows={6} required placeholder={a.redirectImportPlaceholder} className={`${FIELD_CLASS} numeral text-start font-mono text-xs`} />
          {importState.status === "done" ? (
            <p role="status" className="text-sm text-text-secondary">
              {t(a.redirectImportDone, { count: redirectCountLabel(dict, locale, importState.imported) })}
              {importState.skipped > 0 ? ` ${t(a.redirectImportSkipped, { count: importState.skipped })}` : ""}
            </p>
          ) : null}
          {importState.status === "error" ? <p role="alert" className="text-sm font-medium text-danger">{a.saveFailed}</p> : null}
          <button type="submit" disabled={importing} className="inline-flex items-center gap-2 self-start rounded-control border border-border px-4 py-2 text-sm font-semibold text-text hover:border-flovoo-blue/40 disabled:opacity-60">
            <Upload className="size-4" strokeWidth={2} aria-hidden />
            {importing ? a.saving : a.redirectImport}
          </button>
        </form>
      </div>

      <section aria-labelledby="help-redirects-list">
        <h2 id="help-redirects-list" className="mb-3 text-sm font-bold text-text">{a.redirectsTitle}</h2>
        {redirects.length === 0 ? (
          <EmptyState title={a.redirectsEmpty} body={a.redirectsHint} />
        ) : (
          <div className="overflow-x-auto rounded-card border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-subtle text-xs font-semibold text-text-secondary">
                <tr>
                  <th scope="col" className="px-3 py-2.5 text-start">{a.redirectSource}</th>
                  <th scope="col" className="px-3 py-2.5 text-start">{a.redirectTarget}</th>
                  <th scope="col" className="px-3 py-2.5 text-start">{a.redirectHits}</th>
                  <th scope="col" className="px-3 py-2.5"><span className="sr-only">{a.redirectDelete}</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {redirects.map((row) => (
                  <tr key={row.id}>
                    <td className="numeral max-w-xs truncate px-3 py-2.5 text-text" dir="ltr">{row.sourcePath}</td>
                    <td className="numeral max-w-xs truncate px-3 py-2.5 text-text-secondary" dir="ltr">{row.targetPath}</td>
                    <td className="numeral px-3 py-2.5 text-text-secondary">{row.hits}</td>
                    <td className="px-3 py-2.5 text-end">
                      <button type="button" disabled={pending} onClick={() => remove(row)} aria-label={a.redirectDelete} className="inline-flex size-8 items-center justify-center rounded-input text-muted hover:bg-subtle hover:text-danger disabled:opacity-40">
                        <Trash2 className="size-4" strokeWidth={2} aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="help-notfound-list">
        <h2 id="help-notfound-list" className="mb-1 text-sm font-bold text-text">{a.notFoundTitle}</h2>
        <p className="mb-3 text-xs text-text-tertiary">{a.notFoundHint}</p>
        {notFound.length === 0 ? (
          <EmptyState compact title={a.notFoundEmpty} />
        ) : (
          <div className="overflow-x-auto rounded-card border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-subtle text-xs font-semibold text-text-secondary">
                <tr>
                  <th scope="col" className="px-3 py-2.5 text-start">{a.redirectSource}</th>
                  <th scope="col" className="px-3 py-2.5 text-start">{a.redirectHits}</th>
                  <th scope="col" className="px-3 py-2.5 text-start">{a.notFoundLastSeen}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {notFound.map((row) => (
                  <tr key={row.path}>
                    <td className="numeral max-w-md truncate px-3 py-2.5 text-text" dir="ltr">{row.path}</td>
                    <td className="numeral px-3 py-2.5 text-text-secondary">{row.hits}</td>
                    <td className="numeric px-3 py-2.5 text-text-tertiary">{row.lastSeenLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
