"use client";

import { useEffect, useRef, useState } from "react";
import Lenis from "lenis";

/* ------------------------------------------------------------------ */
/* film grain                                                          */
/* ------------------------------------------------------------------ */

export function Grain() {
  return <div className="grain" aria-hidden />;
}

/* ------------------------------------------------------------------ */
/* cursor                                                              */
/* ------------------------------------------------------------------ */

export function Cursor() {
  const dot = useRef<HTMLDivElement | null>(null);
  const ring = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (window.matchMedia("(hover: none)").matches) return;
    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;
    let raf = 0;

    const move = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (dot.current) dot.current.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      const el = e.target as HTMLElement | null;
      const hot = !!el?.closest?.("a, button, .clip, input, textarea, [data-hot]");
      if (ring.current) ring.current.dataset.hot = hot ? "1" : "0";
    };

    const loop = () => {
      raf = requestAnimationFrame(loop);
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      if (ring.current) ring.current.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    };

    window.addEventListener("mousemove", move, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("mousemove", move);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div ref={ring} className="cursor">
        <div className="cursor-ring" />
      </div>
      <div ref={dot} className="cursor">
        <div className="cursor-dot" />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* smooth scroll                                                       */
/* ------------------------------------------------------------------ */

export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({ duration: 1.15, smoothWheel: true, lerp: 0.09 });
    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);
  return null;
}

/* ------------------------------------------------------------------ */
/* preloader                                                           */
/* ------------------------------------------------------------------ */

export function Preloader() {
  const [count, setCount] = useState(0);
  const [gone, setGone] = useState(false);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    if (sessionStorage.getItem("aperture.booted") === "1") {
      setMounted(false);
      return;
    }
    document.body.classList.add("is-locked");
    let value = 0;
    const tick = setInterval(() => {
      value = Math.min(100, value + 2 + Math.random() * 9);
      setCount(Math.floor(value));
      if (value >= 100) {
        clearInterval(tick);
        setTimeout(() => {
          setGone(true);
          document.body.classList.remove("is-locked");
          sessionStorage.setItem("aperture.booted", "1");
        }, 380);
        setTimeout(() => setMounted(false), 1500);
      }
    }, 62);
    return () => {
      clearInterval(tick);
      document.body.classList.remove("is-locked");
    };
  }, []);

  if (!mounted) return null;

  return (
    <div className="preloader" data-gone={gone ? "1" : "0"}>
      <div>
        <div className="label" style={{ marginBottom: 14 }}>
          Aperture Protocol
        </div>
        <div className="mono" style={{ color: "var(--bone-60)" }}>
          Adaptive licensing
          <br />
          Testnet Bradbury
        </div>
      </div>
      <div className="preloader-count">{String(count).padStart(3, "0")}</div>
      <div className="preloader-bar">
        <span style={{ transform: `scaleX(${count / 100})`, transition: "transform .3s linear" }} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* reveals                                                             */
/* ------------------------------------------------------------------ */

function useInView<T extends HTMLElement>(delay = 0) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setTimeout(() => node.setAttribute("data-in", "1"), delay);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [delay]);
  return ref;
}

export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useInView<HTMLDivElement>(delay);
  const Component = Tag as React.ElementType;
  return (
    <Component ref={ref} className={`reveal ${className}`} style={style}>
      {children}
    </Component>
  );
}

export function MaskLine({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useInView<HTMLSpanElement>(delay);
  return (
    <span ref={ref} className={`mask-line ${className}`}>
      <span>{children}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* marquee                                                             */
/* ------------------------------------------------------------------ */

export function Marquee({
  items,
  speed,
}: {
  items: React.ReactNode[];
  speed?: "fast";
}) {
  const track = (
    <div className="marquee-track">
      {items.map((item, i) => (
        <span className="marquee-item mono" key={i}>
          <span className="acid">/</span>
          {item}
        </span>
      ))}
    </div>
  );
  return (
    <div className="marquee" data-speed={speed}>
      {track}
      {track}
    </div>
  );
}
