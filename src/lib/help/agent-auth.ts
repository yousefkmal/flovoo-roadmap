import { NextResponse, type NextRequest } from "next/server";

import { ipHashFrom } from "@/lib/help/request";
import { takeToken } from "@/lib/rate-limit";

/**
 * Access control for the AI Agent's endpoints.
 *
 * The content behind them is public — these are published help articles — so
 * a key is optional rather than a secret that protects anything. Set
 * `HELP_AGENT_API_KEY` and callers must send it; leave it unset and the
 * endpoints are open, which is the honest default for public documentation.
 * Either way the rate limit applies, so a documented, paginated API cannot be
 * turned into a cheap scraping loop.
 */

const apiKey = process.env.HELP_AGENT_API_KEY;
const PER_IP = { limit: 60, windowMs: 60_000 };

export function requireAgentKey(request: NextRequest): NextResponse | null {
  if (apiKey) {
    const header = request.headers.get("authorization") ?? "";
    const presented = header.startsWith("Bearer ") ? header.slice(7) : request.headers.get("x-api-key");
    if (presented !== apiKey) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const ipHash = ipHashFrom(request.headers);
  if (ipHash && !takeToken({ key: `help:agent:${ipHash}`, ...PER_IP })) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  return null;
}
