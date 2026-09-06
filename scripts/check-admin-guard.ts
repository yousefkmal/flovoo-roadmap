/**
 * Requests every admin page WITHOUT a session and fails if the response carries
 * any admin data. The admin layout hiding its children is not enough: a page
 * segment still renders on the server and its props travel in the payload.
 *
 *   npm run check:admin-guard            (against http://localhost:3000)
 *   BASE_URL=https://news.flovoo.com npm run check:admin-guard
 *
 * Add every new admin route to ADMIN_PATHS. The markers are field names that
 * only appear when private rows were serialised; dictionary strings are fine.
 */
const base = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const ADMIN_PATHS = [
  "/ar/admin",
  "/ar/admin/submissions",
  "/ar/admin/changelog",
  "/ar/admin/changelog/new",
  "/ar/admin/help",
  "/ar/admin/help/articles/new",
  "/ar/admin/help/collections",
  "/ar/admin/help/media",
  "/ar/admin/help/redirects",
  "/ar/admin/help/analytics",
  "/ar/admin/help/ai",
  "/ar/admin/help/ai/prompts",
];

/** Serialised-prop names that only exist when private data was rendered. */
const MARKERS = [
  "submitterEmail",
  "internalNote",
  "\"body_plain\"",
  "\"visitor_hash\"",
  "\"storage_path\"",
  "\"source_path\"",
  "\"isAutoDraft\"",
  "\"publicHref\"",
  "\"articleCount\"",
  "\"usageCount\"",
  "\"sessionHash\"",
  "\"zeroResults\"",
  "\"lastSeenLabel\"",
  "\"articleHref\"",
];

let failed = false;
for (const path of ADMIN_PATHS) {
  const response = await fetch(`${base}${path}`, { redirect: "manual" });
  const html = await response.text();
  const hits = MARKERS.filter((marker) => html.includes(marker));
  const ok = hits.length === 0;
  if (!ok) failed = true;
  console.log(`${ok ? "ok  " : "LEAK"} ${response.status} ${path}${ok ? "" : `  → ${hits.join(", ")}`}`);
}

if (failed) {
  console.error("\nAdmin data reached an unauthenticated response. Every admin page must call requireAdminPage() before reading data.");
  process.exit(1);
}
console.log("\nNo admin data in unauthenticated responses.");

export {};
