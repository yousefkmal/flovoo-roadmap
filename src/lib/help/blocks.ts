/**
 * The help center's article body format.
 *
 * Bodies are stored as Tiptap-compatible ProseMirror JSON: a `doc` node whose
 * `content` is a tree of block and inline nodes, with formatting carried as
 * marks on text nodes. Phase 3's editor saves exactly this shape, so nothing
 * here needs migrating once the editor lands. Until then the renderer and the
 * seed are the only producers and consumers.
 *
 * Node types beyond Tiptap's defaults are named here so the renderer, the
 * derivation helpers and the future editor agree on one vocabulary:
 *
 *   steps / step          an ordered procedure — the article format's spine
 *   callout {variant}     info · warning · tip
 *   figure {src, alt, …}  an image with a caption, zoomable in the reader
 *   video {provider, id}  an embedded video behind a click-to-load facade
 *   faq / faqItem {question}
 *
 * Inline: the `ltr` mark wraps IDs, phone numbers and codes so they keep their
 * own direction inside Arabic text.
 */

export interface BlockMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface BlockNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: BlockNode[];
  marks?: BlockMark[];
  text?: string;
}

export interface BlockDocument extends BlockNode {
  type: "doc";
  content: BlockNode[];
}

export interface TocEntry {
  id: string;
  level: 2 | 3;
  text: string;
}

export const CALLOUT_VARIANTS = ["info", "warning", "tip"] as const;
export type CalloutVariant = (typeof CALLOUT_VARIANTS)[number];

export const EMPTY_DOCUMENT: BlockDocument = { type: "doc", content: [] };

/** Every text node under `node`, concatenated. */
export function nodeText(node: BlockNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? []).map(nodeText).join("");
}

/**
 * A URL-safe fragment id built from a heading. Letters and digits of any
 * script are kept, so Arabic headings get Arabic anchors — readable in the
 * address bar and stable across translations of the UI around them.
 */
export function headingId(text: string, taken: Set<string>): string {
  const base =
    text
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .replace(/[\s-]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "section";

  let id = base;
  let n = 2;
  while (taken.has(id)) id = `${base}-${n++}`;
  taken.add(id);
  return id;
}

/**
 * The document with an `id` attribute on every level-2 and level-3 heading,
 * assigned in reading order. The table of contents and the renderer both
 * consume this, which is what keeps their anchors identical.
 */
export function withHeadingIds(doc: BlockDocument): BlockDocument {
  const taken = new Set<string>();
  // Bodies come from a database and from an editor; one missing `content`
  // must degrade to an empty article, never take the page down.
  if (!doc || !Array.isArray(doc.content)) return EMPTY_DOCUMENT;
  return {
    ...doc,
    content: doc.content.map((node) => {
      if (node.type !== "heading") return node;
      const level = Number(node.attrs?.level ?? 2);
      if (level !== 2 && level !== 3) return node;
      return {
        ...node,
        attrs: { ...node.attrs, level, id: headingId(nodeText(node), taken) },
      };
    }),
  };
}

export function buildToc(doc: BlockDocument): TocEntry[] {
  return withHeadingIds(doc).content.flatMap((node) => {
    if (node.type !== "heading") return [];
    const level = node.attrs?.level;
    const id = node.attrs?.id;
    if ((level !== 2 && level !== 3) || typeof id !== "string") return [];
    return [{ id, level, text: nodeText(node).trim() }];
  });
}

/**
 * Plain text for search indexing and RAG. Blocks are separated by blank
 * lines; list items, steps and table cells keep enough structure to read
 * naturally when the text is shown out of context.
 */
export function toPlainText(doc: BlockDocument): string {
  if (!doc || !Array.isArray(doc.content)) return "";
  return doc.content.map(blockText).filter(Boolean).join("\n\n");
}

function blockText(node: BlockNode): string {
  switch (node.type) {
    case "paragraph":
    case "heading":
      return nodeText(node).trim();
    case "bulletList":
    case "orderedList":
    case "steps":
      return (node.content ?? [])
        .map((item, index) => {
          const body = (item.content ?? []).map(blockText).filter(Boolean).join(" ");
          return node.type === "bulletList" ? `- ${body}` : `${index + 1}. ${body}`;
        })
        .join("\n");
    case "callout":
    case "blockquote":
      return (node.content ?? []).map(blockText).filter(Boolean).join("\n");
    case "figure": {
      const caption = String(node.attrs?.caption ?? "").trim();
      const alt = String(node.attrs?.alt ?? "").trim();
      return caption || alt;
    }
    case "video":
      return String(node.attrs?.title ?? "").trim();
    case "table":
      return (node.content ?? [])
        .map((row) =>
          (row.content ?? [])
            .map((cell) => (cell.content ?? []).map(blockText).join(" ").trim())
            .join(" | "),
        )
        .join("\n");
    case "faq":
      return (node.content ?? [])
        .map((item) => {
          const question = String(item.attrs?.question ?? "").trim();
          const answer = (item.content ?? []).map(blockText).filter(Boolean).join(" ");
          return `${question}\n${answer}`;
        })
        .join("\n\n");
    case "codeBlock":
      return nodeText(node);
    default:
      return node.content ? node.content.map(blockText).filter(Boolean).join("\n") : "";
  }
}

export function countNodes(node: BlockNode, type: string): number {
  const own = node.type === type ? 1 : 0;
  return own + (node.content ?? []).reduce((sum, child) => sum + countNodes(child, type), 0);
}

/** Words per minute for a support article; images add a few seconds each. */
const WORDS_PER_MINUTE = 200;
const SECONDS_PER_IMAGE = 12;

export function readingMinutes(plain: string, imageCount: number): number {
  const words = plain.split(/\s+/).filter(Boolean).length;
  const minutes = words / WORDS_PER_MINUTE + (imageCount * SECONDS_PER_IMAGE) / 60;
  return Math.max(1, Math.round(minutes));
}

/**
 * Everything the database stores alongside the body but never asks an editor
 * to maintain: the search text, the table of contents and the reading time.
 * The seed generator calls this now; the admin save action calls it in Phase 3.
 */
export function deriveArticleMeta(doc: BlockDocument): {
  body_plain: string;
  toc: TocEntry[];
  reading_minutes: number;
} {
  const body_plain = toPlainText(doc);
  return {
    body_plain,
    toc: buildToc(doc),
    reading_minutes: readingMinutes(body_plain, countNodes(doc, "figure")),
  };
}
