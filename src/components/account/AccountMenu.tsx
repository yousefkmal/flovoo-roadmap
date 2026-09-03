"use client";

import { useCallback, useOptimistic, useRef, useState, useTransition } from "react";
import { Bell, Check, LayoutGrid, LogIn, LogOut } from "lucide-react";

import { SignInDialog } from "@/components/account/SignInDialog";
import { useDismissable } from "@/components/ui/useDismissable";
import { signOutAction, updateNotifyScopeAction } from "@/app/[locale]/actions";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import type { AppUser, NotifyScope } from "@/lib/auth/session";

const SCOPES = [
  { value: "all", key: "scopeAll" },
  { value: "following", key: "scopeFollowing" },
  { value: "none", key: "scopeNone" },
] as const satisfies readonly { value: NotifyScope; key: keyof Dictionary["follow"] }[];

/**
 * Signed out: the way in. Signed in: who you are, what you get emailed about,
 * and the way out.
 *
 * The notification preference lives here rather than on a settings page because
 * it is the only preference there is, and burying one switch behind a route is
 * how it never gets found.
 */
export function AccountMenu({
  user,
  isAdmin = false,
  locale,
  dict,
  googleEnabled,
}: {
  user: AppUser | null;
  /** Renders the admin entry. The pages and actions gate themselves too. */
  isAdmin?: boolean;
  locale: Locale;
  dict: Dictionary;
  googleEnabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  // Derived from the prop, not copied into state: the same preference can be
  // changed from the changelog's subscribe button, and a local copy would go
  // stale the moment it was.
  const [scope, setScope] = useOptimistic<NotifyScope, NotifyScope>(
    user?.notifyScope ?? "following",
    (_current, next) => next,
  );
  const [, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((reason: "escape" | "outside") => {
    setOpen(false);
    if (reason === "escape") buttonRef.current?.focus();
  }, []);

  useDismissable(open, wrapRef, close);

  if (!user) {
    return (
      <>
        <button
          type="button"
          onClick={() => setSignInOpen(true)}
          className="inline-flex h-9 items-center gap-2 rounded-control border border-border bg-card px-3 text-sm font-semibold text-text-secondary transition-colors duration-(--dur-micro) hover:text-text"
        >
          <LogIn className="size-4" strokeWidth={2} aria-hidden />
          <span className="hidden sm:inline">{dict.auth.signIn}</span>
        </button>

        <SignInDialog
          open={signInOpen}
          onClose={() => setSignInOpen(false)}
          locale={locale}
          dict={dict}
          googleEnabled={googleEnabled}
        />
      </>
    );
  }

  const label = user.name || user.email;
  const initial = (user.name?.trim()[0] ?? user.email[0] ?? "?").toUpperCase();

  function chooseScope(next: NotifyScope) {
    startTransition(async () => {
      setScope(next);
      await updateNotifyScopeAction(locale, next);
    });
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${dict.auth.account}: ${label}`}
        className="inline-flex h-9 items-center gap-2 rounded-control border border-border bg-card ps-1 pe-2 text-sm font-semibold text-text transition-colors duration-(--dur-micro) hover:border-flovoo-blue/60"
      >
        {user.avatarUrl ? (
          /* The avatar is served by whichever identity provider signed the
             person in, so its host cannot be listed in the image config, and
             optimising a 28px square through a loader would cost more than it
             saves. */
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt=""
            width={28}
            height={28}
            className="size-7 rounded-full object-cover"
          />
        ) : (
          <span className="gradient-brand inline-flex size-7 items-center justify-center rounded-full text-xs font-bold text-white">
            {initial}
          </span>
        )}
        <span className="hidden max-w-28 truncate sm:inline">{label}</span>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label={dict.auth.account}
          className="absolute top-full end-0 z-30 mt-2 w-64 overflow-hidden rounded-card border border-border bg-card p-1.5 shadow-lg"
        >
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-semibold text-text">{label}</p>
            <p dir="ltr" className="truncate text-start text-xs text-text-tertiary">
              {user.email}
            </p>
          </div>

          <div className="my-1.5 border-t border-border" />

          <p className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-text-tertiary">
            <Bell className="size-3.5" strokeWidth={2} aria-hidden />
            {dict.follow.preferenceTitle}
          </p>

          {SCOPES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={scope === option.value}
              onClick={() => chooseScope(option.value)}
              className={`flex w-full items-center gap-2 rounded-input px-2.5 py-2 text-start text-sm transition-colors duration-(--dur-micro) ${
                scope === option.value
                  ? "bg-subtle font-semibold text-text"
                  : "text-text-secondary hover:bg-subtle hover:text-text"
              }`}
            >
              <span className="min-w-0 flex-1">{dict.follow[option.key]}</span>
              {scope === option.value ? (
                <Check className="size-4 shrink-0 text-flovoo-blue" strokeWidth={2.5} aria-hidden />
              ) : null}
            </button>
          ))}

          <div className="my-1.5 border-t border-border" />

          {isAdmin ? (
            <a
              href={`/${locale}/admin`}
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-input px-2.5 py-2 text-start text-sm text-text-secondary transition-colors duration-(--dur-micro) hover:bg-subtle hover:text-text"
            >
              <LayoutGrid className="size-4 shrink-0" strokeWidth={2} aria-hidden />
              {dict.admin.title}
            </a>
          ) : null}

          <button
            type="button"
            role="menuitem"
            onClick={() => startTransition(async () => { await signOutAction(locale); })}
            className="flex w-full items-center gap-2 rounded-input px-2.5 py-2 text-start text-sm text-text-secondary transition-colors duration-(--dur-micro) hover:bg-subtle hover:text-text"
          >
            <LogOut className="size-4 shrink-0 rtl:-scale-x-100" strokeWidth={2} aria-hidden />
            {dict.auth.signOut}
          </button>
        </div>
      ) : null}
    </div>
  );
}

