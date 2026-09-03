import { getDictionary, t } from "@/i18n";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/i18n/config";

export function SiteFooter({
  locale,
  updatedAt,
}: {
  locale: Locale;
  updatedAt: string | null;
}) {
  const dict = getDictionary(locale);

  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex w-full max-w-board flex-col gap-1 px-5 py-6 text-xs text-text-tertiary sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <p className="font-medium">{dict.footer.madeBy}</p>
        {updatedAt ? (
          <p className="numeric">
            {t(dict.footer.updatedAt, { date: formatDate(updatedAt, locale) })}
          </p>
        ) : null}
      </div>
    </footer>
  );
}
