import type { Metadata } from "next";
import { JetBrains_Mono, Noto_Sans_Arabic, Plus_Jakarta_Sans } from "next/font/google";
import { notFound } from "next/navigation";

import "@/app/globals.css";
import { DIRECTION, LOCALES, isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

/*
 * Root layout. Every route lives under `/[locale]`, so `lang` and `dir` are set
 * on <html> itself rather than patched in on the client.
 *
 * Fonts are the three the design system names: Plus Jakarta Sans for UI, Noto
 * Sans Arabic for Arabic, JetBrains Mono for counts and dates.
 */

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const notoArabic = Noto_Sans_Arabic({
  variable: "--font-noto-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const dict = getDictionary(locale);

  return {
    title: { default: dict.site.title, template: `%s · ${dict.site.name}` },
    description: dict.site.metaDescription,
    alternates: {
      canonical: `/${locale}`,
      languages: { ar: "/ar", en: "/en" },
    },
    openGraph: {
      title: dict.site.title,
      description: dict.site.metaDescription,
      locale: locale === "ar" ? "ar_EG" : "en_US",
      type: "website",
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html
      lang={locale}
      dir={DIRECTION[locale]}
      className={`${jakarta.variable} ${notoArabic.variable} ${jetbrains.variable} h-full`}
      // `data-theme` is set by the script below, before React hydrates.
      suppressHydrationWarning
    >
      <head>
        {/* Runs before first paint so the page never renders light and flips. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col bg-page text-text">{children}</body>
    </html>
  );
}
