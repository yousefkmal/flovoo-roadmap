/**
 * The pure half of citation judging, so it can be tested without a network.
 *
 * Kept separate because `citations.ts` is `server-only` and imports the
 * Supabase client; these two functions are the part with the actual logic and
 * the part most likely to be wrong.
 */

/** Hostnames in a block of text, however the model chose to format them. */
export function domainsIn(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/https?:\/\/([^\s/"'<>)\]]+)/gi)) {
    found.add(match[1].toLowerCase().replace(/^www\./, ""));
  }
  // Models often write a bare domain rather than a link.
  for (const match of text.matchAll(
    /\b([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|ai|co|me|app|dev|sa|ae|eg))\b/gi,
  )) {
    found.add(match[1].toLowerCase().replace(/^www\./, ""));
  }
  return [...found];
}

export interface Verdict {
  citedDomains: string[];
  flovooCited: boolean;
  flovooUrls: string[];
  /** Where our first citation appeared among all of them. Null when absent. */
  position: number | null;
  competitorDomains: string[];
}

export function judgeAnswer(answerText: string, ourDomains: string[]): Verdict {
  const ours = ourDomains.map((d) => d.replace(/^www\./, "").toLowerCase());
  const isOurs = (domain: string) =>
    ours.some((o) => domain === o || domain.endsWith(`.${o}`));

  const citedDomains = domainsIn(answerText);
  const flovooUrls = [...answerText.matchAll(/https?:\/\/[^\s"'<>)\]]+/gi)]
    .map((m) => m[0])
    .filter((url) => {
      try {
        return isOurs(new URL(url).hostname.replace(/^www\./, ""));
      } catch {
        return false;
      }
    });

  const index = citedDomains.findIndex(isOurs);
  return {
    citedDomains,
    flovooCited: index !== -1,
    flovooUrls: [...new Set(flovooUrls)],
    position: index === -1 ? null : index + 1,
    competitorDomains: citedDomains.filter((d) => !isOurs(d)),
  };
}
