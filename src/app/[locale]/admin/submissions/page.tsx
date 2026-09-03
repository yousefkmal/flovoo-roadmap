import { notFound } from "next/navigation";

import {
  ModerationQueue,
  type QueueSubmission,
} from "@/components/admin/ModerationQueue";
import { getDictionary } from "@/i18n";
import { isLocale } from "@/i18n/config";
import { getAllFeatures, getSubmissions } from "@/lib/data/admin-repository";
import { getCategories } from "@/lib/data/repository";
import { formatDate } from "@/lib/format";

export default async function ModerationPage({
  params,
}: PageProps<"/[locale]/admin/submissions">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const dict = getDictionary(locale);
  const [submissions, categories, features] = await Promise.all([
    getSubmissions("pending"),
    getCategories(),
    getAllFeatures(),
  ]);

  const views: QueueSubmission[] = submissions.map((submission) => ({
    id: submission.id,
    title: submission.title,
    description: submission.description,
    submitterName: submission.submitterName,
    submitterEmail: submission.submitterEmail,
    language: submission.language,
    categoryId: submission.categoryId,
    dateLabel: formatDate(submission.createdAt, locale),
  }));

  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-8 lg:px-10">
      <h1 className="text-2xl/8 font-bold text-text">{dict.admin.submissions}</h1>

      <ModerationQueue
        submissions={views}
        categories={categories.map((c) => ({
          id: c.id,
          name: locale === "ar" ? c.name_ar : c.name_en,
        }))}
        // Archived items are not somewhere to fold a live idea into.
        mergeTargets={features
          .filter((f) => f.status !== "archived")
          .map((f) => ({
            id: f.id,
            title: locale === "ar" ? f.title_ar : f.title_en,
            statusLabel: dict.status[f.status],
          }))}
        locale={locale}
        dict={dict}
      />
    </main>
  );
}
