import { MessageCircle, MessagesSquare } from "lucide-react";

import type { Dictionary } from "@/i18n";

/**
 * The dead-end card: where to go when the article did not help. Destinations
 * come from the environment so the same build serves staging and production,
 * and so the choice between live chat and WhatsApp (an open decision) is a
 * configuration change, not a code change. A button only renders when its
 * address is set.
 *
 * Neither button takes the gradient — that belongs to the view's one primary
 * CTA — and WhatsApp green stays on the icon only, as channel identity.
 */
export function EscalationCard({ dict }: { dict: Dictionary }) {
  const chatUrl = process.env.NEXT_PUBLIC_HELP_CHAT_URL || null;
  const whatsappUrl = process.env.NEXT_PUBLIC_HELP_WHATSAPP_URL || null;

  return (
    <section
      aria-labelledby="help-escalation-title"
      className="rounded-card border border-border bg-column px-5 py-6 text-center sm:px-8"
    >
      <span className="mx-auto mb-3 inline-flex size-10 items-center justify-center rounded-full bg-info-tint text-link">
        <MessagesSquare className="size-5" strokeWidth={2} aria-hidden />
      </span>
      <h2 id="help-escalation-title" className="text-base font-bold text-text">
        {dict.help.escalationTitle}
      </h2>
      <p className="mx-auto mt-1 max-w-md text-[13px] leading-5 text-text-secondary">
        {dict.help.escalationBody}
      </p>

      {chatUrl || whatsappUrl ? (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
          {chatUrl ? (
            <a
              href={chatUrl}
              className="inline-flex h-10 items-center gap-2 rounded-control bg-brand-solid px-4 text-sm font-semibold text-brand-solid-text transition-opacity duration-(--dur-micro) hover:opacity-90"
            >
              <MessagesSquare className="size-4" strokeWidth={2} aria-hidden />
              {dict.help.escalationChat}
            </a>
          ) : null}
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-control border border-border bg-card px-4 text-sm font-semibold text-text transition-colors duration-(--dur-micro) hover:border-flovoo-blue/40"
            >
              <MessageCircle className="size-4 text-[#25D366]" strokeWidth={2} aria-hidden />
              {dict.help.escalationWhatsapp}
              <span className="sr-only">{dict.updates.opensInNewTab}</span>
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
