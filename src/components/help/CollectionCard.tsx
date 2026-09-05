import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { CollectionIcon } from "@/components/help/CollectionIcon";

/**
 * One topic on the home page. The whole card is the link; the count is the
 * only number and is set standalone, so it takes `.numeral`.
 */
export function CollectionCard({
  href,
  name,
  description,
  icon,
  countLabel,
}: {
  href: string;
  name: string;
  description: string | null;
  icon: string;
  countLabel: string;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-card border border-border bg-card p-5 shadow-sm transition-[transform,box-shadow,border-color] duration-(--dur-standard) ease-(--ease-expo) hover:-translate-y-0.5 hover:border-flovoo-blue/40 hover:shadow-lg"
    >
      <span className="mb-3 inline-flex size-9 items-center justify-center rounded-control bg-info-tint text-link">
        <CollectionIcon name={icon} className="size-4" />
      </span>
      <h3 className="text-base font-semibold leading-6 text-text">{name}</h3>
      {description ? (
        <p className="clamp-2 mt-1 text-[13px] leading-5 text-text-secondary">{description}</p>
      ) : null}
      <span className="mt-auto flex items-center justify-between pt-3 text-xs font-medium text-text-tertiary">
        {countLabel}
        <ChevronRight
          className="size-4 text-muted transition-transform duration-(--dur-micro) group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
          strokeWidth={2}
          aria-hidden
        />
      </span>
    </Link>
  );
}
