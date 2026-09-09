"use client";

import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { ImageIcon, Info, Lightbulb, Plus, Trash2, TriangleAlert, Video as VideoIcon } from "lucide-react";

import type { HelpEditorOptions } from "./extensions";

/**
 * How the custom blocks look while being edited. Each view is a small React
 * component the node's extension mounts; the public page renders the same
 * JSON through `ArticleBody.tsx`, so these only need to be clear to the
 * person editing, not identical to the reader's view.
 */

type Options = HelpEditorOptions;

const inputClass =
  "w-full rounded-input border border-border bg-card px-2 py-1 text-xs text-text outline-none focus:border-flovoo-blue placeholder:text-placeholder";
const iconButton =
  "inline-flex size-7 items-center justify-center rounded-input text-muted transition-colors duration-(--dur-micro) hover:bg-subtle hover:text-text";

export function CalloutView({ node, updateAttributes, extension }: NodeViewProps) {
  const { labels } = extension.options as Options;
  const variant = (node.attrs.variant as string) ?? "info";
  const style: Record<string, { box: string; Icon: typeof Info }> = {
    info: { box: "bg-info-tint text-info-label", Icon: Info },
    warning: { box: "bg-warning-tint text-warning-label", Icon: TriangleAlert },
    tip: { box: "bg-success-tint text-success-label", Icon: Lightbulb },
  };
  const { box, Icon } = style[variant] ?? style.info;

  return (
    <NodeViewWrapper as="aside" className={`my-3 flex gap-3 rounded-control px-4 py-3 ${box}`}>
      <Icon className="mt-1 size-5 shrink-0" strokeWidth={2} aria-hidden />
      <div className="min-w-0 flex-1">
        <select
          contentEditable={false}
          value={variant}
          onChange={(event) => updateAttributes({ variant: event.target.value })}
          aria-label={labels.calloutLabel}
          className="mb-1 rounded-input border border-transparent bg-transparent text-xs font-bold uppercase tracking-wide text-current outline-none hover:border-border focus:border-flovoo-blue"
        >
          <option value="info">{labels.calloutInfo}</option>
          <option value="warning">{labels.calloutWarning}</option>
          <option value="tip">{labels.calloutTip}</option>
        </select>
        <NodeViewContent className="text-text" />
      </div>
    </NodeViewWrapper>
  );
}

export function DefinitionView({ node, updateAttributes, extension }: NodeViewProps) {
  const { labels } = extension.options as Options;
  return (
    <NodeViewWrapper
      as="div"
      data-drag-handle
      className="my-3 rounded-card border border-border bg-subtle p-3"
    >
      <input
        contentEditable={false}
        value={(node.attrs.term as string) ?? ""}
        onChange={(event) => updateAttributes({ term: event.target.value })}
        placeholder={labels.definitionTerm}
        className={`${inputClass} mb-1.5 font-bold`}
      />
      <NodeViewContent className="text-sm text-text-secondary" />
    </NodeViewWrapper>
  );
}

export function FigureView({ node, updateAttributes, deleteNode, extension, selected }: NodeViewProps) {
  const { labels, pickImage } = extension.options as Options;
  const src = node.attrs.src as string | null;
  // A generated description is a suggestion until somebody touches it. Editing
  // the field is the review, so typing is what clears the badge.
  const altDraft = node.attrs.altDraft === true;

  async function replace() {
    const picked = await pickImage();
    if (picked) updateAttributes({ ...picked, alt: picked.alt || node.attrs.alt });
  }

  return (
    <NodeViewWrapper
      as="figure"
      data-drag-handle
      className={`my-3 rounded-card border bg-card p-3 ${selected ? "border-flovoo-blue" : "border-border"}`}
    >
      {/* The same box the reader gets: full column width, natural ratio. It
          used to be capped at 18rem tall, which showed a 1200x720 screenshot
          at 480x288 inside a 540px column — smaller than published, and read
          by writers as the image being cut off. */}
      <div className="flex items-center justify-center overflow-hidden rounded-control bg-subtle">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={(node.attrs.alt as string) ?? ""} className="block h-auto w-full" />
        ) : (
          <ImageIcon className="my-10 size-8 text-muted" strokeWidth={2} aria-hidden />
        )}
      </div>
      <div contentEditable={false} className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-0.5 text-xs font-semibold text-text-secondary">
          <span className="flex items-center gap-1.5">
            {labels.figureAlt}
            {altDraft ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning-tint px-1.5 py-0.5 text-[10px] font-bold text-warning-label">
                <TriangleAlert className="size-3" strokeWidth={2.5} aria-hidden />
                {labels.figureAltUnreviewed}
              </span>
            ) : null}
          </span>
          <input
            value={(node.attrs.alt as string) ?? ""}
            onChange={(event) => updateAttributes({ alt: event.target.value, altDraft: false })}
            className={`${inputClass} ${altDraft ? "border-warning-label" : ""}`}
          />
        </label>
        <label className="flex flex-col gap-0.5 text-xs font-semibold text-text-secondary">
          {labels.figureCaption}
          <input
            value={(node.attrs.caption as string | null) ?? ""}
            onChange={(event) => updateAttributes({ caption: event.target.value || null })}
            className={inputClass}
          />
        </label>
      </div>
      <div contentEditable={false} className="mt-2 flex items-center gap-1">
        <button type="button" onClick={replace} className="inline-flex h-7 items-center rounded-input border border-border px-2 text-xs font-semibold text-text-secondary hover:text-text">
          {labels.figureReplace}
        </button>
        <button type="button" onClick={() => deleteNode()} aria-label={labels.figureRemove} className={`${iconButton} ms-auto hover:text-danger`}>
          <Trash2 className="size-4" strokeWidth={2} aria-hidden />
        </button>
      </div>
    </NodeViewWrapper>
  );
}

export function VideoView({ node, updateAttributes, deleteNode, extension, selected }: NodeViewProps) {
  const { labels } = extension.options as Options;
  return (
    <NodeViewWrapper
      as="div"
      data-drag-handle
      className={`my-3 flex items-center gap-3 rounded-card border bg-card p-3 ${selected ? "border-flovoo-blue" : "border-border"}`}
    >
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-flovoo-navy text-white">
        <VideoIcon className="size-5" strokeWidth={2} aria-hidden />
      </span>
      <div contentEditable={false} className="min-w-0 flex-1">
        <p className="numeral text-xs text-text-tertiary">
          {String(node.attrs.provider)} · {String(node.attrs.id)}
        </p>
        <input
          value={(node.attrs.title as string) ?? ""}
          onChange={(event) => updateAttributes({ title: event.target.value })}
          placeholder={labels.videoTitle}
          aria-label={labels.videoTitle}
          className={`${inputClass} mt-1`}
        />
      </div>
      <button type="button" onClick={() => deleteNode()} aria-label={labels.videoRemove} className={`${iconButton} hover:text-danger`}>
        <Trash2 className="size-4" strokeWidth={2} aria-hidden />
      </button>
    </NodeViewWrapper>
  );
}

export function FaqItemView({ node, updateAttributes, deleteNode, editor, getPos, extension }: NodeViewProps) {
  const { labels } = extension.options as Options;

  function addAfter() {
    const pos = getPos();
    if (pos === undefined) return;
    editor
      .chain()
      .insertContentAt(pos + node.nodeSize, {
        type: "faqItem",
        attrs: { question: "" },
        content: [{ type: "paragraph" }],
      })
      .focus(pos + node.nodeSize + 2)
      .run();
  }

  return (
    <NodeViewWrapper as="div" className="my-1 rounded-control border border-border bg-card">
      <div contentEditable={false} className="flex items-center gap-1 border-b border-border px-3 py-2">
        <input
          value={(node.attrs.question as string) ?? ""}
          onChange={(event) => updateAttributes({ question: event.target.value })}
          placeholder={labels.faqQuestion}
          aria-label={labels.faqQuestion}
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-text outline-none placeholder:text-placeholder"
        />
        <button type="button" onClick={addAfter} aria-label={labels.faqAdd} className={iconButton}>
          <Plus className="size-4" strokeWidth={2} aria-hidden />
        </button>
        <button type="button" onClick={() => deleteNode()} aria-label={labels.faqRemove} className={`${iconButton} hover:text-danger`}>
          <Trash2 className="size-4" strokeWidth={2} aria-hidden />
        </button>
      </div>
      <NodeViewContent className="px-3 py-2 text-sm text-text-secondary" />
    </NodeViewWrapper>
  );
}
