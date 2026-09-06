import Link from "next/link";
import { notFound } from "next/navigation";

import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { getAiVisibility } from "@/lib/data/help-ai-analytics";
import { formatDate } from "@/lib/format";
import { requireAdminPage } from "@/lib/auth/admin";

/** Per-admin and always live, like the rest of the admin. */
export const dynamic = "force-dynamic";

export default async function AiVisibilityPage({ params }: PageProps<"/[locale]/admin/help/ai">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPage();

  const dict = getDictionary(locale);
  const t = dict.adminHelp;
  const data = await getAiVisibility(30);

  const searchOperators = data.operators.filter((o) => o.purpose !== "training");
  const totalHits = data.operators.reduce((sum, o) => sum + o.hits, 0);
  const liveHits = data.operators
    .filter((o) => o.purpose === "user")
    .reduce((sum, o) => sum + o.hits, 0);
  const verified = data.operators.reduce((sum, o) => sum + o.verified_hits, 0);
  const referralTotal = data.referrals.reduce((sum, r) => sum + r.visits, 0);

  const card = "rounded-card border border-border bg-card p-4";
  const th = "px-3 py-2 text-start text-xs font-bold uppercase tracking-wide text-text-tertiary";
  const td = "px-3 py-2 text-sm text-text";

  return (
    <main className="mx-auto w-full max-w-board px-5 py-8 lg:px-10">
      <h1 className="text-2xl/8 font-bold text-text">{t.aiTitle}</h1>
      <p className="mt-1.5 max-w-2xl text-sm text-text-secondary">{t.aiIntro}</p>

      {data.unavailable ? (
        <p className="mt-6 rounded-card border border-border bg-subtle p-4 text-sm text-text-secondary">
          {t.aiUnavailable}
        </p>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className={card}>
              <p className="text-xs font-semibold text-text-tertiary">{t.aiRetrievals}</p>
              <p className="numeral mt-1 text-2xl font-bold text-text">{totalHits}</p>
            </div>
            <div className={card}>
              <p className="text-xs font-semibold text-text-tertiary">{t.aiLiveRetrievals}</p>
              <p className="numeral mt-1 text-2xl font-bold text-text">{liveHits}</p>
              <p className="mt-1 text-xs text-text-tertiary">{t.aiLiveHint}</p>
            </div>
            <div className={card}>
              <p className="text-xs font-semibold text-text-tertiary">{t.aiVerified}</p>
              <p className="numeral mt-1 text-2xl font-bold text-text">{verified}</p>
              <p className="mt-1 text-xs text-text-tertiary">{t.aiVerifiedHint}</p>
            </div>
            <div className={card}>
              <p className="text-xs font-semibold text-text-tertiary">{t.aiReferrals}</p>
              <p className="numeral mt-1 text-2xl font-bold text-text">{referralTotal}</p>
              <p className="mt-1 text-xs text-text-tertiary">{t.aiReferralsFloor}</p>
            </div>
          </div>

          {searchOperators.length === 0 ? (
            <p className="mt-6 rounded-card border border-warning-label bg-warning-tint p-4 text-sm text-warning-label">
              {t.aiNoSearchBots}
            </p>
          ) : null}

          <section className="mt-8">
            <h2 className="text-base font-bold text-text">{t.aiByOperator}</h2>
            <div className="mt-2 overflow-x-auto rounded-card border border-border">
              <table className="w-full border-collapse bg-card">
                <thead className="bg-subtle">
                  <tr>
                    <th className={th}>{t.aiOperator}</th>
                    <th className={th}>{t.aiPurpose}</th>
                    <th className={th}>{t.aiRetrievals}</th>
                    <th className={th}>{t.aiVerified}</th>
                    <th className={th}>{t.aiArticlesTouched}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.operators.map((row) => (
                    <tr key={`${row.operator}-${row.purpose}`}>
                      <td className={`${td} font-semibold`}>{row.operator}</td>
                      <td className={td}>{t[`aiPurpose_${row.purpose}` as keyof typeof t] as string}</td>
                      <td className={`${td} numeral`}>{row.hits}</td>
                      <td className={`${td} numeral`}>{row.verified_hits}</td>
                      <td className={`${td} numeral`}>{row.articles_touched}</td>
                    </tr>
                  ))}
                  {data.operators.length === 0 ? (
                    <tr>
                      <td className={`${td} text-text-tertiary`} colSpan={5}>
                        {t.aiNothingYet}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <div>
              <h2 className="text-base font-bold text-text">{t.aiLiveRetrievals}</h2>
              <p className="mt-1 text-xs text-text-tertiary">{t.aiLiveHint}</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {data.liveRetrievals.map((row, index) => (
                  <li key={index} className="rounded-control border border-border bg-card px-3 py-2 text-sm">
                    <span className="text-text">{row.title}</span>
                    <span className="numeric ms-2 text-xs text-text-tertiary">
                      {row.language} · {formatDate(row.ts, locale)}
                    </span>
                  </li>
                ))}
                {data.liveRetrievals.length === 0 ? (
                  <li className="text-sm text-text-tertiary">{t.aiNothingYet}</li>
                ) : null}
              </ul>
            </div>

            <div>
              <h2 className="text-base font-bold text-text">{t.aiReferralsByPlatform}</h2>
              <p className="mt-1 text-xs text-text-tertiary">{t.aiReferralsFloor}</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {data.referrals.map((row) => (
                  <li
                    key={row.source}
                    className="flex items-center justify-between rounded-control border border-border bg-card px-3 py-2 text-sm"
                  >
                    <span className="text-text">{row.source}</span>
                    <span className="numeral font-semibold text-text-secondary">{row.visits}</span>
                  </li>
                ))}
                {data.referrals.length === 0 ? (
                  <li className="text-sm text-text-tertiary">{t.aiNothingYet}</li>
                ) : null}
              </ul>

              <h2 className="mt-6 text-base font-bold text-text">{t.aiAssistantClicks}</h2>
              <p className="mt-1 text-xs text-text-tertiary">{t.aiAssistantClicksHint}</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {data.assistantClicks.map((row) => (
                  <li
                    key={row.target}
                    className="flex items-center justify-between rounded-control border border-border bg-card px-3 py-2 text-sm"
                  >
                    <span className="text-text">{row.target}</span>
                    <span className="numeral font-semibold text-text-secondary">{row.clicks}</span>
                  </li>
                ))}
                {data.assistantClicks.length === 0 ? (
                  <li className="text-sm text-text-tertiary">{t.aiNothingYet}</li>
                ) : null}
              </ul>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-base font-bold text-text">{t.aiPerArticle}</h2>
            <div className="mt-2 overflow-x-auto rounded-card border border-border">
              <table className="w-full border-collapse bg-card">
                <thead className="bg-subtle">
                  <tr>
                    <th className={th}>{t.aiArticle}</th>
                    <th className={th}>{t.aiRetrievals}</th>
                    <th className={th}>{t.aiLiveRetrievals}</th>
                    <th className={th}>{t.aiReferrals}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.topArticles.map((row) => (
                    <tr key={row.articleId}>
                      <td className={`${td} max-w-md truncate`}>{row.title}</td>
                      <td className={`${td} numeral`}>{row.retrievals}</td>
                      <td className={`${td} numeral`}>{row.liveRetrievals}</td>
                      <td className={`${td} numeral`}>{row.aiReferrals}</td>
                    </tr>
                  ))}
                  {data.topArticles.length === 0 ? (
                    <tr>
                      <td className={`${td} text-text-tertiary`} colSpan={4}>
                        {t.aiNothingYet}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <div>
              <h2 className="text-base font-bold text-text">{t.aiNeverRetrieved}</h2>
              <p className="mt-1 text-xs text-text-tertiary">{t.aiNeverRetrievedHint}</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {data.neverRetrieved.map((row, index) => (
                  <li key={index} className="rounded-control border border-border bg-card px-3 py-2 text-sm text-text">
                    {row.title}
                    <span className="numeric ms-2 text-xs text-text-tertiary">{row.language}</span>
                  </li>
                ))}
                {data.neverRetrieved.length === 0 ? (
                  <li className="text-sm text-text-tertiary">{t.aiNothingYet}</li>
                ) : null}
              </ul>
            </div>

            <div>
              <h2 className="text-base font-bold text-text">{t.aiIndexNow}</h2>
              <ul className="mt-2 flex flex-col gap-1.5">
                {data.indexNow.map((ping, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between rounded-control border border-border bg-card px-3 py-2 text-sm"
                  >
                    <span className={ping.ok ? "text-success-label" : "text-danger"}>
                      {ping.ok ? t.aiPingOk : t.aiPingFailed}
                      <span className="numeric ms-2 text-xs text-text-tertiary">
                        {ping.urls} · {formatDate(ping.submittedAt, locale)}
                      </span>
                    </span>
                    <span className="numeral text-xs text-text-tertiary">{ping.statusCode ?? "—"}</span>
                  </li>
                ))}
                {data.indexNow.length === 0 ? (
                  <li className="text-sm text-text-tertiary">{t.aiNoPings}</li>
                ) : null}
              </ul>
            </div>
          </section>

          <section className="mt-10 border-t border-border pt-8">
            <h2 className="text-base font-bold text-text">{t.citTitle}</h2>
            <p className="mt-1 max-w-2xl text-sm text-text-secondary">{t.citIntro}</p>

            <p className="mt-2 text-sm">
              <Link href={`/${locale}/admin/help/ai/prompts`} className="text-link hover:underline">
                {t.promptsTitle}
              </Link>
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {data.providerStatus.map((provider) => (
                <span
                  key={provider.id}
                  className={`rounded-pill px-2.5 py-1 text-xs font-semibold ${
                    provider.configured
                      ? "bg-success-tint text-success-label"
                      : "bg-subtle text-text-tertiary"
                  }`}
                >
                  {provider.label} · {provider.configured ? t.citConfigured : t.citNotConfigured}
                </span>
              ))}
              <span className="numeric rounded-pill bg-subtle px-2.5 py-1 text-xs font-semibold text-text-tertiary">
                {t.citPrompts.replace("{count}", String(data.promptCount))}
              </span>
            </div>

            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-bold text-text">{t.citShare}</h3>
                <div className="mt-2 overflow-x-auto rounded-card border border-border">
                  <table className="w-full border-collapse bg-card">
                    <thead className="bg-subtle">
                      <tr>
                        <th className={th}>{t.citProvider}</th>
                        <th className={th}>{t.citLanguage}</th>
                        <th className={th}>{t.citRuns}</th>
                        <th className={th}>{t.citCited}</th>
                        <th className={th}>{t.citSharePct}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.citationShare.map((row) => (
                        <tr key={`${row.provider}-${row.language}`}>
                          <td className={`${td} font-semibold`}>{row.provider}</td>
                          <td className={td}>{row.language}</td>
                          <td className={`${td} numeral`}>{row.runs}</td>
                          <td className={`${td} numeral`}>{row.cited}</td>
                          <td className={`${td} numeral font-bold`}>{row.share}%</td>
                        </tr>
                      ))}
                      {data.citationShare.length === 0 ? (
                        <tr>
                          <td className={`${td} text-text-tertiary`} colSpan={5}>
                            {t.citNoRuns}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-text">{t.citCompetitors}</h3>
                <p className="mt-1 text-xs text-text-tertiary">{t.citCompetitorsHint}</p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {data.competitors.map((row) => (
                    <li
                      key={row.domain}
                      className="flex items-center justify-between rounded-control border border-border bg-card px-3 py-2 text-sm"
                    >
                      <span className="text-text">{row.domain}</span>
                      <span className="numeral font-semibold text-text-secondary">{row.mentions}</span>
                    </li>
                  ))}
                  {data.competitors.length === 0 ? (
                    <li className="text-sm text-text-tertiary">{t.citNoRuns}</li>
                  ) : null}
                </ul>
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
