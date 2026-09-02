"use client";

// Parallax fürs Hero-Medium (Baukasten-Signature): Das Medium hat 12 %
// Überhang (CSS inset) und wandert beim Scrollen langsamer als die Seite.
// rAF-gedrosselt; bei prefers-reduced-motion schaltet das CSS den Transform ab.

import { useEffect, useRef, type ReactNode } from "react";

export default function QlxParallax({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const tick = () => {
      raf = 0;
      // Nur solange der Hero überhaupt im Bild ist rechnen.
      const teil = el.parentElement?.getBoundingClientRect();
      if (!teil || teil.bottom < 0) return;
      el.style.transform = `translateY(${Math.min(window.scrollY * 0.18, 160)}px)`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={ref} className="qlx-hero-medium">
      {children}
    </div>
  );
}
