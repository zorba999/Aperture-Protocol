"use client";

import { useEffect, useRef } from "react";

/**
 * Procedural stand in for the footage itself. Every asset id seeds a different
 * aerial looking flow field, so the archive stays visually distinct without
 * shipping a single external asset. Nothing here ever 404s on Vercel.
 */

function hash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Props = {
  seed: string;
  intensity?: number;
  className?: string;
};

export default function ClipField({ seed, intensity = 1, className }: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const rnd = hash(seed);
    const hueA = Math.floor(rnd() * 360);
    const hueB = (hueA + 40 + Math.floor(rnd() * 120)) % 360;
    const bands = 26 + Math.floor(rnd() * 20);
    const f1 = 0.9 + rnd() * 2.4;
    const f2 = 1.8 + rnd() * 4.2;
    const f3 = 3.2 + rnd() * 6;
    const amp = 0.05 + rnd() * 0.1;
    const drift = 0.06 + rnd() * 0.16;
    const tilt = (rnd() - 0.5) * 0.5;
    const sat = 26 + rnd() * 30;

    let width = 0;
    let height = 0;
    let raf = 0;
    let t = rnd() * 100;
    let visible = true;
    let last = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const target = Math.min(520, Math.max(220, Math.round(rect.width)));
      const ratio = rect.height > 0 ? rect.height / rect.width : 0.625;
      width = target;
      height = Math.round(target * ratio);
      canvas.width = width;
      canvas.height = height;
    };

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible) return;
      if (now - last < 33) return;
      last = now;
      t += drift * 0.06;

      ctx.fillStyle = `hsl(${hueA} ${sat * 0.5}% 5%)`;
      ctx.fillRect(0, 0, width, height);

      const step = height / bands;
      for (let i = bands; i >= 0; i -= 1) {
        const p = i / bands;
        const baseY = p * height;
        const light = (4 + p * 46) * intensity;
        const hue = hueA + (hueB - hueA) * p;

        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let x = 0; x <= width; x += 6) {
          const u = x / width;
          const wave =
            Math.sin(u * f1 * Math.PI * 2 + t + p * 3.1) * amp +
            Math.sin(u * f2 * Math.PI * 2 - t * 1.4 + p * 5.7) * amp * 0.5 +
            Math.sin(u * f3 * Math.PI * 2 + t * 0.7 - p * 2.2) * amp * 0.24;
          const y = baseY + wave * height * (0.35 + p) + (u - 0.5) * height * tilt;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fillStyle = `hsl(${hue} ${sat}% ${light}%)`;
        ctx.fill();
      }

      // scan haze
      const haze = ctx.createLinearGradient(0, 0, 0, height);
      haze.addColorStop(0, "rgba(8,8,10,0.68)");
      haze.addColorStop(0.5, "rgba(8,8,10,0)");
      haze.addColorStop(1, "rgba(8,8,10,0.42)");
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, width, height);
    };

    resize();
    raf = requestAnimationFrame(draw);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
      },
      { rootMargin: "160px" },
    );
    io.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, [seed, intensity]);

  return <canvas ref={ref} className={className} aria-hidden />;
}
