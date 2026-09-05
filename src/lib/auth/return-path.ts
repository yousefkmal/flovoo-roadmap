/**
 * Where to send someone after they sign in.
 *
 * The path used to ride on the callback URL as `?next=…`. Supabase matches a
 * redirect URL against its allow list as a whole string (anything on the Site
 * URL's own host is exempt), so on localhost the query string made the callback
 * fail the match and the browser landed on the production site instead. The
 * path now travels in a short-lived cookie and the callback URL is exactly the
 * one listed in the Supabase dashboard.
 */
export const AUTH_RETURN_COOKIE = "flovoo_auth_next";
/** Ten minutes: long enough to finish a Google or email sign-in, no longer. */
export const AUTH_RETURN_MAX_AGE = 10 * 60;

/** Only local paths are ever followed — an open redirect here is a phishing vector. */
export function safeReturnPath(raw: string | undefined, fallback: string): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;
}
