import { STATUS_STYLE } from "@/lib/status";
import type { FeatureStatus } from "@/lib/types";

/**
 * Stage badge: 12px/600 label on a tinted fill, with a 16px icon in a lighter
 * shade of the same hue — the reference's proportions exactly.
 */
export function StatusBadge({
  status,
  label,
  className = "",
}: {
  status: FeatureStatus;
  label: string;
  className?: string;
}) {
  const { icon: Icon, badge, iconColor } = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-control px-2 py-1 text-xs font-semibold ${badge} ${className}`}
    >
      <Icon className={`size-4 shrink-0 ${iconColor}`} strokeWidth={2.25} aria-hidden />
      {label}
    </span>
  );
}
