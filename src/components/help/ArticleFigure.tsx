"use client";

import { Maximize2, Minimize2, X } from "lucide-react";
import { useRef, useState } from "react";

/**
 * A screenshot in the body. The image is a button that opens the same image
 * in a native <dialog> — Escape, focus return and the backdrop come for free.
 *
 * The dialog used to promise a closer look and not deliver one: fitted to the
 * screen, a 1200px capture opened at 343px on a 375px phone, two pixels wider
 * than it already was in the article. It now opens fitted and toggles to the
 * image's own size, where the dialog scrolls and the reader pans — which is
 * the only way to read a screenshot's interface text on a phone.
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
  actualSizeLabel,
  fitLabel,
}: {
  src: string;
  alt: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  zoomLabel: string;
  closeLabel: string;
  actualSizeLabel: string;
  fitLabel: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [actualSize, setActualSize] = useState(false);

  function open() {
    // Always start fitted: the whole picture first, detail on request.
    setActualSize(false);
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
          <div className="flex gap-2 absolute end-2 top-2 z-10">
            <button
              type="button"
              onClick={() => setActualSize((current) => !current)}
              aria-label={actualSize ? fitLabel : actualSizeLabel}
              aria-pressed={actualSize}
              className="inline-flex size-10 items-center justify-center rounded-full bg-card/90 text-text shadow-lg transition-colors duration-(--dur-micro) hover:bg-card"
            >
              {actualSize ? (
                <Minimize2 className="size-5" strokeWidth={2} aria-hidden />
              ) : (
                <Maximize2 className="size-5" strokeWidth={2} aria-hidden />
              )}
            </button>
            <button
              type="button"
              onClick={close}
              aria-label={closeLabel}
              className="inline-flex size-10 items-center justify-center rounded-full bg-card/90 text-text shadow-lg transition-colors duration-(--dur-micro) hover:bg-card"
            >
              <X className="size-5" strokeWidth={2} aria-hidden />
            </button>
          </div>
          {/* At its own size the wrapper is what scrolls, so the buttons stay
              put while the picture moves under them. */}
          <div className={actualSize ? "max-h-[100dvh] max-w-[100vw] overflow-auto" : undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              onClick={() => setActualSize((current) => !current)}
              width={width ?? undefined}
              height={height ?? undefined}
              className={
                actualSize
                  ? "block h-auto w-auto max-w-none cursor-zoom-out rounded-control bg-card"
                  : "block max-h-[calc(100dvh-4rem)] w-auto max-w-full cursor-zoom-in rounded-control bg-card"
              }
            />
          </div>
        </div>
      </dialog>
    </figure>
  );
}
