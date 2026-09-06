"use client";

import { Placeholder } from "@tiptap/extensions";
import { TableKit } from "@tiptap/extension-table";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  BookMarked,
  Bold,
  Code,
  Heading2,
  Heading3,
  HelpCircle,
  ImagePlus,
  Info,
  Italic,
  Lightbulb,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  ListChecks,
  Minus,
  Pilcrow,
  Redo2,
  Table as TableIcon,
  TextCursorInput,
  TriangleAlert,
  Undo2,
  Video as VideoIcon,
  type LucideIcon,
} from "lucide-react";
import type { Dictionary } from "@/i18n";
import type { BlockDocument } from "@/lib/help/blocks";
import type { Locale } from "@/lib/types";

import {
  Callout,
  Definition,
  Faq,
  FaqItem,
  Figure,
  Ltr,
  Step,
  Steps,
  Video,
  parseVideoUrl,
  type PickedImage,
} from "./extensions";

/**
 * The block editor for one language of an article: Tiptap with the help
 * center's vocabulary and a toolbar. Uncontrolled after mount — the parent
 * receives every change as JSON and hands it to the preview and the save.
 *
 * The editing surface wears `.help-prose` so text looks like the article
 * while it is written, in the language's own direction.
 */
export function BlockEditor({
  initial,
  locale,
  labels,
  onChange,
  pickImage,
  invalid = false,
}: {
  initial: BlockDocument;
  locale: Locale;
  labels: Dictionary["adminHelp"];
  onChange: (doc: BlockDocument) => void;
  pickImage: () => Promise<PickedImage | null>;
  invalid?: boolean;
}) {
  // The extensions capture `pickImage` once, when the editor is created; the
  // parent passes a stable callback for exactly that reason.
  const editor = useEditor({
    immediatelyRender: false,
    content: initial,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
        underline: false,
        strike: false,
      }),
      Placeholder.configure({ placeholder: labels.editorPlaceholder }),
      TableKit.configure({ table: { resizable: false } }),
      Steps,
      Step,
      Ltr,
      Faq,
      ...[Callout, Definition, Figure, Video, FaqItem].map((extension) =>
        extension.configure({
          labels: {
            definitionTerm: labels.definitionTerm,
            definitionPlaceholder: labels.definitionPlaceholder,
            figureAlt: labels.figureAlt,
            figureAltUnreviewed: labels.figureAltUnreviewed,
            figureCaption: labels.figureCaption,
            figureReplace: labels.figureReplace,
            figureRemove: labels.figureRemove,
            faqQuestion: labels.faqQuestion,
            faqAnswerPlaceholder: labels.faqAnswerPlaceholder,
            faqAdd: labels.tbFaq,
            faqRemove: labels.figureRemove,
            calloutLabel: labels.calloutLabel,
            calloutInfo: labels.tbCalloutInfo,
            calloutWarning: labels.tbCalloutWarning,
            calloutTip: labels.tbCalloutTip,
            videoTitle: labels.fieldTitle,
            videoRemove: labels.figureRemove,
          },
          pickImage,
        }),
      ),
    ],
    editorProps: {
      attributes: {
        class: "help-prose min-h-[24rem] px-5 py-4 outline-none",
        dir: locale === "ar" ? "rtl" : "ltr",
        lang: locale,
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON() as BlockDocument),
  });

  return (
    <div
      className={`help-editor rounded-card border bg-card ${
        invalid ? "border-danger" : "border-border"
      }`}
    >
      {editor ? <Toolbar editor={editor} labels={labels} pickImage={pickImage} /> : null}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({
  editor,
  labels,
  pickImage,
}: {
  editor: Editor;
  labels: Dictionary["adminHelp"];
  pickImage: () => Promise<PickedImage | null>;
}) {
  // Re-render only when the flags the buttons show actually change.
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      code: editor.isActive("code"),
      ltr: editor.isActive("ltr"),
      link: editor.isActive("link"),
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
      paragraph: editor.isActive("paragraph"),
      bullet: editor.isActive("bulletList"),
      ordered: editor.isActive("orderedList"),
      steps: editor.isActive("steps"),
      info: editor.isActive("callout", { variant: "info" }),
      warning: editor.isActive("callout", { variant: "warning" }),
      tip: editor.isActive("callout", { variant: "tip" }),
      table: editor.isActive("table"),
      canUndo: editor.can().undo(),
      canRedo: editor.can().redo(),
    }),
  });

  function setLink() {
    const previous = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt(labels.tbLinkPrompt, previous ?? "https://");
    if (href === null) return;
    if (!href.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
  }

  async function insertImage() {
    const picked = await pickImage();
    if (picked) editor.chain().focus().insertFigure(picked).run();
  }

  function insertVideo() {
    const url = window.prompt(labels.tbVideoPrompt, "https://");
    if (!url) return;
    const parsed = parseVideoUrl(url);
    if (!parsed) {
      window.alert(labels.tbVideoInvalid);
      return;
    }
    editor.chain().focus().insertVideo({ ...parsed, title: "" }).run();
  }

  function callout(variant: "info" | "warning" | "tip", active: boolean) {
    if (active) editor.chain().focus().unsetCallout().run();
    else editor.chain().focus().setCallout(variant).run();
  }

  return (
    <div
      role="toolbar"
      aria-label={labels.fieldBody}
      className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5"
    >
      <Btn Icon={Undo2} label={labels.tbUndo} disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()} />
      <Btn Icon={Redo2} label={labels.tbRedo} disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()} />
      <Sep />
      <Btn Icon={Pilcrow} label={labels.tbParagraph} active={state.paragraph && !state.steps} onClick={() => editor.chain().focus().setParagraph().run()} />
      <Btn Icon={Heading2} label={labels.tbH2} active={state.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
      <Btn Icon={Heading3} label={labels.tbH3} active={state.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
      <Sep />
      <Btn Icon={Bold} label={labels.tbBold} active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()} />
      <Btn Icon={Italic} label={labels.tbItalic} active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()} />
      <Btn Icon={Code} label={labels.tbCode} active={state.code} onClick={() => editor.chain().focus().toggleCode().run()} />
      <Btn Icon={TextCursorInput} label={labels.tbLtr} active={state.ltr} onClick={() => editor.chain().focus().toggleLtr().run()} />
      <Btn Icon={state.link ? Link2Off : Link2} label={state.link ? labels.tbUnlink : labels.tbLink} active={state.link} onClick={setLink} />
      <Sep />
      <Btn Icon={List} label={labels.tbBullet} active={state.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()} />
      <Btn Icon={ListOrdered} label={labels.tbOrdered} active={state.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()} />
      <Btn Icon={ListChecks} label={labels.tbSteps} active={state.steps} onClick={() => editor.chain().focus().toggleSteps().run()} />
      <Btn Icon={BookMarked} label={labels.tbDefinition} onClick={() => editor.chain().focus().insertDefinition().run()} />
      <Sep />
      <Btn Icon={Info} label={labels.tbCalloutInfo} active={state.info} onClick={() => callout("info", state.info)} />
      <Btn Icon={TriangleAlert} label={labels.tbCalloutWarning} active={state.warning} onClick={() => callout("warning", state.warning)} />
      <Btn Icon={Lightbulb} label={labels.tbCalloutTip} active={state.tip} onClick={() => callout("tip", state.tip)} />
      <Sep />
      <Btn Icon={ImagePlus} label={labels.tbFigure} onClick={insertImage} />
      <Btn Icon={VideoIcon} label={labels.tbVideo} onClick={insertVideo} />
      <Btn Icon={TableIcon} label={labels.tbTable} active={state.table} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run()} />
      {state.table ? (
        <>
          <Btn text={labels.tbTableAddRow} onClick={() => editor.chain().focus().addRowAfter().run()} />
          <Btn text={labels.tbTableAddCol} onClick={() => editor.chain().focus().addColumnAfter().run()} />
          <Btn text={labels.tbTableDelete} onClick={() => editor.chain().focus().deleteTable().run()} />
        </>
      ) : null}
      <Btn Icon={HelpCircle} label={labels.tbFaq} onClick={() => editor.chain().focus().insertFaq().run()} />
      <Btn Icon={Minus} label={labels.tbHr} onClick={() => editor.chain().focus().setHorizontalRule().run()} />
    </div>
  );
}

function Sep() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-border" />;
}

function Btn({
  Icon,
  text,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  Icon?: LucideIcon;
  text?: string;
  label?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={label ? active : undefined}
      title={label}
      className={`inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-input px-1.5 text-xs font-semibold transition-colors duration-(--dur-micro) disabled:opacity-40 ${
        active ? "bg-info-tint text-link" : "text-text-secondary hover:bg-subtle hover:text-text"
      }`}
    >
      {Icon ? <Icon className="size-4" strokeWidth={2} aria-hidden /> : null}
      {text}
    </button>
  );
}
