"use client";

import { X } from "lucide-react";
import { useRef } from "react";

/**
 * A screenshot in the body. The image is a button that opens the same image
 * in a native <dialog> — Escape, focus return and the backdrop come for free,
 * and the reader gets the full-width view a 375px phone needs for a 1200px
 * capture.
 *
 * Plain <img>, as elsewhere in the portal: sources will come from Supabase
 * Storage once the media library exists, and cannot be enumerated in the
 * image config ahead of that.
 */
export function ArticleFigure({
  src,
  alt,
  caption,
  width,
  height,
  zoomLabel,
  closeLabel,
}: {
  src: string;
  alt: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  zoomLabel: string;
  closeLabel: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  function open() {
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  return (
    <figure className="my-1">
      <button
        type="button"
        onClick={open}
        aria-label={zoomLabel}
        className="block w-full cursor-zoom-in overflow-hidden rounded-control border border-border bg-subtle"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          width={width ?? undefined}
          height={height ?? undefined}
          loading="lazy"
          decoding="async"
          className="block h-auto w-full"
        />
      </button>
      {caption ? (
        <figcaption className="mt-1.5 text-center text-[13px] text-text-tertiary">{caption}</figcaption>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-label={alt}
        onClick={(event) => {
          // Only the backdrop closes it: a click on the image itself is inert.
          if (event.target === event.currentTarget) close();
        }}
        className="m-auto max-h-[100dvh] max-w-[100vw] bg-transparent p-4 backdrop:bg-flovoo-navy/80 backdrop:backdrop-blur-[2px] sm:p-8"
      >
        <div className="relative">
          <button
            type="button"
            onClick={close}
            aria-label={closeLabel}
            className="absolute end-2 top-2 inline-flex size-10 items-center justify-center rounded-full bg-card/90 text-text shadow-lg transition-colors duration-(--dur-micro) hover:bg-card"
          >
            <X className="size-5" strokeWidth={2} aria-hidden />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="block max-h-[calc(100dvh-4rem)] w-auto max-w-full rounded-control bg-card"
          />
        </div>
      </dialog>
    </figure>
  );
}
