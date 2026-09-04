"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { TriangleAlert, X } from "lucide-react";

import type { Dictionary } from "@/i18n";

/**
 * Says why a sign-in attempt came back empty.
 *
 * Two sources land in the URL. Our own callback appends `?auth=...` when it
 * cannot finish the exchange. Supabase appends `error_code` when it rejects the
 * link before we ever see it — an expired or already-used one, most often.
 * Neither was read before, so a failed sign-in returned people to the board
 * with no explanation and nothing to act on.
 */
export function AuthNotice({ dict }: { dict: Dictionary }) {
  const params = useSearchParams();
  const [dismissed, setDismissed] = useState(false);

  const code = params.get("error_code") ?? params.get("auth");
  if (!code || dismissed) return null;

  const messages: Record<string, string> = {
    otp_expired: dict.auth.errorExpired,
    access_denied: dict.auth.errorExpired,
    missing_code: dict.auth.errorExpired,
    failed: dict.auth.errorFailed,
    unconfigured: dict.auth.errorUnconfigured,
  };

  return (
    <div
      role="alert"
      className="mx-auto mt-4 flex w-full max-w-6xl items-start gap-3 rounded-card border border-danger/30 bg-danger-tint px-4 py-3"
    >
      <TriangleAlert className="mt-0.5 size-5 shrink-0 text-danger" strokeWidth={2} aria-hidden />
      <p className="flex-1 text-sm text-text">{messages[code] ?? dict.auth.errorFailed}</p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={dict.detail.close}
        className="shrink-0 rounded-input p-1 text-text-secondary transition-colors duration-(--dur-micro) hover:text-text"
      >
        <X className="size-4" strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
