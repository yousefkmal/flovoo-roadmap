import { indexNowKey } from "@/lib/help/indexnow";

/**
 * IndexNow verifies ownership by fetching `https://host/<key>.txt` and
 * expecting the key back. `next.config.ts` rewrites that address here, so the
 * key stays an environment variable rather than a committed file.
 */
export async function GET() {
  if (!indexNowKey) return new Response("Not found", { status: 404 });
  return new Response(indexNowKey, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
