import "server-only";

import { nodeText, type BlockDocument, type BlockNode } from "@/lib/help/blocks";

/**
 * An article as clean Markdown.
 *
 * This is the cheapest way to hand readable text to an agent or a RAG
 * pipeline: no navigation, no theme, no JSON to unwrap. It is what
 * `<article-url>.md` serves and what `llms-full.txt` is built from.
 *
 * The output is deliberately plain. Callouts become blockquotes, steps become
 * a numbered list, figures become their alt text rather than an image link —
 * a machine reading this wants the meaning, and the alt text is the meaning.
 */

function inline(nodes: BlockNode[] | undefined): string {
  return (nodes ?? [])
    .map((node) => {
      if (node.type === "hardBreak") return "\n";
      if (node.type !== "text") return inline(node.content);
      let text = node.text ?? "";
      for (const mark of node.marks ?? []) {
        if (mark.type === "bold") text = `**${text}**`;
        else if (mark.type === "italic") text = `*${text}*`;
        else if (mark.type === "code") text = `\`${text}\``;
        else if (mark.type === "link") {
          const href = String(mark.attrs?.href ?? "");
          if (href) text = `[${text}](${href})`;
        }
      }
      return text;
    })
    .join("");
}

function block(node: BlockNode, depth = 0): string {
  const pad = "  ".repeat(depth);
  switch (node.type) {
    case "heading": {
      const level = Number(node.attrs?.level ?? 2);
      return `${"#".repeat(Math.min(Math.max(level, 2), 6))} ${inline(node.content)}`;
    }
    case "paragraph":
      return inline(node.content);
    case "bulletList":
      return (node.content ?? [])
        .map((item) => `${pad}- ${items(item, depth)}`)
        .join("\n");
    case "orderedList":
    case "steps":
      return (node.content ?? [])
        .map((item, index) => `${pad}${index + 1}. ${items(item, depth)}`)
        .join("\n");
    case "callout": {
      // The variant is the label a reader would see; keep it, as a quote.
      const variant = String(node.attrs?.variant ?? "info");
      const body = (node.content ?? []).map((c) => block(c, depth)).filter(Boolean).join("\n");
      return body
        .split("\n")
        .map((line, index) => (index === 0 ? `> **${variant}:** ${line}` : `> ${line}`))
        .join("\n");
    }
    case "blockquote":
      return (node.content ?? [])
        .map((c) => block(c, depth))
        .filter(Boolean)
        .join("\n")
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    case "figure": {
      // The alt text is the content; the file itself means nothing to a reader
      // of Markdown, and an unreviewed description is not worth emitting.
      const alt = String(node.attrs?.alt ?? "").trim();
      const caption = String(node.attrs?.caption ?? "").trim();
      const text = caption || alt;
      return text ? `_[${text}]_` : "";
    }
    case "codeBlock":
      return ["```", nodeText(node), "```"].join("\n");
    case "horizontalRule":
      return "---";
    case "table":
      return table(node);
    case "faq":
      return (node.content ?? [])
        .map((item) => {
          const question = String(item.attrs?.question ?? "").trim();
          const answer = (item.content ?? []).map((c) => block(c, depth)).filter(Boolean).join("\n\n");
          return `**${question}**\n\n${answer}`;
        })
        .join("\n\n");
    case "video": {
      const title = String(node.attrs?.title ?? "").trim();
      return title ? `_[video: ${title}]_` : "";
    }
    default:
      return (node.content ?? []).map((c) => block(c, depth)).filter(Boolean).join("\n\n");
  }
}

/** A list item: one paragraph inline, anything richer on its own lines. */
function items(item: BlockNode, depth: number): string {
  const children = item.content ?? [];
  if (children.length === 1 && children[0].type === "paragraph") return inline(children[0].content);
  return children
    .map((c) => block(c, depth + 1))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function table(node: BlockNode): string {
  const rows = node.content ?? [];
  if (!rows.length) return "";
  const cells = (row: BlockNode) =>
    (row.content ?? []).map((cell) =>
      (cell.content ?? []).map((c) => block(c)).join(" ").replace(/\|/g, "\\|").trim(),
    );
  const header = cells(rows[0]);
  const isHeader = (rows[0].content ?? []).every((c) => c.type === "tableHeader");
  const body = (isHeader ? rows.slice(1) : rows).map(cells);
  const lines = [
    `| ${(isHeader ? header : header.map(() => "")).join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...(isHeader ? body : [header, ...body]).map((r) => `| ${r.join(" | ")} |`),
  ];
  return lines.join("\n");
}

export interface MarkdownArticle {
  title: string;
  language: "ar" | "en";
  canonicalUrl: string;
  collection: string;
  updatedAt: string;
  excerpt: string | null;
  body: BlockDocument;
}

/** Front matter plus body. Nothing else — no navigation, no boilerplate. */
export function articleToMarkdown(article: MarkdownArticle): string {
  const front = [
    "---",
    `title: ${JSON.stringify(article.title)}`,
    `language: ${article.language}`,
    `collection: ${JSON.stringify(article.collection)}`,
    `canonical: ${article.canonicalUrl}`,
    `updated: ${article.updatedAt}`,
    "---",
  ];
  const body = (article.body.content ?? [])
    .map((node) => block(node))
    .filter((chunk) => chunk.trim())
    .join("\n\n");
  return [
    front.join("\n"),
    "",
    `# ${article.title}`,
    ...(article.excerpt ? ["", article.excerpt] : []),
    "",
    body,
    "",
  ].join("\n");
}
