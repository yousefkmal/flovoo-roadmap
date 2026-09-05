import { getDictionary, t } from "@/i18n";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/i18n/config";

export interface FooterLink {
  label: string;
  href: string;
}

/**
 * The shared footer. `links` is where a surface points at the rest of Flovoo —
 * the help center lists the roadmap here rather than crowding its header, and
 * more destinations join as they exist.
 */
export function SiteFooter({
  locale,
  updatedAt,
  links = [],
}: {
  locale: Locale;
  updatedAt: string | null;
  links?: FooterLink[];
}) {
  const dict = getDictionary(locale);

  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto flex w-full max-w-board flex-col gap-3 px-5 py-6 text-xs text-text-tertiary sm:flex-row sm:items-center sm:justify-between lg:px-10">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <p className="font-medium">{dict.footer.madeBy}</p>
          {links.length > 0 ? (
            <nav aria-label={dict.footer.linksLabel}>
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="font-medium text-text-secondary transition-colors duration-(--dur-micro) hover:text-text"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
        {updatedAt ? (
          <p className="numeric">
            {t(dict.footer.updatedAt, { date: formatDate(updatedAt, locale) })}
          </p>
        ) : null}
      </div>
    </footer>
  );
}
