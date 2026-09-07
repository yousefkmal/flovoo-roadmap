import { buildLlmsFullMd, LLMS_MD_HEADERS } from "@/lib/help/llms";

/** The help center in English, as one Markdown file to upload. */
export const revalidate = 3600;

export async function GET() {
  return new Response(await buildLlmsFullMd("en"), { headers: LLMS_MD_HEADERS });
}
