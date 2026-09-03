/**
 * Category chip: 12px/500 on the subtle fill with a hairline border, and the
 * category's own colour carried by the dot alone — the reference's treatment.
 * A dot identifies the category without tinting the whole chip, which is what
 * kept the board quiet enough to scan.
 */
export function CategoryChip({
  name,
  color,
  className = "",
}: {
  name: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-control border border-border bg-subtle px-2 py-1 text-xs font-medium text-text-secondary ${className}`}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {name}
    </span>
  );
}
