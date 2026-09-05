import {
  BarChart3,
  BookOpen,
  CircleUser,
  CreditCard,
  Download,
  FileText,
  Inbox,
  LayoutTemplate,
  Megaphone,
  MessageCircle,
  MessageSquareText,
  Plug,
  Receipt,
  Rocket,
  Send,
  Settings,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  UserCheck,
  Users,
  Wallet,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * The icons a collection or an article may use, keyed by the Lucide name
 * stored on the row. An allow-list rather than a dynamic import: it keeps the
 * bundle to a couple of dozen glyphs and makes a typo in the database fall
 * back to a book instead of a blank. Phase 3's icon picker offers exactly
 * this set.
 */
export const HELP_ICONS: Record<string, LucideIcon> = {
  "book-open": BookOpen,
  rocket: Rocket,
  "message-circle": MessageCircle,
  inbox: Inbox,
  workflow: Workflow,
  megaphone: Megaphone,
  "credit-card": CreditCard,
  settings: Settings,
  users: Users,
  smartphone: Smartphone,
  "bar-chart-3": BarChart3,
  plug: Plug,
  "shield-check": ShieldCheck,
  // Article rows
  "file-text": FileText,
  "circle-user": CircleUser,
  "layout-template": LayoutTemplate,
  "triangle-alert": TriangleAlert,
  "user-check": UserCheck,
  "message-square-text": MessageSquareText,
  zap: Zap,
  send: Send,
  wallet: Wallet,
  receipt: Receipt,
  download: Download,
};

export function CollectionIcon({
  name,
  className = "size-5",
}: {
  name: string;
  className?: string;
}) {
  const Icon = HELP_ICONS[name] ?? BookOpen;
  return <Icon className={className} strokeWidth={2} aria-hidden />;
}
