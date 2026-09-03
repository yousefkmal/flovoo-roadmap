import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Request-scoped Supabase client that reads and writes the auth cookies.
 *
 * `setAll` is wrapped because Server Components are not allowed to set cookies:
 * the session is refreshed in the proxy, so a failure to write here is expected
 * and harmless rather than an error.
 */
export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const store = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component; the proxy refreshes the session.
        }
      },
    },
  });
}
