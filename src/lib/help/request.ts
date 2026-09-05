import "server-only";

import { createHash } from "node:crypto";

/**
 * Coarse request identity for rate limiting and duplicate detection. Only
 * hashes leave this module — the raw address and user agent are never stored,
 * which is what "privacy-light, no PII" in the brief means in practice.
 */

function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || headers.get("x-real-ip") || null;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** For rate limiting: the address alone, hashed. Null when there is none (local dev). */
export function ipHashFrom(headers: Headers): string | null {
  const ip = clientIp(headers);
  return ip ? sha256(ip) : null;
}

/**
 * For feedback: address plus user agent, hashed, so two people behind one
 * office connection are usually told apart. Falls back to a fixed value in
 * local development where neither header exists.
 */
export function visitorHashFrom(headers: Headers): string {
  const ip = clientIp(headers) ?? "local";
  const agent = headers.get("user-agent") ?? "";
  return sha256(`${ip}|${agent}`);
}
