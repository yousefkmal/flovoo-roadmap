/**
 * The site's own absolute address.
 *
 * Share cards need absolute URLs — WhatsApp and Slack fetch the page from
 * outside and cannot resolve a relative `og:image`. Vercel supplies the
 * project's production domain, which is right until a custom domain is added,
 * so `NEXT_PUBLIC_SITE_URL` overrides it.
 */
export function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return new URL(`https://${vercel}`);

  return new URL("http://localhost:3000");
}
