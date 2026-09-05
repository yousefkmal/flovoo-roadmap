"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";

import { uploadHelpMedia } from "@/components/admin/help/HelpMediaLibrary";
import { Dialog } from "@/components/ui/Dialog";
import { FIELD_CLASS } from "@/components/ui/Field";
import type { Dictionary } from "@/i18n";
import type { Locale } from "@/i18n/config";

import type { PickedImage } from "./extensions";

export interface PickerMediaItem {
  id: string;
  url: string;
  altAr: string;
  altEn: string;
  width: number | null;
  height: number | null;
}

/**
 * Chooses an image from the library, or uploads a new one, for a figure block.
 * The alt text comes back in the language being edited — the figure's alt is
 * per translation, the library's is per language.
 */
export function MediaPicker({
  open,
  items,
  locale,
  dict,
  onPick,
  onClose,
  onUploaded,
}: {
  open: boolean;
  items: PickerMediaItem[];
  locale: Locale;
  dict: Dictionary;
  onPick: (image: PickedImage) => void;
  onClose: () => void;
  onUploaded: (item: PickerMediaItem) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [alt, setAlt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function pick(item: PickerMediaItem) {
    onPick({
      src: item.url,
      alt: locale === "ar" ? item.altAr : item.altEn,
      width: item.width,
      height: item.height,
    });
  }

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setNotice(null);
    const result = await uploadHelpMedia(file, {
      ar: locale === "ar" ? alt : "",
      en: locale === "en" ? alt : "",
    });
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
    const item: PickerMediaItem = {
      id: result.id,
      url: result.url,
      altAr: locale === "ar" ? alt : "",
      altEn: locale === "en" ? alt : "",
      width: null,
      height: null,
    };
    onUploaded(item);
    pick(item);
    setAlt("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <Dialog open={open} label={dict.adminHelp.mediaPickerTitle} onClose={onClose} containerClassName="max-w-3xl">
      <div className="flex flex-col gap-4 p-6">
        <h2 className="text-lg font-bold text-text">{dict.adminHelp.mediaPickerTitle}</h2>

        {items.length > 0 ? (
          <ul className="grid max-h-[50vh] gap-3 overflow-y-auto sm:grid-cols-3">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => pick(item)}
                  className="group flex w-full flex-col overflow-hidden rounded-card border border-border bg-card text-start transition-colors duration-(--dur-micro) hover:border-flovoo-blue"
                >
                  <span className="flex aspect-[3/2] w-full items-center justify-center bg-subtle">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt={locale === "ar" ? item.altAr : item.altEn} className="max-h-full max-w-full object-contain" />
                  </span>
                  <span className="clamp-2 px-2 py-1.5 text-xs text-text-secondary">
                    {(locale === "ar" ? item.altAr : item.altEn) || "—"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-secondary">{dict.adminHelp.mediaEmptyBody}</p>
        )}

        <form onSubmit={upload} className="flex flex-col gap-2 rounded-card border border-dashed border-border p-4">
          <p className="text-sm font-semibold text-text">{dict.adminHelp.mediaPickerUploadNew}</p>
          <input
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
            placeholder={locale === "ar" ? dict.adminHelp.mediaAltAr : dict.adminHelp.mediaAltEn}
            aria-label={locale === "ar" ? dict.adminHelp.mediaAltAr : dict.adminHelp.mediaAltEn}
            dir={locale === "ar" ? "rtl" : "ltr"}
            className={`${FIELD_CLASS} text-start`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" required className="text-sm text-text-secondary" />
            <button type="submit" disabled={uploading} className="inline-flex h-9 items-center gap-2 rounded-control bg-brand-solid px-3 text-sm font-semibold text-brand-solid-text disabled:opacity-60">
              <Upload className="size-4" strokeWidth={2} aria-hidden />
              {uploading ? dict.adminHelp.mediaUploading : dict.adminHelp.mediaUpload}
            </button>
          </div>
          <p className="text-xs text-text-tertiary">{dict.adminHelp.mediaUploadHint}</p>
          {notice ? <p role="alert" className="text-sm font-medium text-danger">{notice}</p> : null}
        </form>

        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-control px-3 text-sm font-semibold text-text-secondary hover:text-text">
            {dict.adminHelp.cancel}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
