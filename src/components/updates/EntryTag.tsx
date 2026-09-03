import type { ChangelogKind } from "@/lib/types";

/**
 * The small tags beside an entry's date: what kind of change it was, and which
 * part of the product it touched. 12px/500 on a tint, 4px corner — the
 * reference's proportions.
 */
const KIND_CLASS: Record<ChangelogKind, string> = {
  new: "bg-kind-new-bg text-kind-new-text",
  improved: "bg-kind-improved-bg text-kind-improved-text",
  fixed: "bg-kind-fixed-bg text-kind-fixed-text",
};

export function KindTag({ kind, label }: { kind: ChangelogKind; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${KIND_CLASS[kind]}`}
    >
      {label}
    </span>
  );
}

export function CategoryTag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded bg-kind-category-bg px-1.5 py-0.5 text-xs font-medium text-kind-category-text">
      {label}
    </span>
  );
}
