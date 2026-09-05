import { EMPTY_DOCUMENT, toPlainText, type BlockDocument } from "../help/blocks.ts";

/**
 * Changelog entry bodies.
 *
 * They hold the same ProseMirror JSON as help articles (migration 0012), so
 * the editor and the renderer are the help center's — one vocabulary, no
 * mapping layer between the two products.
 *
 * Pure on purpose: the seed, the database mutations and the client editor all
 * need these, and two of the three cannot import a `server-only` module.
 */

export type ChangelogBody = BlockDocument;

/** Blank-line-separated plain text as a document. */
export function plainToDoc(source: string | null | undefined): BlockDocument {
  const paragraphs = (source ?? "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  return {
    type: "doc",
    content: paragraphs.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
  };
}

/** Whether a value from the database or an editor is a document at all. */
export function isChangelogBody(value: unknown): value is BlockDocument {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { type?: unknown }).type === "doc" &&
    Array.isArray((value as { content?: unknown }).content)
  );
}

/** A document from whatever the caller has, including a legacy plain string. */
export function toChangelogBody(value: unknown): BlockDocument {
  if (isChangelogBody(value)) return value;
  if (typeof value === "string") return plainToDoc(value);
  return EMPTY_DOCUMENT;
}

/** The text of a body, for the feed, for filtering, and for "is this empty?". */
export function bodyText(value: unknown): string {
  return toPlainText(toChangelogBody(value));
}

export function isEmptyBody(value: unknown): boolean {
  return !bodyText(value).trim();
}
