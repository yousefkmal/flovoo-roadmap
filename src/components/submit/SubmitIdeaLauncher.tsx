"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { SignInDialog } from "@/components/account/SignInDialog";

import {
  SubmitIdeaDialog,
  type SubmitCategory,
} from "@/components/submit/SubmitIdeaDialog";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

/** The primary CTA, and the only thing that opens the submission dialog. */
export function SubmitIdeaLauncher({
  locale,
  dict,
  categories,
  signedIn,
  googleEnabled,
  defaultName,
  accountEmail,
}: {
  locale: Locale;
  dict: Dictionary;
  categories: SubmitCategory[];
  signedIn: boolean;
  googleEnabled: boolean;
  defaultName?: string;
  accountEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  // `useActionState` keeps its result for as long as the component is mounted,
  // so a dialog reopened after a success would show the confirmation again.
  // Bumping the key gives every opening a fresh form.
  const [formKey, setFormKey] = useState(0);

  function openDialog() {
    // Ask who they are first: an idea with no account behind it cannot be
    // followed up on, and the person cannot be told when it ships.
    if (!signedIn) {
      setSignInOpen(true);
      return;
    }
    setFormKey((key) => key + 1);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="gradient-brand inline-flex h-10 items-center gap-2 rounded-control px-3 text-sm font-semibold text-white shadow-sm transition-transform duration-(--dur-micro) hover:-translate-y-px sm:px-4"
      >
        <Sparkles className="size-5" strokeWidth={2} aria-hidden />
        <span className="sr-only sm:not-sr-only">{dict.nav.submitIdea}</span>
      </button>

      <SubmitIdeaDialog
        key={formKey}
        open={open}
        onClose={() => setOpen(false)}
        onReset={() => setFormKey((key) => key + 1)}
        locale={locale}
        dict={dict}
        categories={categories}
        defaultName={defaultName}
        accountEmail={accountEmail}
      />

      <SignInDialog
        open={signInOpen}
        onClose={() => setSignInOpen(false)}
        locale={locale}
        dict={dict}
        googleEnabled={googleEnabled}
        reason="submit"
      />
    </>
  );
}
