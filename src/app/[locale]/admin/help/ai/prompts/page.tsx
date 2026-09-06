import { notFound } from "next/navigation";

import { GeoPromptsManager } from "@/components/admin/help/GeoPromptsManager";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { getServiceSupabase } from "@/lib/data/supabase-admin";
import { requireAdminPage } from "@/lib/auth/admin";

/** The question set behind the citation checks, and the manual audit helper. */
export const dynamic = "force-dynamic";

export default async function GeoPromptsPage({
  params,
}: PageProps<"/[locale]/admin/help/ai/prompts">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdminPage();

  const dict = getDictionary(locale);
  const supabase = getServiceSupabase();

  const prompts = supabase
    ? ((
        await supabase
          .from("help_geo_prompts")
          .select("id, prompt, language, is_active, source")
          .order("language")
          .order("created_at")
      ).data ?? [])
    : [];

  const checks = supabase
    ? ((
        await supabase
          .from("help_geo_manual_checks")
          .select("prompt_id, provider, verdict, ts")
          .order("ts", { ascending: false })
          .limit(50)
      ).data ?? [])
    : [];

  return (
    <main className="mx-auto w-full max-w-board px-5 py-8 lg:px-10">
      <h1 className="text-2xl/8 font-bold text-text">{dict.adminHelp.promptsTitle}</h1>
      <p className="mt-1.5 max-w-2xl text-sm text-text-secondary">{dict.adminHelp.promptsIntro}</p>
      <GeoPromptsManager
        locale={locale}
        dict={dict}
        prompts={prompts as never}
        checks={checks as never}
      />
    </main>
  );
}
