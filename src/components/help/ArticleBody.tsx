import { Info, Lightbulb, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { ArticleFigure } from "@/components/help/ArticleFigure";
import { VideoEmbed } from "@/components/help/VideoEmbed";
import { t, type Dictionary } from "@/i18n";
import {
  CALLOUT_VARIANTS,
  withHeadingIds,
  type BlockDocument,
  type BlockNode,
  type CalloutVariant,
} from "@/lib/help/blocks";
import { helpArticleHref, helpCollectionHref } from "@/lib/help/paths";
import { isSafeHttpUrl } from "@/lib/validation";

/**
 * Renders an article body from its ProseMirror JSON. A server component: the
 * tree becomes HTML once, at build or revalidation, and only the figure
 * (lightbox) and video (facade) nodes ship any script.
 *
 * Everything the JSON can contain is treated as data. Text is text, never
 * HTML; link targets pass the same URL check the changelog applies; unknown
 * node types render their children and nothing else, so a document written
 * by a newer editor degrades to readable text instead of failing.
 */
export function ArticleBody({
  body,
  dict,
  id,
}: {
  body: BlockDocument;
  dict: Dictionary;
  /** The element id the "skip to content" link and the TOC's parent point at. */
  id?: string;
}) {
  const doc = withHeadingIds(body);
  if (doc.content.length === 0) return null;
  return (
    <div id={id} className="help-prose">
      {doc.content.map((node, index) => (
        <Block key={index} node={node} dict={dict} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline content
// ---------------------------------------------------------------------------

function Inline({ nodes }: { nodes: BlockNode[] | undefined }) {
  return <>{(nodes ?? []).map((node, index) => <InlineNode key={index} node={node} />)}</>;
}

function InlineNode({ node }: { node: BlockNode }) {
  if (node.type === "hardBreak") return <br />;
  if (node.type !== "text") return <Inline nodes={node.content} />;

  let content: ReactNode = node.text ?? "";
  for (const mark of node.marks ?? []) {
    content = applyMark(mark.type, mark.attrs, content);
  }
  return <>{content}</>;
}

/** `/ar/articles/slug#x` → whatever that article's address is here. */
function resolveHelpHref(href: string): string {
  const match = href.match(/^\/(ar|en)\/(articles|categories)\/([^/?#]+)([?#].*)?$/);
  if (!match) return href;
  const locale = match[1] as "ar" | "en";
  const slug = decodeURIComponent(match[3]);
  const rest = match[4] ?? "";
  const base = match[2] === "articles" ? helpArticleHref(locale, slug) : helpCollectionHref(locale, slug);
  return `${base}${rest}`;
}

function applyMark(
  type: string,
  attrs: Record<string, unknown> | undefined,
  children: ReactNode,
): ReactNode {
  switch (type) {
    case "bold":
      return <strong>{children}</strong>;
    case "italic":
      return <em>{children}</em>;
    case "underline":
      return <u>{children}</u>;
    case "strike":
      return <s>{children}</s>;
    case "code":
      return <code>{children}</code>;
    case "ltr":
      return (
        <span className="ltr" dir="ltr">
          {children}
        </span>
      );
    case "link": {
      const raw = typeof attrs?.href === "string" ? attrs.href : "";
      // A body stored by the editor, or imported from an old help centre, holds
      // the public shape of a help link (`/ar/articles/…`). That is only the
      // real address when the help host is configured; everywhere else the same
      // page lives under `/ar/help/…`. Rebuild it through the path helpers so a
      // stored body is correct on both, exactly as every other help link is.
      const href = resolveHelpHref(raw);
      // Same-site paths and fragments are fine; anything else must be http(s).
      const isLocal = href.startsWith("/") || href.startsWith("#");
      if (!isLocal && !isSafeHttpUrl(href)) return children;
      const external = /^https?:/i.test(href);
      return (
        <a
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
        >
          {children}
        </a>
      );
    }
    default:
      return children;
  }
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

function Blocks({ nodes, dict }: { nodes: BlockNode[] | undefined; dict: Dictionary }) {
  return (
    <>
      {(nodes ?? []).map((node, index) => (
        <Block key={index} node={node} dict={dict} />
      ))}
    </>
  );
}

function Block({ node, dict }: { node: BlockNode; dict: Dictionary }) {
  switch (node.type) {
    case "paragraph":
      return (
        <p>
          <Inline nodes={node.content} />
        </p>
      );

    case "heading": {
      const id = typeof node.attrs?.id === "string" ? node.attrs.id : undefined;
      const level = node.attrs?.level;
      if (level === 3) {
        return (
          <h3 id={id}>
            <Inline nodes={node.content} />
          </h3>
        );
      }
      if (level === 2) {
        return (
          <h2 id={id}>
            <Inline nodes={node.content} />
          </h2>
        );
      }
      // The title is the page's h1 and anything deeper than h3 is noise in a
      // support article; both collapse to a bold paragraph.
      return (
        <p>
          <strong>
            <Inline nodes={node.content} />
          </strong>
        </p>
      );
    }

    case "bulletList":
      return (
        <ul>
          <ListItems nodes={node.content} dict={dict} />
        </ul>
      );

    case "orderedList":
      return (
        <ol>
          <ListItems nodes={node.content} dict={dict} />
        </ol>
      );

    case "steps":
      return <Steps node={node} dict={dict} />;

    case "callout":
      return <Callout node={node} dict={dict} />;

    case "figure": {
      const src = String(node.attrs?.src ?? "");
      if (!src || !(src.startsWith("/") || isSafeHttpUrl(src))) return null;
      const alt = String(node.attrs?.alt ?? "");
      const caption = node.attrs?.caption ? String(node.attrs.caption) : null;
      return (
        <ArticleFigure
          src={src}
          alt={alt}
          caption={caption}
          width={typeof node.attrs?.width === "number" ? node.attrs.width : null}
          height={typeof node.attrs?.height === "number" ? node.attrs.height : null}
          zoomLabel={t(dict.help.zoomImage, { alt })}
          closeLabel={dict.help.closeImage}
          actualSizeLabel={dict.help.zoomActual}
          fitLabel={dict.help.zoomFit}
        />
      );
    }

    case "video": {
      const provider = node.attrs?.provider;
      const id = String(node.attrs?.id ?? "");
      if ((provider !== "youtube" && provider !== "vimeo") || !id) return null;
      const title = String(node.attrs?.title ?? "");
      return (
        <VideoEmbed
          provider={provider}
          id={id}
          title={title}
          playLabel={t(dict.help.playVideo, { title })}
        />
      );
    }

    case "table":
      return <Table node={node} dict={dict} />;

    case "faq":
      return <Faq node={node} dict={dict} />;

    case "codeBlock":
      return (
        <pre>
          <code>
            <Inline nodes={node.content} />
          </code>
        </pre>
      );

    case "blockquote":
      return (
        <blockquote>
          <Blocks nodes={node.content} dict={dict} />
        </blockquote>
      );

    case "definition": {
      // A description list, because that is what this is: a term and its
      // meaning. It is also what `DefinedTerm` in the JSON-LD describes.
      const term = String(node.attrs?.term ?? "").trim();
      if (!term) return null;
      return (
        <dl className="my-3 rounded-card border border-border bg-subtle px-4 py-3">
          <dt className="font-bold text-text">{term}</dt>
          <dd className="mt-1 text-text-secondary">
            <Inline nodes={node.content} />
          </dd>
        </dl>
      );
    }

    case "horizontalRule":
      return <hr />;

    default:
      return node.content ? <Blocks nodes={node.content} dict={dict} /> : null;
  }
}

function ListItems({ nodes, dict }: { nodes: BlockNode[] | undefined; dict: Dictionary }) {
  return (
    <>
      {(nodes ?? []).map((item, index) => (
        <li key={index}>
          <ItemContent nodes={item.content} dict={dict} />
        </li>
      ))}
    </>
  );
}

/**
 * A list item, step or FAQ answer that holds a single paragraph renders the
 * paragraph's inline content directly, so the item's own spacing rules apply;
 * richer items keep their blocks.
 */
function ItemContent({ nodes, dict }: { nodes: BlockNode[] | undefined; dict: Dictionary }) {
  const content = nodes ?? [];
  if (content.length === 1 && content[0].type === "paragraph") {
    return <Inline nodes={content[0].content} />;
  }
  return (
    <div className="flex flex-col gap-3">
      <Blocks nodes={content} dict={dict} />
    </div>
  );
}

function Steps({ node, dict }: { node: BlockNode; dict: Dictionary }) {
  return (
    <ol aria-label={dict.help.stepsLabel} className="!list-none !ps-0">
      {(node.content ?? []).map((step, index) => (
        <li
          key={index}
          className="relative grid grid-cols-[1.75rem_1fr] gap-x-3 pb-4 last:pb-0 after:absolute after:start-3.5 after:top-8 after:bottom-0.5 after:w-px after:bg-border last:after:hidden"
        >
          <span
            aria-hidden
            className="numeral inline-flex size-7 items-center justify-center rounded-full bg-info-tint text-xs font-bold text-link"
          >
            {index + 1}
          </span>
          <div className="min-w-0 pt-0.5">
            <ItemContent nodes={step.content} dict={dict} />
          </div>
        </li>
      ))}
    </ol>
  );
}

const CALLOUT_STYLE: Record<
  CalloutVariant,
  { Icon: typeof Info; box: string; label: (dict: Dictionary) => string }
> = {
  info: {
    Icon: Info,
    box: "bg-info-tint text-info-label",
    label: (dict) => dict.help.calloutInfo,
  },
  warning: {
    Icon: TriangleAlert,
    box: "bg-warning-tint text-warning-label",
    label: (dict) => dict.help.calloutWarning,
  },
  tip: {
    Icon: Lightbulb,
    box: "bg-success-tint text-success-label",
    label: (dict) => dict.help.calloutTip,
  },
};

function Callout({ node, dict }: { node: BlockNode; dict: Dictionary }) {
  const raw = node.attrs?.variant;
  const variant: CalloutVariant = CALLOUT_VARIANTS.includes(raw as CalloutVariant)
    ? (raw as CalloutVariant)
    : "info";
  const { Icon, box, label } = CALLOUT_STYLE[variant];

  return (
    <aside role="note" className={`flex gap-3 rounded-control px-4 py-3 ${box}`}>
      <Icon className="mt-0.5 size-5 shrink-0" strokeWidth={2} aria-hidden />
      <div className="min-w-0 flex-1 text-text">
        <p className="mb-0.5 text-xs font-bold uppercase tracking-wide text-current label-caps">
          {label(dict)}
        </p>
        <div className="flex flex-col gap-1.5">
          <Blocks nodes={node.content} dict={dict} />
        </div>
      </div>
    </aside>
  );
}

function Table({ node, dict }: { node: BlockNode; dict: Dictionary }) {
  const rows = node.content ?? [];
  const headerRow = rows[0]?.content?.every((cell) => cell.type === "tableHeader")
    ? rows[0]
    : null;
  const bodyRows = headerRow ? rows.slice(1) : rows;

  return (
    <div className="overflow-x-auto rounded-control border border-border">
      <table>
        {headerRow ? (
          <thead>
            <tr>
              {(headerRow.content ?? []).map((cell, index) => (
                <th key={index} scope="col">
                  <ItemContent nodes={cell.content} dict={dict} />
                </th>
              ))}
            </tr>
          </thead>
        ) : null}
        <tbody>
          {bodyRows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {(row.content ?? []).map((cell, cellIndex) =>
                cell.type === "tableHeader" ? (
                  <th key={cellIndex} scope="row">
                    <ItemContent nodes={cell.content} dict={dict} />
                  </th>
                ) : (
                  <td key={cellIndex}>
                    <ItemContent nodes={cell.content} dict={dict} />
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Faq({ node, dict }: { node: BlockNode; dict: Dictionary }) {
  return (
    <div aria-label={dict.help.faqLabel} className="divide-y divide-border rounded-card border border-border">
      {(node.content ?? []).map((item, index) => (
        <details key={index} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold text-text [&::-webkit-details-marker]:hidden">
            {String(item.attrs?.question ?? "")}
            <span
              aria-hidden
              className="relative size-4 shrink-0 text-muted before:absolute before:inset-x-0 before:top-1/2 before:h-0.5 before:-translate-y-1/2 before:rounded before:bg-current after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 after:-translate-x-1/2 after:rounded after:bg-current after:transition-transform after:duration-(--dur-micro) group-open:after:scale-y-0"
            />
          </summary>
          <div className="px-4 pb-4 text-text-secondary">
            <ItemContent nodes={item.content} dict={dict} />
          </div>
        </details>
      ))}
    </div>
  );
}
