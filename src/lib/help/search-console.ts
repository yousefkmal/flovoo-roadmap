import "server-only";

/**
 * What Google Search actually sends the help center.
 *
 * Every other number in the AI dashboard is something we measured ourselves:
 * crawler hits we logged, views we beaconed, citations we asked for. This is
 * the one source that reports what real people searched and clicked, and the
 * help center has been reasoning without it since launch.
 *
 * Optional, and silent when unconfigured — the same contract the citation
 * providers follow. "Not configured" is shown differently from zero, because
 * zero would claim nobody found us, which we would not know.
 *
 * Auth is a Google service account: a JSON key in `GOOGLE_SERVICE_ACCOUNT_JSON`
 * and that account added as a user on the property in Search Console. No
 * OAuth dance, no refresh tokens, nothing interactive — it is the only shape
 * that works for a server reading its own data on a schedule.
 */

const SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Search Console addresses a domain property this way. */
const PROPERTY = "sc-domain:flovoo.com";

export interface SearchConsoleRow {
  /** The page, or the query, depending on what was asked for. */
  key: string;
  clicks: number;
  impressions: number;
  /** 0–1. */
  ctr: number;
  /** Average position; lower is better. */
  position: number;
}

export interface SearchConsoleReport {
  configured: boolean;
  /** Absent when `configured` is false. */
  topPages?: SearchConsoleRow[];
  topQueries?: SearchConsoleRow[];
  totals?: { clicks: number; impressions: number };
  days?: number;
  error?: string;
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

function serviceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!parsed.client_email || !parsed.private_key) return null;
    // A key pasted into an env var usually arrives with literal \n.
    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
}

export function isSearchConsoleConfigured(): boolean {
  return serviceAccount() !== null;
}

function base64Url(bytes: Uint8Array | string): string {
  const raw =
    typeof bytes === "string" ? bytes : String.fromCharCode(...Array.from(bytes));
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** PEM to the ArrayBuffer WebCrypto wants. */
function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * A signed JWT exchanged for an access token.
 *
 * Done by hand with WebCrypto rather than pulling in googleapis, which is a
 * very large dependency for two HTTP calls.
 */
async function accessToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(
    JSON.stringify({
      iss: account.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claims}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToPkcs8(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)),
  );

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${base64Url(signature)}`,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`token ${response.status}`);
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("no access_token");
  return body.access_token;
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function query(
  token: string,
  dimension: "page" | "query",
  days: number,
  rowLimit: number,
): Promise<SearchConsoleRow[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(
    PROPERTY,
  )}/searchAnalytics/query`;

  const response = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      startDate: iso(start),
      endDate: iso(end),
      dimensions: [dimension],
      rowLimit,
      // Only what the help center serves; the roadmap is a different question.
      dimensionFilterGroups:
        dimension === "page"
          ? [
              {
                filters: [
                  { dimension: "page", operator: "contains", expression: "help.flovoo.com" },
                ],
              },
            ]
          : undefined,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`query ${response.status}`);
  const body = (await response.json()) as {
    rows?: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }[];
  };
  return (body.rows ?? []).map((row) => ({
    key: row.keys[0],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }));
}

/** Never throws. An unconfigured or failing report is data, not an exception. */
export async function getSearchConsoleReport(days = 28): Promise<SearchConsoleReport> {
  const account = serviceAccount();
  if (!account) return { configured: false };

  try {
    const token = await accessToken(account);
    const [topPages, topQueries] = await Promise.all([
      query(token, "page", days, 20),
      query(token, "query", days, 20),
    ]);
    const totals = topPages.reduce(
      (sum, row) => ({
        clicks: sum.clicks + row.clicks,
        impressions: sum.impressions + row.impressions,
      }),
      { clicks: 0, impressions: 0 },
    );
    return { configured: true, topPages, topQueries, totals, days };
  } catch (error) {
    return { configured: true, error: (error as Error).message, days };
  }
}
