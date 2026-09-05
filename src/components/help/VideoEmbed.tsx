"use client";

import { Play } from "lucide-react";
import { useState } from "react";

/**
 * An embedded video behind a facade: the poster and a play control render as
 * plain markup, and the player iframe is created only when the reader asks.
 * That keeps a third-party player off the critical path of every article,
 * which is what the performance budget needs.
 *
 * Ids are restricted to the characters providers actually use, so a stored
 * value can never turn into a different URL.
 */
export function VideoEmbed({
  provider,
  id,
  title,
  playLabel,
}: {
  provider: "youtube" | "vimeo";
  id: string;
  title: string;
  playLabel: string;
}) {
  const [playing, setPlaying] = useState(false);
  const safeId = id.replace(/[^A-Za-z0-9_-]/g, "");

  const src =
    provider === "youtube"
      ? `https://www.youtube-nocookie.com/embed/${safeId}?autoplay=1&rel=0`
      : `https://player.vimeo.com/video/${safeId}?autoplay=1`;
  const poster =
    provider === "youtube" ? `https://i.ytimg.com/vi/${safeId}/hqdefault.jpg` : null;

  return (
    <div className="my-2 overflow-hidden rounded-control border border-border bg-flovoo-navy">
      <div className="relative aspect-video">
        {playing ? (
          <iframe
            src={src}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 size-full"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={playLabel}
            className="group absolute inset-0 flex items-center justify-center"
          >
            {poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={poster}
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute inset-0 size-full object-cover opacity-80 transition-opacity duration-(--dur-standard) group-hover:opacity-100"
              />
            ) : null}
            {/* The play glyph is a media icon: it never mirrors. */}
            <span className="relative inline-flex size-16 items-center justify-center rounded-full bg-brand-solid text-brand-solid-text shadow-lg transition-transform duration-(--dur-standard) ease-(--ease-expo) group-hover:scale-105">
              <Play className="ms-1 size-7" strokeWidth={2} fill="currentColor" aria-hidden />
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
