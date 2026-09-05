/**
 * Turns an Intercom article body (HTML) into the ProseMirror JSON this help
 * center stores.
 *
 * Migration-only code. It is deliberately strict: anything it does not
 * recognise is reported rather than dropped, so the import can refuse to run
 * and the unknown thing reaches a human. Intercom is being closed — a tag
 * silently swallowed here is content nobody can get back.
 *
 * The mappings the user decided on:
 *   h1 → heading 2 (the page title is already the h1), h4 → heading 3
 *   callout colour → variant: green = tip, grey = info, yellow = warning
 *   alignment (`intercom-align-*`) is dropped, the content is kept
 */

// ---------------------------------------------------------------------------
// A small HTML parser. Intercom's output is machine-generated and well formed,
// so this handles exactly what that output contains and complains otherwise.
// ---------------------------------------------------------------------------

export interface Element {
  kind: "element";
  tag: string;
  attrs: Record<string, string>;
  children: Node[];
}
export interface TextNode {
  kind: "text";
  text: string;
}
export type Node = Element | TextNode;

const VOID_TAGS = new Set(["br", "hr", "img", "input", "meta", "link", "source", "wbr"]);

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  middot: "·",
  bull: "•",
  laquo: "«",
  raquo: "»",
  times: "×",
  deg: "°",
  copy: "©",
  reg: "®",
  trade: "™",
  euro: "€",
  pound: "£",
  shy: "",
  zwnj: "‌",
  zwj: "‍",
  rlm: "‏",
  lrm: "‎",
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      return String.fromCodePoint(parseInt(body.slice(2), 16));
    }
    if (body.startsWith("#")) return String.fromCodePoint(parseInt(body.slice(1), 10));
    const named = NAMED_ENTITIES[body];
    return named === undefined ? whole : named;
  });
}

export function parseHtml(html: string): Node[] {
  const root: Element = { kind: "element", tag: "#root", attrs: {}, children: [] };
  const stack: Element[] = [root];
  const tokens = /<!--[\s\S]*?-->|<\/([a-zA-Z][a-zA-Z0-9]*)\s*>|<([a-zA-Z][a-zA-Z0-9]*)((?:[^<>"']|"[^"]*"|'[^']*')*)\/?>/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  const pushText = (raw: string) => {
    if (!raw) return;
    stack[stack.length - 1].children.push({ kind: "text", text: decodeEntities(raw) });
  };

  while ((match = tokens.exec(html)) !== null) {
    pushText(html.slice(cursor, match.index));
    cursor = match.index + match[0].length;

    if (match[0].startsWith("<!--")) continue;

    if (match[1]) {
      const tag = match[1].toLowerCase();
      // Close the nearest matching element; a stray close tag is ignored
      // rather than allowed to unwind the whole document.
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const tag = match[2].toLowerCase();
    const attrs: Record<string, string> = {};
    for (const attr of match[3].matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
      const value = attr[3] ?? attr[4] ?? attr[5] ?? "";
      attrs[attr[1].toLowerCase()] = decodeEntities(value);
    }

    const element: Element = { kind: "element", tag, attrs, children: [] };
    stack[stack.length - 1].children.push(element);
    if (!VOID_TAGS.has(tag) && !match[0].endsWith("/>")) stack.push(element);
  }
  pushText(html.slice(cursor));
  return root.children;
}

// ---------------------------------------------------------------------------
// HTML → ProseMirror
// ---------------------------------------------------------------------------

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

export interface ConvertOptions {
  /** Original image URL → the `src` to store. Returning null reports the image as unresolved. */
  resolveImage: (url: string) => { src: string; width: number | null; height: number | null } | null;
  /** Rewrites a link that pointed at the old help centre. Return null to leave it alone. */
  resolveLink?: (href: string) => string | null;
}

export interface ConvertResult {
  doc: { type: "doc"; content: BlockNode[] };
  /** Tags, attributes and shapes that had no mapping. Non-empty means stop. */
  unhandled: string[];
  /** Image URLs `resolveImage` could not place. */
  unresolvedImages: string[];
  /** Every heading's Intercom anchor id paired with its text, for fragment rewriting. */
  anchors: { id: string; text: string; level: 2 | 3 }[];
}

/** Callout background colour → our three variants (the user's decision 6). */
const CALLOUT_VARIANT: Record<string, "info" | "warning" | "tip"> = {
  "#d7efdc": "tip", // green
  "#e8e8e8": "info", // grey
  "#feedaf": "warning", // yellow
};

const INLINE_MARK: Record<string, string> = {
  b: "bold",
  strong: "bold",
  i: "italic",
  em: "italic",
  u: "underline",
  s: "strike",
  strike: "strike",
  del: "strike",
  code: "code",
  span: "",
  font: "",
};

const IGNORED_BLOCK_WRAPPERS = new Set([
  "intercom-container",
  "intercom-align-center",
  "intercom-align-left",
  "intercom-align-right",
  "intercom-interblocks-table-container",
]);

export function convertBody(html: string, options: ConvertOptions): ConvertResult {
  const unhandled: string[] = [];
  const unresolvedImages: string[] = [];
  const anchors: { id: string; text: string; level: 2 | 3 }[] = [];
  const note = (what: string) => {
    if (!unhandled.includes(what)) unhandled.push(what);
  };

  // -- inline -------------------------------------------------------------
  function inline(nodes: Node[], marks: BlockMark[]): BlockNode[] {
    const out: BlockNode[] = [];
    for (const node of nodes) {
      if (node.kind === "text") {
        if (!node.text) continue;
        out.push(marks.length ? { type: "text", text: node.text, marks } : { type: "text", text: node.text });
        continue;
      }
      if (node.tag === "br") {
        out.push({ type: "hardBreak" });
        continue;
      }
      if (node.tag === "a") {
        const raw = node.attrs.href ?? "";
        const href = options.resolveLink?.(raw) ?? raw;
        if (!href) {
          out.push(...inline(node.children, marks));
          continue;
        }
        const linkMark: BlockMark = { type: "link", attrs: { href, target: node.attrs.target || null } };
        out.push(...inline(node.children, [...marks, linkMark]));
        continue;
      }
      const markType = INLINE_MARK[node.tag];
      if (markType !== undefined) {
        out.push(...inline(node.children, markType ? [...marks, { type: markType }] : marks));
        continue;
      }
      // A block element inside inline context: keep its text rather than lose it.
      note(`<${node.tag}> appeared inside inline content`);
      out.push(...inline(node.children, marks));
    }
    return out;
  }

  /** Inline content with the leading/trailing whitespace HTML would collapse. */
  function trimmedInline(nodes: Node[]): BlockNode[] {
    const content = inline(nodes, []);
    const collapsed = content
      .map((n) => (n.type === "text" ? { ...n, text: n.text!.replace(/[ \t\r\n]+/g, " ") } : n))
      .filter((n) => n.type !== "text" || n.text !== "");
    while (collapsed.length && collapsed[0].type === "text") {
      const trimmed = collapsed[0].text!.replace(/^ +/, "");
      if (trimmed) {
        collapsed[0] = { ...collapsed[0], text: trimmed };
        break;
      }
      collapsed.shift();
    }
    for (let i = collapsed.length - 1; i >= 0; i--) {
      if (collapsed[i].type !== "text") break;
      const trimmed = collapsed[i].text!.replace(/ +$/, "");
      if (trimmed) {
        collapsed[i] = { ...collapsed[i], text: trimmed };
        break;
      }
      collapsed.pop();
    }
    return collapsed;
  }

  function textOf(nodes: BlockNode[]): string {
    return nodes.map((n) => (n.type === "text" ? n.text ?? "" : n.type === "hardBreak" ? "\n" : "")).join("");
  }

  // -- blocks -------------------------------------------------------------
  function blocks(nodes: Node[]): BlockNode[] {
    const out: BlockNode[] = [];
    // Inline content sitting directly among blocks is wrapped in a paragraph.
    let loose: Node[] = [];
    const flush = () => {
      if (!loose.length) return;
      const content = trimmedInline(loose);
      loose = [];
      if (content.length) out.push({ type: "paragraph", content });
    };

    for (const node of nodes) {
      if (node.kind === "text") {
        if (node.text.trim()) loose.push(node);
        continue;
      }
      const block = blockFor(node);
      if (block === "inline") {
        loose.push(node);
        continue;
      }
      flush();
      if (block) out.push(...block);
    }
    flush();
    return out;
  }

  function blockFor(node: Element): BlockNode[] | null | "inline" {
    switch (node.tag) {
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6": {
        // h1 becomes h2 because the article title is the page's h1; h4 and
        // deeper become h3, which is as deep as the reader's outline goes.
        const level: 2 | 3 = node.tag === "h1" || node.tag === "h2" ? 2 : 3;
        const content = trimmedInline(node.children);
        if (!content.length) return null; // Intercom leaves empty headings behind
        if (node.attrs.id) anchors.push({ id: node.attrs.id, text: textOf(content), level });
        return [{ type: "heading", attrs: { level }, content }];
      }

      case "p": {
        // An image inside a paragraph is still a figure. Intercom centres a
        // lone image that way, so the paragraph is re-read as blocks and the
        // image is lifted out rather than lost in inline content.
        if (containsTag(node, "img")) return blocks(node.children);
        const content = trimmedInline(node.children);
        // Intercom uses empty paragraphs as spacers; our prose spacing is its own.
        if (!content.length) return null;
        return [{ type: "paragraph", content }];
      }

      case "ul":
      case "ol":
        return [
          {
            type: node.tag === "ul" ? "bulletList" : "orderedList",
            content: node.children
              .filter((c): c is Element => c.kind === "element" && c.tag === "li")
              .map((li) => ({ type: "listItem", content: itemBlocks(li.children) })),
          },
        ];

      case "li":
        // A stray <li> outside a list still carries text.
        return [{ type: "paragraph", content: trimmedInline(node.children) }];

      case "blockquote":
        return [{ type: "blockquote", content: blocks(node.children) }];

      case "hr":
        return [{ type: "horizontalRule" }];

      case "pre": {
        const code = node.children.find((c) => c.kind === "element" && c.tag === "code") as Element | undefined;
        const source = code ? code.children : node.children;
        const text = plainWithBreaks(source);
        return text ? [{ type: "codeBlock", content: [{ type: "text", text }] }] : null;
      }

      case "img": {
        const resolved = options.resolveImage(node.attrs.src ?? "");
        if (!resolved) {
          if (node.attrs.src) unresolvedImages.push(node.attrs.src);
          return null;
        }
        const width = resolved.width ?? toInt(node.attrs.width);
        const height = resolved.height ?? toInt(node.attrs.height);
        return [
          {
            type: "figure",
            attrs: {
              src: resolved.src,
              alt: (node.attrs.alt ?? "").trim(),
              caption: null,
              width,
              height,
            },
          },
        ];
      }

      case "table":
        return [{ type: "table", content: tableRows(node) }];

      case "div": {
        const classes = (node.attrs.class ?? "").split(/\s+/).filter(Boolean);
        if (classes.includes("intercom-interblocks-callout")) {
          const variant = calloutVariant(node.attrs.style ?? "");
          if (!variant.known) note(`callout colour ${variant.colour || "(none)"} has no variant`);
          return [{ type: "callout", attrs: { variant: variant.value }, content: blocks(node.children) }];
        }
        // Wrappers we deliberately unwrap: image containers, table containers,
        // and the alignment classes the user chose to drop.
        for (const cls of classes) {
          if (!IGNORED_BLOCK_WRAPPERS.has(cls)) note(`<div class="${cls}">`);
        }
        return blocks(node.children);
      }

      case "thead":
      case "tbody":
      case "tfoot":
      case "section":
      case "article":
      case "main":
      case "figure":
        return blocks(node.children);

      case "br":
        return null;

      case "a":
      case "b":
      case "strong":
      case "i":
      case "em":
      case "u":
      case "s":
      case "strike":
      case "del":
      case "code":
      case "span":
      case "font":
        return "inline";

      default:
        note(`<${node.tag}>`);
        return blocks(node.children);
    }
  }

  /** A list item, table cell or callout body: a lone paragraph stays a paragraph. */
  function itemBlocks(nodes: Node[]): BlockNode[] {
    const content = blocks(nodes);
    return content.length ? content : [{ type: "paragraph" }];
  }

  function tableRows(table: Element): BlockNode[] {
    const rows: Element[] = [];
    const collect = (element: Element) => {
      for (const child of element.children) {
        if (child.kind !== "element") continue;
        if (child.tag === "tr") rows.push(child);
        else if (["thead", "tbody", "tfoot"].includes(child.tag)) collect(child);
      }
    };
    collect(table);

    return rows.map((row, rowIndex) => {
      const cells = row.children.filter(
        (c): c is Element => c.kind === "element" && (c.tag === "td" || c.tag === "th"),
      );
      // Intercom has no <th>; it tints the header row instead. Only the first
      // row may be promoted, and only when every cell is tinted.
      const isHeader =
        rowIndex === 0 &&
        cells.length > 0 &&
        cells.every((c) => c.tag === "th" || /background-color:\s*#e8e8e8/i.test(c.attrs.style ?? ""));
      for (const cell of cells) {
        if (cell.attrs.colspan && cell.attrs.colspan !== "1") note("a table cell uses colspan");
        if (cell.attrs.rowspan && cell.attrs.rowspan !== "1") note("a table cell uses rowspan");
      }
      return {
        type: "tableRow",
        content: cells.map((cell) => ({
          type: isHeader || cell.tag === "th" ? "tableHeader" : "tableCell",
          content: itemBlocks(cell.children),
        })),
      };
    });
  }

  function plainWithBreaks(nodes: Node[]): string {
    return nodes
      .map((node) => {
        if (node.kind === "text") return node.text;
        if (node.tag === "br") return "\n";
        return plainWithBreaks(node.children);
      })
      .join("");
  }

  const doc = { type: "doc" as const, content: blocks(parseHtml(html)) };
  return { doc, unhandled, unresolvedImages, anchors };
}

function calloutVariant(style: string): { value: "info" | "warning" | "tip"; known: boolean; colour: string } {
  const colour = style.match(/background-color:\s*(#[0-9a-fA-F]{6})/)?.[1]?.toLowerCase() ?? "";
  const variant = CALLOUT_VARIANT[colour];
  return { value: variant ?? "info", known: Boolean(variant), colour };
}

function containsTag(node: Element, tag: string): boolean {
  return node.children.some(
    (child) => child.kind === "element" && (child.tag === tag || containsTag(child, tag)),
  );
}

function toInt(value: string | undefined): number | null {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
