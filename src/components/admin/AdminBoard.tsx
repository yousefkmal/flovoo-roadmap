"use client";

import { useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Check, GripVertical, MoveRight, Pencil, Pin, PinOff } from "lucide-react";

import { CategoryChip } from "@/components/ui/CategoryChip";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useDismissable } from "@/components/ui/useDismissable";
import { moveFeatureAction, togglePinAction } from "@/app/[locale]/admin/actions";
import { t, type Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import type { FeatureStatus } from "@/lib/types";

export interface AdminFeatureView {
  id: string;
  title: string;
  status: FeatureStatus;
  votes: number;
  isPinned: boolean;
  categoryName: string | null;
  categoryColor: string | null;
}

/**
 * The editable board.
 *
 * Dragging is the fast path, and every card also carries a move menu: drag is
 * a pointer gesture, and an admin on a keyboard or a screen reader needs the
 * same power. dnd-kit's keyboard sensor helps, but an explicit menu is the
 * thing that is actually discoverable.
 */
export function AdminBoard({
  statuses,
  features,
  locale,
  dict,
}: {
  statuses: FeatureStatus[];
  features: AdminFeatureView[];
  locale: Locale;
  dict: Dictionary;
}) {
  const [optimistic, setOptimistic] = useOptimistic(
    features,
    (state: AdminFeatureView[], change: { id: string; status: FeatureStatus }) =>
      state.map((f) => (f.id === change.id ? { ...f, status: change.status } : f)),
  );
  const [, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const sensors = useSensors(
    // A small distance so a click on the edit link is not read as a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const byStatus = useMemo(() => {
    const groups = new Map<FeatureStatus, AdminFeatureView[]>();
    for (const status of statuses) groups.set(status, []);
    for (const feature of optimistic) groups.get(feature.status)?.push(feature);
    return groups;
  }, [optimistic, statuses]);

  function move(id: string, next: FeatureStatus) {
    const current = optimistic.find((f) => f.id === id);
    if (!current || current.status === next) return;

    startTransition(async () => {
      setOptimistic({ id, status: next });
      const result = await moveFeatureAction(locale, id, next);
      if (result.status === "ok") {
        const moved = t(dict.admin.movedTo, { status: dict.status[next] });
        setMessage(
          result.notified > 0
            ? `${moved} · ${t(dict.admin.notifiedCount, { count: result.notified })}`
            : moved,
        );
      }
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const next = event.over?.id;
    if (typeof next !== "string") return;
    move(String(event.active.id), next as FeatureStatus);
  }

  return (
    <>
      <p className="mt-2 text-sm text-text-tertiary">{dict.admin.dragHint}</p>

      {/* Announced rather than only shown: a drag that also queues a hundred
          emails should say so to everyone. */}
      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm font-medium text-link">
        {message}
      </p>

      {/* A stable id: dnd-kit derives its `aria-describedby` targets from a
          counter that starts fresh on the server and again on the client, so
          without this every draggable hydrates with a mismatched attribute. */}
      <DndContext id="admin-board" sensors={sensors} onDragEnd={onDragEnd}>
        <div className="mt-4 md:overflow-x-auto md:pb-2">
          <div className="flex flex-col gap-6 md:inline-flex md:w-full md:flex-row md:items-stretch md:gap-4">
            {statuses.map((status) => (
              <Column
                key={status}
                status={status}
                features={byStatus.get(status) ?? []}
                statuses={statuses}
                locale={locale}
                dict={dict}
                onMove={move}
              />
            ))}
          </div>
        </div>
      </DndContext>
    </>
  );
}

function Column({
  status,
  features,
  statuses,
  locale,
  dict,
  onMove,
}: {
  status: FeatureStatus;
  features: AdminFeatureView[];
  statuses: FeatureStatus[];
  locale: Locale;
  dict: Dictionary;
  onMove: (id: string, next: FeatureStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      aria-label={dict.status[status]}
      className={`flex min-w-0 flex-col rounded-control p-2 transition-colors duration-(--dur-micro) md:w-72 md:shrink-0 xl:w-auto xl:flex-1 ${
        isOver ? "bg-info-tint ring-2 ring-flovoo-blue" : "bg-column"
      }`}
    >
      <header className="flex items-center justify-between gap-2 px-1 py-2">
        <h2>
          <StatusBadge status={status} label={dict.status[status]} />
        </h2>
        <span className="numeral rounded-control border border-border bg-card px-1.5 py-0.5 text-xs font-semibold text-text-secondary">
          {features.length}
        </span>
      </header>

      <div className="flex min-h-16 flex-1 flex-col gap-2">
        {features.length === 0 ? (
          /* An empty column is still a drop target. Left blank it reads as
             broken rather than empty, so it says what it is waiting for. */
          <p className="flex flex-1 items-center justify-center rounded-control border border-dashed border-border px-3 py-6 text-center text-xs text-text-tertiary">
            {dict.admin.columnEmpty}
          </p>
        ) : (
          features.map((feature) => (
            <Card
              key={feature.id}
              feature={feature}
              statuses={statuses}
              locale={locale}
              dict={dict}
              onMove={onMove}
            />
          ))
        )}
      </div>
    </section>
  );
}

function Card({
  feature,
  statuses,
  locale,
  dict,
  onMove,
}: {
  feature: AdminFeatureView;
  statuses: FeatureStatus[];
  locale: Locale;
  dict: Dictionary;
  onMove: (id: string, next: FeatureStatus) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: feature.id,
  });
  const [, startTransition] = useTransition();
  const [pinned, setPinned] = useOptimistic(feature.isPinned, (_s, next: boolean) => next);

  return (
    <article
      ref={setNodeRef}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined
      }
      className={`rounded-control border border-border bg-card p-3 shadow-sm ${
        isDragging ? "z-10 opacity-90 shadow-lg" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`${dict.admin.moveTo}: ${feature.title}`}
          className="mt-0.5 shrink-0 cursor-grab rounded-input p-1 text-text-tertiary hover:bg-subtle hover:text-text active:cursor-grabbing"
        >
          <GripVertical className="size-4" strokeWidth={2} aria-hidden />
        </button>

        <h3 className="min-w-0 flex-1 text-sm font-semibold text-text">{feature.title}</h3>

        <span className="numeral shrink-0 rounded-control border border-border bg-subtle px-1.5 py-0.5 text-xs font-semibold text-text-secondary">
          {feature.votes}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-1.5 ps-7">
        {feature.categoryName && feature.categoryColor ? (
          <CategoryChip name={feature.categoryName} color={feature.categoryColor} />
        ) : null}

        <div className="ms-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              startTransition(async () => {
                setPinned(!pinned);
                await togglePinAction(locale, feature.id);
              })
            }
            aria-pressed={pinned}
            aria-label={pinned ? dict.admin.unpin : dict.admin.pin}
            className={`inline-flex size-7 items-center justify-center rounded-input transition-colors duration-(--dur-micro) ${
              pinned
                ? "bg-info-tint text-info-label"
                : "text-text-tertiary hover:bg-subtle hover:text-text"
            }`}
          >
            {pinned ? (
              <PinOff className="size-3.5" strokeWidth={2} aria-hidden />
            ) : (
              <Pin className="size-3.5" strokeWidth={2} aria-hidden />
            )}
          </button>

          <MoveMenu
            feature={feature}
            statuses={statuses}
            dict={dict}
            onMove={onMove}
          />

          <Link
            href={`/${locale}/admin/features/${feature.id}`}
            aria-label={`${dict.admin.edit}: ${feature.title}`}
            className="inline-flex size-7 items-center justify-center rounded-input text-text-tertiary transition-colors duration-(--dur-micro) hover:bg-subtle hover:text-text"
          >
            <Pencil className="size-3.5" strokeWidth={2} aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}

function MoveMenu({
  feature,
  statuses,
  dict,
  onMove,
}: {
  feature: AdminFeatureView;
  statuses: FeatureStatus[];
  dict: Dictionary;
  onMove: (id: string, next: FeatureStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useDismissable(open, wrapRef, (reason) => {
    setOpen(false);
    if (reason === "escape") buttonRef.current?.focus();
  });

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${dict.admin.moveTo}: ${feature.title}`}
        className="inline-flex size-7 items-center justify-center rounded-input text-text-tertiary transition-colors duration-(--dur-micro) hover:bg-subtle hover:text-text"
      >
        <MoveRight className="size-3.5 rtl:-scale-x-100" strokeWidth={2} aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={dict.admin.moveTo}
          className="absolute top-full end-0 z-30 mt-1 w-44 overflow-hidden rounded-card border border-border bg-card p-1.5 shadow-lg"
        >
          {statuses.map((status) => (
            <button
              key={status}
              type="button"
              role="menuitemradio"
              aria-checked={feature.status === status}
              onClick={() => {
                setOpen(false);
                onMove(feature.id, status);
              }}
              className={`flex w-full items-center gap-2 rounded-input px-2.5 py-2 text-start text-sm transition-colors duration-(--dur-micro) ${
                feature.status === status
                  ? "bg-subtle font-semibold text-text"
                  : "text-text-secondary hover:bg-subtle hover:text-text"
              }`}
            >
              <span className="min-w-0 flex-1 truncate">{dict.status[status]}</span>
              {feature.status === status ? (
                <Check className="size-4 shrink-0 text-flovoo-blue" strokeWidth={2.5} aria-hidden />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
