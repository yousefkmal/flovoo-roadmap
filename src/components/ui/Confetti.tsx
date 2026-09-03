"use client";

import { useEffect, useRef } from "react";

/**
 * A short burst of confetti for the one moment that deserves it — an idea
 * accepted. Hand-rolled rather than pulled in as a dependency: it is ~40 lines
 * of physics and this way it uses the brand palette and stops on its own.
 *
 * Skipped entirely under `prefers-reduced-motion`; the confirmation message
 * carries the meaning, the confetti only carries the mood.
 */
const COLORS = ["#2EA8FF", "#4D6BFB", "#7A5AF8", "#12B76A", "#F79009"];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  size: number;
  color: string;
}

export function Confetti({ pieces = 90 }: { pieces?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const items: Piece[] = Array.from({ length: pieces }, () => ({
      x: width / 2 + (Math.random() - 0.5) * width * 0.5,
      y: height * 0.42 + (Math.random() - 0.5) * 24,
      vx: (Math.random() - 0.5) * 6,
      vy: -(3 + Math.random() * 6),
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      size: 4 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));

    let frame = 0;
    let raf = 0;
    const TOTAL_FRAMES = 150;

    function tick() {
      if (!ctx || !canvas) return;
      frame += 1;
      ctx.clearRect(0, 0, width, height);

      // Fade the whole burst out over its last third rather than cutting it.
      const fade = frame > TOTAL_FRAMES * 0.66 ? 1 - (frame - TOTAL_FRAMES * 0.66) / (TOTAL_FRAMES * 0.34) : 1;
      ctx.globalAlpha = Math.max(fade, 0);

      for (const piece of items) {
        piece.vy += 0.22; // gravity
        piece.vx *= 0.99; // drag
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.rotation += piece.spin;

        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.rotation);
        ctx.fillStyle = piece.color;
        ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.6);
        ctx.restore();
      }

      if (frame < TOTAL_FRAMES) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, width, height);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pieces]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 size-full"
    />
  );
}
