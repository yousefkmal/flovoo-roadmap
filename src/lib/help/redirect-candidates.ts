/**
 * Which stored redirect rows a failed request should be matched against.
 *
 * Pure and dependency-free so it can be unit tested and reused by the
 * migration tooling, which cannot import a `server-only` module. `redirects.ts`
 * re-exports it; import from there inside the app.
 */
export type RedirectLocale = "ar" | "en";

/**
 * The public spellings of a request, most specific first.
 *
 * Four things vary and any of them can differ between the link somebody saved
 * and the row that was stored for it:
 *
 *   the locale prefix   present, as a bilingual export writes it, or absent
 *   percent-encoding    an Arabic slug is readable in the table and encoded in
 *                       the request, so both spellings are offered
 *   the trailing slug   an Intercom address is `<id>-<slug>`, and the slug was
 *                       whatever the title said on the day the link was copied.
 *                       The id alone identifies the article for good, so it is
 *                       always tried last.
 *
 * Order is preference order: `help_redirect_hit` takes the first row that
 * matches, so an exact address always wins over an id-only fallback.
 */
export function redirectCandidates(locale: RedirectLocale, publicPath: string): string[] {
  const stripLocale = (path: string) => path.replace(/^\/(ar|en)(?=\/|$)/, "");
  const decode = (path: string) => {
    try {
      return decodeURIComponent(path);
    } catch {
      return path;
    }
  };
  /** `/ar/articles/16536857-how-to-x` → `/ar/articles/16536857` */
  const idOnly = (path: string) => {
    const match = path.match(/^(.*\/)(\d+)-.*$/);
    return match ? `${match[1]}${match[2]}` : null;
  };

  const spellings = [publicPath, decode(publicPath)];
  const candidates: string[] = [];
  for (const spelling of spellings) {
    candidates.push(`/${locale}${stripLocale(spelling)}`, stripLocale(spelling));
  }
  for (const spelling of spellings) {
    const bare = idOnly(spelling);
    if (bare) candidates.push(`/${locale}${stripLocale(bare)}`, stripLocale(bare));
  }
  return [...new Set(candidates.filter((c) => c.startsWith("/") && c.length > 1))];
}
