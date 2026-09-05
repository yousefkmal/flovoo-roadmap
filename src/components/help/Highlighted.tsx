import type { SnippetPart } from "@/lib/help/search";

/**
 * Renders a snippet with its matching words marked. `<mark>` carries meaning
 * to assistive technology; the tint is the brand tint, not a highlighter
 * yellow, so it stays Flovoo in both themes.
 */
export function Highlighted({ parts }: { parts: SnippetPart[] }) {
  return (
    <>
      {parts.map((part, index) =>
        part.match ? (
          <mark key={index} className="rounded-[3px] bg-info-tint px-0.5 text-link">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}
