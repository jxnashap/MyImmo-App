"use client";

// Scroll-Reveal: Kinder gleiten beim Erscheinen im Viewport sanft nach oben.
// Respektiert prefers-reduced-motion (CSS schaltet die Animation dort ab).

import { useEffect, useRef, type ReactNode } from "react";

export default function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number; // ms, für gestaffelte Karten
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Kann der Browser scroll-getriebene Animationen, uebernimmt CSS das
    // Einblenden (globals.css, `animation-timeline: view()`) — dann entsteht
    // hier gar kein Beobachter. Das spart auf der oeffentlichen Strecke 45
    // IntersectionObserver und verlagert die Bewegung vom Hauptthread weg.
    // Der JS-Weg bleibt als Rueckfall fuer aeltere Browser (~16 % Stand 09/2026).
    if (typeof CSS !== "undefined" && CSS.supports?.("animation-timeline: view()")) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add("lp-reveal-in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`lp-reveal${className ? " " + className : ""}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}
