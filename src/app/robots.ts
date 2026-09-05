import type { MetadataRoute } from "next";

import { absoluteUrl, isHelpIndexable } from "@/lib/help/seo";

/** Public pages are open; the admin, the API and search results are not for crawlers. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/ar/admin",
          "/en/admin",
          "/api/",
          "/ar/help/search",
          "/en/help/search",
          "/ar/search",
          "/en/search",
          // Closed until `help.flovoo.com` is live and the content is ready.
          ...(isHelpIndexable ? [] : ["/ar/help", "/en/help"]),
        ],
      },
    ],
    sitemap: [absoluteUrl("/sitemap/ar.xml"), absoluteUrl("/sitemap/en.xml")],
  };
}
