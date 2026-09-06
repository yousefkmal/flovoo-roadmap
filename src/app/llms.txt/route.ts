import { buildLlmsTxt, LLMS_HEADERS } from "@/lib/help/llms";

/** Revalidated on publish; an hour is plenty in between. */
export const revalidate = 3600;

export async function GET() {
  return new Response(await buildLlmsTxt(), { headers: LLMS_HEADERS });
}
