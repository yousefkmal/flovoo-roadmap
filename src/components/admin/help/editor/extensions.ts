import { Mark, Node, ReactNodeViewRenderer, mergeAttributes } from "@tiptap/react";

import { CalloutView, DefinitionView, FaqItemView, FigureView, VideoView } from "./node-views";

/**
 * The help center's block vocabulary as Tiptap extensions. Node and mark names
 * are exactly the ones `ArticleBody.tsx` renders and `blocks.ts` derives from
 * — steps/step, callout, figure, video, faq/faqItem, the `ltr` mark — so the
 * JSON the editor saves is the JSON the public page reads, with no mapping
 * layer that could drift.
 *
 * Labels for the in-editor views and the image picker arrive as options, set
 * once when the editor is created; the views read them from `extension.options`.
 */

export interface PickedImage {
  src: string;
  alt: string;
  width: number | null;
  height: number | null;
}

export interface EditorLabels {
  definitionTerm: string;
  definitionPlaceholder: string;
  figureAlt: string;
  figureAltUnreviewed: string;
  figureCaption: string;
  figureReplace: string;
  figureRemove: string;
  faqQuestion: string;
  faqAnswerPlaceholder: string;
  faqAdd: string;
  faqRemove: string;
  calloutLabel: string;
  calloutInfo: string;
  calloutWarning: string;
  calloutTip: string;
  videoTitle: string;
  videoRemove: string;
}

export interface HelpEditorOptions {
  labels: EditorLabels;
  /** Opens the media picker; resolves null when the admin cancels. */
  pickImage: () => Promise<PickedImage | null>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    helpSteps: { toggleSteps: () => ReturnType };
    helpDefinition: { insertDefinition: () => ReturnType };
    helpCallout: {
      setCallout: (variant: "info" | "warning" | "tip") => ReturnType;
      unsetCallout: () => ReturnType;
    };
    helpFigure: { insertFigure: (attrs: PickedImage & { caption?: string | null }) => ReturnType };
    helpVideo: {
      insertVideo: (attrs: { provider: "youtube" | "vimeo"; id: string; title: string }) => ReturnType;
    };
    helpFaq: { insertFaq: () => ReturnType };
    helpLtr: { toggleLtr: () => ReturnType };
  }
}

// ---------------------------------------------------------------------------
// Steps — an ordered procedure; the format's spine
// ---------------------------------------------------------------------------

export const Step = Node.create({
  name: "step",
  content: "paragraph block*",
  defining: true,
  parseHTML: () => [{ tag: 'li[data-type="step"]' }],
  renderHTML: ({ HTMLAttributes }) => ["li", mergeAttributes(HTMLAttributes, { "data-type": "step" }), 0],
  addKeyboardShortcuts() {
    return {
      Enter: () => this.editor.commands.splitListItem(this.name),
      Tab: () => this.editor.commands.sinkListItem(this.name),
      "Shift-Tab": () => this.editor.commands.liftListItem(this.name),
    };
  },
});

export const Steps = Node.create({
  name: "steps",
  group: "block list",
  content: "step+",
  parseHTML: () => [{ tag: 'ol[data-type="steps"]' }],
  renderHTML: ({ HTMLAttributes }) => ["ol", mergeAttributes(HTMLAttributes, { "data-type": "steps" }), 0],
  addCommands() {
    return {
      toggleSteps: () => ({ commands }) => commands.toggleList(this.name, Step.name),
    };
  },
});

// ---------------------------------------------------------------------------
// Callout — info · warning · tip
// ---------------------------------------------------------------------------

export const Callout = Node.create<HelpEditorOptions>({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes: () => ({ variant: { default: "info" } }),
  parseHTML: () => [{ tag: 'aside[data-type="callout"]' }],
  renderHTML: ({ HTMLAttributes }) =>
    ["aside", mergeAttributes(HTMLAttributes, { "data-type": "callout" }), 0],
  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },
  addCommands() {
    return {
      setCallout:
        (variant) =>
        ({ commands, editor }) =>
          editor.isActive(this.name)
            ? commands.updateAttributes(this.name, { variant })
            : commands.wrapIn(this.name, { variant }),
      unsetCallout: () => ({ commands }) => commands.lift(this.name),
    };
  },
});

// ---------------------------------------------------------------------------
// Figure — an image with alt text and a caption
// ---------------------------------------------------------------------------

/**
 * A glossary entry: a term and one sentence saying what it means.
 *
 * Worth its own block rather than a bold paragraph because it is emitted as
 * `DefinedTerm` in JSON-LD. Assistants answering "what is a WABA?" look for
 * exactly this shape, and Arabic technical glossaries are thin enough that a
 * clear one is disproportionately likely to be the source that gets quoted.
 */
export const Definition = Node.create<HelpEditorOptions>({
  name: "definition",
  group: "block",
  content: "inline*",
  defining: true,
  addAttributes: () => ({ term: { default: "" } }),
  parseHTML: () => [{ tag: 'div[data-type="definition"]' }],
  renderHTML: ({ HTMLAttributes }) =>
    ["div", mergeAttributes(HTMLAttributes, { "data-type": "definition" }), 0],
  addNodeView() {
    return ReactNodeViewRenderer(DefinitionView);
  },
  addCommands() {
    return {
      insertDefinition:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { term: "" } }),
    };
  },
});

export const Figure = Node.create<HelpEditorOptions>({
  name: "figure",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes: () => ({
    src: { default: null },
    alt: { default: "" },
    /** True while the alt text is machine-written and unreviewed. */
    altDraft: { default: false },
    caption: { default: null },
    width: { default: null },
    height: { default: null },
  }),
  parseHTML: () => [{ tag: 'figure[data-type="figure"]' }],
  renderHTML: ({ HTMLAttributes }) =>
    ["figure", mergeAttributes(HTMLAttributes, { "data-type": "figure" })],
  addNodeView() {
    return ReactNodeViewRenderer(FigureView);
  },
  addCommands() {
    return {
      insertFigure:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { caption: null, ...attrs } }),
    };
  },
});

// ---------------------------------------------------------------------------
// Video — YouTube or Vimeo, loaded behind a facade on the public page
// ---------------------------------------------------------------------------

export const Video = Node.create<HelpEditorOptions>({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes: () => ({
    provider: { default: "youtube" },
    id: { default: "" },
    title: { default: "" },
  }),
  parseHTML: () => [{ tag: 'div[data-type="video"]' }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": "video" })],
  addNodeView() {
    return ReactNodeViewRenderer(VideoView);
  },
  addCommands() {
    return {
      insertVideo: (attrs) => ({ commands }) => commands.insertContent({ type: this.name, attrs }),
    };
  },
});

// ---------------------------------------------------------------------------
// FAQ — question/answer pairs rendered as accordions
// ---------------------------------------------------------------------------

export const FaqItem = Node.create<HelpEditorOptions>({
  name: "faqItem",
  content: "block+",
  defining: true,
  addAttributes: () => ({ question: { default: "" } }),
  parseHTML: () => [{ tag: 'div[data-type="faq-item"]' }],
  renderHTML: ({ HTMLAttributes }) =>
    ["div", mergeAttributes(HTMLAttributes, { "data-type": "faq-item" }), 0],
  addNodeView() {
    return ReactNodeViewRenderer(FaqItemView);
  },
});

export const Faq = Node.create({
  name: "faq",
  group: "block",
  content: "faqItem+",
  parseHTML: () => [{ tag: 'div[data-type="faq"]' }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { "data-type": "faq" }), 0],
  addCommands() {
    return {
      insertFaq:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            content: [
              { type: FaqItem.name, attrs: { question: "" }, content: [{ type: "paragraph" }] },
            ],
          }),
    };
  },
});

// ---------------------------------------------------------------------------
// LTR mark — IDs, numbers and addresses inside Arabic text
// ---------------------------------------------------------------------------

export const Ltr = Mark.create({
  name: "ltr",
  parseHTML: () => [{ tag: 'span[dir="ltr"]' }],
  renderHTML: ({ HTMLAttributes }) =>
    ["span", mergeAttributes(HTMLAttributes, { dir: "ltr", class: "ltr" }), 0],
  addCommands() {
    return {
      toggleLtr: () => ({ commands }) => commands.toggleMark(this.name),
    };
  },
});

/** Turns a pasted YouTube or Vimeo address into the attrs the video node stores. */
export function parseVideoUrl(
  raw: string,
): { provider: "youtube" | "vimeo"; id: string } | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, "");
  const id = (value: string | null | undefined) =>
    value && /^[A-Za-z0-9_-]{6,}$/.test(value) ? value : null;

  if (host === "youtu.be") {
    const v = id(url.pathname.slice(1).split("/")[0]);
    return v ? { provider: "youtube", id: v } : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const fromQuery = id(url.searchParams.get("v"));
    const fromPath = id(url.pathname.match(/\/(?:embed|shorts|live)\/([^/?]+)/)?.[1]);
    const v = fromQuery ?? fromPath;
    return v ? { provider: "youtube", id: v } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const v = url.pathname.match(/(\d{6,})/)?.[1];
    return v ? { provider: "vimeo", id: v } : null;
  }
  return null;
}
