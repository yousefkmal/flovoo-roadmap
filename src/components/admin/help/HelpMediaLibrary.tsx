"use client";

import { useRouter } from "next/navigation";
import { Check, Copy, Trash2, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { deleteHelpMediaAction, updateHelpMediaAltAction } from "@/app/[locale]/admin/help/actions";
import { EmptyState } from "@/components/ui/EmptyState";
import { FIELD_CLASS } from "@/components/ui/Field";
import { t, type Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";
import { articleCountLabel } from "@/lib/help/format";

export interface MediaItem {
  id: string;
  url: string;
  altAr: string;
  altEn: string;
  width: number | null;
  height: number | null;
  usageCount: number;
  createdLabel: string;
}

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml"];

/** Reads an image's pixel size in the browser so the server never has to decode it. */
function measure(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

/**
 * Uploads one file through the admin media route and returns the stored row.
 * Shared by the library and the editor's picker.
 */
export async function uploadHelpMedia(
  file: File,
  alt: { ar: string; en: string },
): Promise<{ ok: true; url: string; id: string } | { ok: false; reason: "size" | "type" | "failed" }> {
  if (!TYPES.includes(file.type)) return { ok: false, reason: "type" };
  if (file.size > MAX_BYTES) return { ok: false, reason: "size" };
  const size = await measure(file);
  const form = new FormData();
  form.set("file", file);
  form.set("alt_ar", alt.ar);
  form.set("alt_en", alt.en);
  if (size) {
    form.set("width", String(size.width));
    form.set("height", String(size.height));
  }
  try {
    const res = await fetch("/api/admin/help/media", { method: "POST", body: form });
    if (!res.ok) return { ok: false, reason: res.status === 413 ? "size" : res.status === 415 ? "type" : "failed" };
    const data = (await res.json()) as { media: { id: string }; url: string };
    return { ok: true, url: data.url, id: data.media.id };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** A4 — the media library: upload, alt text per language, usage, delete. */
export function HelpMediaLibrary({
  items,
  locale,
  dict,
}: {
  items: MediaItem[];
  locale: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [altAr, setAltAr] = useState("");
  const [altEn, setAltEn] = useState("");
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function onUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setNotice(null);
    setUploading(true);
    const result = await uploadHelpMedia(file, { ar: altAr, en: altEn });
    setUploading(false);
    if (!result.ok) {
      setNotice(
        result.reason === "size"
          ? dict.adminHelp.mediaTooLarge
          : result.reason === "type"
            ? dict.adminHelp.mediaBadType
            : dict.adminHelp.mediaUploadFailed,
      );
      return;
    }
    setAltAr("");
    setAltEn("");
    if (fileRef.current) fileRef.current.value = "";
    router.refresh();
  }

  return (
    <div className="mt-6 flex flex-col gap-6">
      <form onSubmit={onUpload} className="rounded-card border border-border bg-card p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <label className="flex flex-col gap-1 text-sm font-semibold text-text">
            {dict.adminHelp.mediaAltAr}
            <input value={altAr} onChange={(e) => setAltAr(e.target.value)} dir="rtl" lang="ar" className={`${FIELD_CLASS} text-start`} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-text">
            {dict.adminHelp.mediaAltEn}
            <input value={altEn} onChange={(e) => setAltEn(e.target.value)} dir="ltr" lang="en" className={`${FIELD_CLASS} text-start`} />
          </label>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-semibold text-text">
              {dict.adminHelp.mediaUpload}
              <input
                ref={fileRef}
                type="file"
                accept={TYPES.join(",")}
                required
                className="mt-1 block w-full text-sm text-text-secondary file:me-3 file:rounded-control file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-text"
              />
            </label>
            <button
              type="submit"
              disabled={uploading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-control bg-brand-solid px-4 text-sm font-semibold text-brand-solid-text transition-opacity duration-(--dur-micro) hover:opacity-90 disabled:opacity-60"
            >
              <Upload className="size-4" strokeWidth={2} aria-hidden />
              {uploading ? dict.adminHelp.mediaUploading : dict.adminHelp.mediaUpload}
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-text-tertiary">{dict.adminHelp.mediaUploadHint} {dict.adminHelp.mediaAltHint}</p>
        {notice ? (
          <p role="alert" className="mt-2 text-sm font-medium text-danger">{notice}</p>
        ) : null}
      </form>

      {items.length === 0 ? (
        <EmptyState title={dict.adminHelp.mediaEmpty} body={dict.adminHelp.mediaEmptyBody} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <MediaCard key={item.id} item={item} locale={locale} dict={dict} />
          ))}
        </ul>
      )}
    </div>
  );
}

function MediaCard({ item, locale, dict }: { item: MediaItem; locale: Locale; dict: Dictionary }) {
  const router = useRouter();
  const [altAr, setAltAr] = useState(item.altAr);
  const [altEn, setAltEn] = useState(item.altEn);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = altAr !== item.altAr || altEn !== item.altEn;

  function saveAlt() {
    startTransition(async () => {
      const result = await updateHelpMediaAltAction(locale, item.id, altAr, altEn);
      setNotice(result.status === "ok" ? dict.adminHelp.saved : dict.adminHelp.saveFailed);
      router.refresh();
    });
  }

  function remove() {
    if (!window.confirm(dict.adminHelp.mediaDeleteConfirm)) return;
    startTransition(async () => {
      const result = await deleteHelpMediaAction(locale, item.id);
      if (result.status === "inUse") setNotice(t(dict.adminHelp.mediaDeleteBlocked, { count: articleCountLabel(dict, locale, item.usageCount) }));
      else if (result.status === "error") setNotice(dict.adminHelp.saveFailed);
      router.refresh();
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(item.url, window.location.origin).toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setNotice(dict.adminHelp.saveFailed);
    }
  }

  return (
    <li className="flex flex-col overflow-hidden rounded-card border border-border bg-card">
      <div className="flex aspect-[3/2] items-center justify-center bg-subtle">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.url} alt={locale === "ar" ? item.altAr : item.altEn} loading="lazy" decoding="async" className="max-h-full max-w-full object-contain" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="numeric flex items-center justify-between text-xs text-text-tertiary">
          <span>{item.width && item.height ? t(dict.adminHelp.mediaDimensions, { width: item.width, height: item.height }) : ""}</span>
          <span>{item.usageCount > 0 ? t(dict.adminHelp.mediaUsedIn, { count: articleCountLabel(dict, locale, item.usageCount) }) : dict.adminHelp.mediaUnused}</span>
        </p>
        <input value={altAr} onChange={(e) => setAltAr(e.target.value)} placeholder={dict.adminHelp.mediaAltAr} dir="rtl" lang="ar" aria-label={dict.adminHelp.mediaAltAr} className={`${FIELD_CLASS} text-start text-xs`} />
        <input value={altEn} onChange={(e) => setAltEn(e.target.value)} placeholder={dict.adminHelp.mediaAltEn} dir="ltr" lang="en" aria-label={dict.adminHelp.mediaAltEn} className={`${FIELD_CLASS} text-start text-xs`} />
        <div className="mt-auto flex items-center gap-1.5 pt-1">
          <button type="button" onClick={saveAlt} disabled={pending || !dirty} className="inline-flex h-8 items-center rounded-control bg-brand-solid px-3 text-xs font-semibold text-brand-solid-text disabled:opacity-40">
            {dict.adminHelp.mediaSaveAlt}
          </button>
          <button type="button" onClick={copy} aria-label={dict.adminHelp.mediaCopyUrl} className="inline-flex size-8 items-center justify-center rounded-input text-muted hover:bg-subtle hover:text-text">
            {copied ? <Check className="size-4 text-success" strokeWidth={2} aria-hidden /> : <Copy className="size-4" strokeWidth={2} aria-hidden />}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending || item.usageCount > 0}
            title={item.usageCount > 0 ? t(dict.adminHelp.mediaDeleteBlocked, { count: articleCountLabel(dict, locale, item.usageCount) }) : undefined}
            aria-label={dict.adminHelp.mediaDelete}
            className="ms-auto inline-flex size-8 items-center justify-center rounded-input text-muted hover:bg-subtle hover:text-danger disabled:opacity-30"
          >
            <Trash2 className="size-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
        {notice ? <p role="status" className="text-xs text-text-secondary">{notice}</p> : null}
      </div>
    </li>
  );
}
