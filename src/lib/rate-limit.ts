import "server-only";

/**
 * A sliding-window limiter held in process memory.
 *
 * That is the right shape for a single instance and the wrong shape for a fleet
 * — each instance would keep its own counts. It is paired with a database check
 * on submissions (see `mutations.ts`), which is the limit that actually has to
 * hold; this one absorbs bursts cheaply before anything touches the database.
 */

const windows = new Map<string, number[]>();

/** Keeps the map from growing without bound on a long-lived process. */
let lastSweep = 0;
const SWEEP_INTERVAL = 5 * 60_000;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL) return;
  lastSweep = now;
  for (const [key, hits] of windows) {
    if (hits.length === 0 || now - hits[hits.length - 1] > 60 * 60_000) {
      windows.delete(key);
    }
  }
}

export interface RateLimit {
  /** Identifier the window is kept against — an email hash, an IP hash. */
  key: string;
  limit: number;
  windowMs: number;
}

/**
 * Records a hit and reports whether it was allowed. A rejected hit is not
 * recorded, so hammering a blocked key cannot extend the block.
 */
export function takeToken({ key, limit, windowMs }: RateLimit): boolean {
  const now = Date.now();
  sweep(now);

  const hits = (windows.get(key) ?? []).filter((at) => now - at < windowMs);
  if (hits.length >= limit) {
    windows.set(key, hits);
    return false;
  }

  hits.push(now);
  windows.set(key, hits);
  return true;
}

/** Test seam — the limiter is module state and would otherwise leak between tests. */
export function resetRateLimits() {
  windows.clear();
}
