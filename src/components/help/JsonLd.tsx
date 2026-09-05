/**
 * Emits one JSON-LD block. The payload is built server-side from our own data
 * and serialised with `<` escaped, so a title containing `</script>` cannot
 * break out of the tag.
 */
export function JsonLd({ data }: { data: unknown }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
