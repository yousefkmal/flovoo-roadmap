import { Atom, CircleCheck, FastForward, Zap, type LucideIcon } from "lucide-react";

import type { FeatureStatus } from "@/lib/types";

/**
 * Stage → badge. Colours and icon shapes follow the reference portal: a tinted
 * pill, a darker label, and a lighter icon of the same hue. Icons are the
 * Lucide equivalents of the reference's glyphs — the design system allows one
 * icon set only, so these are matched by shape rather than copied.
 *
 * Classes are written out in full so Tailwind's scanner can see every one.
 */
export const STATUS_STYLE: Record<
  FeatureStatus,
  { icon: LucideIcon; badge: string; iconColor: string; dot: string; ring: string }
> = {
  under_review: {
    icon: Atom,
    badge: "bg-stage-review-bg text-stage-review-text",
    iconColor: "text-stage-review-icon",
    dot: "bg-stage-review-icon",
    ring: "ring-stage-review-bg",
  },
  planned: {
    icon: FastForward,
    badge: "bg-stage-planned-bg text-stage-planned-text",
    iconColor: "text-stage-planned-icon",
    dot: "bg-stage-planned-icon",
    ring: "ring-stage-planned-bg",
  },
  in_progress: {
    icon: Zap,
    badge: "bg-stage-progress-bg text-stage-progress-text",
    iconColor: "text-stage-progress-icon",
    dot: "bg-stage-progress-icon",
    ring: "ring-stage-progress-bg",
  },
  shipped: {
    icon: CircleCheck,
    badge: "bg-stage-shipped-bg text-stage-shipped-text",
    iconColor: "text-stage-shipped-icon",
    dot: "bg-stage-shipped-icon",
    ring: "ring-stage-shipped-bg",
  },
  archived: {
    icon: Atom,
    badge: "bg-subtle text-text-tertiary",
    iconColor: "text-muted",
    dot: "bg-border",
    ring: "ring-border",
  },
};

/**
 * The order a feature moves through, used by the detail modal's timeline.
 * Typed as the four live stages: `archived` is off the flow and has no hint.
 */
export const STATUS_FLOW = [
  "under_review",
  "planned",
  "in_progress",
  "shipped",
] as const;

export type FlowStatus = (typeof STATUS_FLOW)[number];
