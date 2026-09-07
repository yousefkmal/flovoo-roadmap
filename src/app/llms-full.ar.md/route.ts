import { buildLlmsFullMd, LLMS_MD_HEADERS } from "@/lib/help/llms";

/** The help center in Arabic, as one Markdown file to upload. */
export const revalidate = 3600;

export async function GET() {
  return new Response(await buildLlmsFullMd("ar"), { headers: LLMS_MD_HEADERS });
}
