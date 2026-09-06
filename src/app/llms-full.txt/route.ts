import { buildLlmsFullTxt, LLMS_HEADERS } from "@/lib/help/llms";

/** The whole corpus: heavier to build, same freshness rules. */
export const revalidate = 3600;

export async function GET() {
  return new Response(await buildLlmsFullTxt(), { headers: LLMS_HEADERS });
}
