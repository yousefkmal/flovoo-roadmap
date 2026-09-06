"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";

import {
  deleteHelpCollectionAction,
  reorderHelpCollectionsAction,
  saveHelpCollectionAction,
  type CollectionState,
  type HelpFieldError,
} from "@/app/[locale]/admin/help/actions";
import { CollectionIcon, HELP_ICONS } from "@/components/help/CollectionIcon";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { FIELD_CLASS, Field } from "@/components/ui/Field";
import { t, type Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { articleCountLabel } from "@/lib/help/format";
import type { HelpCollection } from "@/lib/help/types";

export interface CollectionRow extends HelpCollection {
  articleCount: number;
}

/**
 * A3 — the topics manager. Drag (or the arrow buttons, for keyboards and
 * screen readers) to reorder; edit in a dialog; delete only when empty, so
 * an article can never lose its topic.
 *
 * The page keys this component by the server's id list, so a save that adds
 * or removes a topic remounts it with fresh local order instead of syncing
 * state in an effect.
 */
export function HelpCollectionsManager({
  collections,
  locale,
  dict,
}: {
  collections: CollectionRow[];
  locale: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const [order, setOrder] = useState(collections.map((c) => c.id));
  const [editing, setEditing] = useState<CollectionRow | "new" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = new Map(collections.map((c) => [c.id, c]));
  const ordered = order.map((id) => byId.get(id)).filter((c): c is CollectionRow => Boolean(c));

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function persist(next: string[]) {
    setOrder(next);
    startTransition(async () => {
      const result = await reorderHelpCollectionsAction(locale, next);
      if (result.status !== "ok") setNotice(dict.adminHelp.saveFailed);
      router.refresh();
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    persist(arrayMove(order, from, to));
  }

  function move(id: string, delta: -1 | 1) {
    const from = order.indexOf(id);
    const to = from + delta;
    if (from === -1 || to < 0 || to >= order.length) return;
    persist(arrayMove(order, from, to));
  }

  function remove(collection: CollectionRow) {
    const name = locale === "ar" ? collection.name_ar : collection.name_en;
    if (!window.confirm(t(dict.adminHelp.collectionDeleteConfirm, { name }))) return;
    setNotice(null);
    startTransition(async () => {
      const result = await deleteHelpCollectionAction(locale, collection.id);
      if (result.status === "notEmpty") setNotice(dict.adminHelp.collectionDeleteBlocked);
      else if (result.status === "error") setNotice(dict.adminHelp.saveFailed);
      router.refresh();
    });
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">{dict.adminHelp.reorderHint}</p>
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="gradient-brand inline-flex h-10 items-center gap-2 rounded-control px-4 text-sm font-semibold text-white transition-opacity duration-(--dur-micro) hover:opacity-90"
        >
          <Plus className="size-4" strokeWidth={2} aria-hidden />
          {dict.adminHelp.newCollection}
        </button>
      </div>

      {notice ? (
        <p role="alert" className="mt-3 text-sm font-medium text-danger">
          {notice}
        </p>
      ) : null}

      {ordered.length === 0 ? (
        <EmptyState className="mt-6" title={dict.adminHelp.collectionsEmpty} />
      ) : (
        <DndContext id="help-collections" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <ol className="mt-4 flex flex-col gap-2">
              {ordered.map((collection, index) => (
                <SortableRow
                  key={collection.id}
                  collection={collection}
                  locale={locale}
                  dict={dict}
                  isFirst={index === 0}
                  isLast={index === ordered.length - 1}
                  disabled={pending}
                  onEdit={() => setEditing(collection)}
                  onDelete={() => remove(collection)}
                  onMove={(delta) => move(collection.id, delta)}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}

      <CollectionDialog
        key={editing === null ? "closed" : editing === "new" ? "new" : editing.id}
        editing={editing}
        locale={locale}
        dict={dict}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function SortableRow({
  collection,
  locale,
  dict,
  isFirst,
  isLast,
  disabled,
  onEdit,
  onDelete,
  onMove,
}: {
  collection: CollectionRow;
  locale: Locale;
  dict: Dictionary;
  isFirst: boolean;
  isLast: boolean;
  disabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (delta: -1 | 1) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: collection.id,
  });
  const name = locale === "ar" ? collection.name_ar : collection.name_en;
  const description = locale === "ar" ? collection.description_ar : collection.description_en;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-card border border-border bg-card px-3 py-2.5 ${
        isDragging ? "shadow-lg" : ""
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={dict.adminHelp.dragHandle}
        className="inline-flex size-8 shrink-0 cursor-grab items-center justify-center rounded-input text-muted hover:text-text active:cursor-grabbing"
      >
        <GripVertical className="size-4" strokeWidth={2} aria-hidden />
      </button>
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-info-tint text-link">
        <CollectionIcon name={collection.icon} className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-text">{name}</span>
          {!collection.is_published ? (
            <span className="rounded-pill bg-warning-tint px-2 py-0.5 text-xs font-semibold text-warning-label">
              {dict.adminHelp.collectionHidden}
            </span>
          ) : null}
        </span>
        <span className="block truncate text-xs text-text-tertiary">
          <span className="numeric">{t(dict.adminHelp.collectionArticles, { count: articleCountLabel(dict, locale, collection.articleCount) })}</span>
          {description ? ` · ${description}` : ""}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-0.5">
        <button type="button" disabled={disabled || isFirst} onClick={() => onMove(-1)} aria-label={dict.adminHelp.moveUp} className="inline-flex size-8 items-center justify-center rounded-input text-muted hover:bg-subtle hover:text-text disabled:opacity-30">
          <ChevronUp className="size-4" strokeWidth={2} aria-hidden />
        </button>
        <button type="button" disabled={disabled || isLast} onClick={() => onMove(1)} aria-label={dict.adminHelp.moveDown} className="inline-flex size-8 items-center justify-center rounded-input text-muted hover:bg-subtle hover:text-text disabled:opacity-30">
          <ChevronDown className="size-4" strokeWidth={2} aria-hidden />
        </button>
        <button type="button" onClick={onEdit} aria-label={dict.adminHelp.editCollection} className="inline-flex size-8 items-center justify-center rounded-input text-muted hover:bg-subtle hover:text-text">
          <Pencil className="size-4" strokeWidth={2} aria-hidden />
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled || collection.articleCount > 0}
          title={collection.articleCount > 0 ? dict.adminHelp.collectionDeleteBlocked : undefined}
          aria-label={dict.adminHelp.collectionDelete}
          className="inline-flex size-8 items-center justify-center rounded-input text-muted hover:bg-subtle hover:text-danger disabled:opacity-30"
        >
          <Trash2 className="size-4" strokeWidth={2} aria-hidden />
        </button>
      </span>
    </li>
  );
}

function CollectionDialog({
  editing,
  locale,
  dict,
  onClose,
  onSaved,
}: {
  editing: CollectionRow | "new" | null;
  locale: Locale;
  dict: Dictionary;
  onClose: () => void;
  onSaved: () => void;
}) {
  const current = editing && editing !== "new" ? editing : null;
  const [state, formAction, pending] = useActionState<CollectionState, FormData>(
    saveHelpCollectionAction.bind(null, locale, current?.id ?? null),
    { status: "idle" },
  );

  useEffect(() => {
    if (state.status === "saved") onSaved();
  }, [state, onSaved]);

  const errors: Record<string, HelpFieldError> = state.status === "invalid" ? state.errors : {};
  const message = (key: string) => (errors[key] ? errorLabel(dict, errors[key]) : undefined);

  return (
    <Dialog
      open={editing !== null}
      label={current ? dict.adminHelp.editCollection : dict.adminHelp.newCollection}
      onClose={onClose}
      containerClassName="max-w-lg"
    >
      <form action={formAction} className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-bold text-text">
          {current ? dict.adminHelp.editCollection : dict.adminHelp.newCollection}
        </h2>

        <Field id="collection-slug" label={dict.adminHelp.collectionSlug} hint={dict.adminHelp.collectionSlugHint} error={message("slug")}>
          <input id="collection-slug" name="slug" dir="ltr" required defaultValue={current?.slug ?? ""} aria-invalid={Boolean(errors.slug)} className={`${FIELD_CLASS} text-start`} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="collection-name-ar" label={dict.adminHelp.collectionNameAr} error={message("name_ar")}>
            <input id="collection-name-ar" name="name_ar" dir="rtl" lang="ar" required defaultValue={current?.name_ar ?? ""} aria-invalid={Boolean(errors.name_ar)} className={`${FIELD_CLASS} text-start`} />
          </Field>
          <Field id="collection-name-en" label={dict.adminHelp.collectionNameEn} error={message("name_en")}>
            <input id="collection-name-en" name="name_en" dir="ltr" lang="en" required defaultValue={current?.name_en ?? ""} aria-invalid={Boolean(errors.name_en)} className={`${FIELD_CLASS} text-start`} />
          </Field>
          <Field id="collection-desc-ar" label={dict.adminHelp.collectionDescAr} error={message("description_ar")}>
            <textarea id="collection-desc-ar" name="description_ar" dir="rtl" lang="ar" rows={2} defaultValue={current?.description_ar ?? ""} className={`${FIELD_CLASS} text-start`} />
          </Field>
          <Field id="collection-desc-en" label={dict.adminHelp.collectionDescEn} error={message("description_en")}>
            <textarea id="collection-desc-en" name="description_en" dir="ltr" lang="en" rows={2} defaultValue={current?.description_en ?? ""} className={`${FIELD_CLASS} text-start`} />
          </Field>
        </div>

        <Field id="collection-icon" label={dict.adminHelp.collectionIcon} error={message("icon")}>
          <IconPicker id="collection-icon" name="icon" defaultValue={current?.icon ?? "book-open"} />
        </Field>

        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" name="is_published" defaultChecked={current?.is_published ?? true} className="size-4 accent-flovoo-blue" />
          {dict.adminHelp.collectionPublished}
        </label>

        {state.status === "error" ? (
          <p role="alert" className="text-sm font-medium text-danger">{dict.adminHelp.saveFailed}</p>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="inline-flex h-10 items-center rounded-control px-4 text-sm font-semibold text-text-secondary hover:text-text">
            {dict.adminHelp.cancel}
          </button>
          <button type="submit" disabled={pending} className="inline-flex h-10 items-center rounded-control bg-brand-solid px-4 text-sm font-semibold text-brand-solid-text transition-opacity duration-(--dur-micro) hover:opacity-90 disabled:opacity-60">
            {pending ? dict.adminHelp.saving : dict.adminHelp.save}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/** A radio grid of the allow-listed icons: the picker can only ever choose a name the renderer knows. */
export function IconPicker({
  id,
  name,
  defaultValue,
  onChange,
}: {
  id: string;
  name: string;
  defaultValue: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div id={id} role="radiogroup" className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
      {Object.keys(HELP_ICONS).map((iconName) => (
        <label key={iconName} title={iconName} className="relative">
          <input
            type="radio"
            name={name}
            value={iconName}
            defaultChecked={iconName === defaultValue}
            onChange={() => onChange?.(iconName)}
            className="peer sr-only"
          />
          <span className="flex size-10 cursor-pointer items-center justify-center rounded-control border border-border text-text-secondary transition-colors duration-(--dur-micro) hover:bg-subtle peer-checked:border-flovoo-blue peer-checked:bg-info-tint peer-checked:text-link peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-flovoo-blue">
            <CollectionIcon name={iconName} className="size-4" />
          </span>
        </label>
      ))}
    </div>
  );
}

export function errorLabel(dict: Dictionary, error: HelpFieldError): string {
  const map: Record<HelpFieldError, string> = {
    required: dict.adminHelp.errRequired,
    tooLong: dict.adminHelp.errTooLong,
    invalidSlug: dict.adminHelp.errInvalidSlug,
    slugTaken: dict.adminHelp.errSlugTaken,
    unknownCollection: dict.adminHelp.errUnknownCollection,
    sectionBoth: dict.adminHelp.errSectionBoth,
    bodyEmpty: dict.adminHelp.errBodyEmpty,
    invalidIcon: dict.adminHelp.errInvalidIcon,
    altMissing: dict.adminHelp.errAltMissing,
    summaryLength: dict.adminHelp.errSummaryLength,
    invalidPath: dict.adminHelp.errInvalidPath,
    samePath: dict.adminHelp.errSamePath,
  };
  return map[error];
}
