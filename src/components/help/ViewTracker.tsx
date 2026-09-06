"use client";

import { useEffect } from "react";

import type { Locale } from "@/lib/types";

/**
 * Counts one read of an article. The page is static, so this is the only place
 * a view can be observed; it fires once per article per browser session.
 *
 * The session id is random, lives in `sessionStorage`, and is hashed again on
 * the server — it identifies a visit, never a person, and disappears when the
 * tab closes.
 */

const SESSION_KEY = "flovoo-help-session";
const SEEN_PREFIX = "flovoo-help-seen:";

function sessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    // Private modes throw; a per-load id still counts the read once.
    return crypto.randomUUID();
  }
}

export function ViewTracker({ articleId, locale }: { articleId: string; locale: Locale }) {
  useEffect(() => {
    const seenKey = `${SEEN_PREFIX}${articleId}`;
    try {
      if (sessionStorage.getItem(seenKey)) return;
      sessionStorage.setItem(seenKey, "1");
    } catch {
      // Not remembered; at worst the same visit counts twice.
    }

    const payload = JSON.stringify({
      articleId,
      locale,
      session: sessionId(),
      referrer: document.referrer || null,
      // Some assistants tag the link instead of sending a referrer.
      utmSource: new URLSearchParams(window.location.search).get("utm_source"),
    });

    // A beacon survives the reader navigating away immediately.
    if (!navigator.sendBeacon?.("/api/help/view", new Blob([payload], { type: "application/json" }))) {
      void fetch("/api/help/view", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => undefined);
    }
  }, [articleId, locale]);

  return null;
}
