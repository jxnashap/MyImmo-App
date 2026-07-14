"use client";

// 3D-Tilt: Karte neigt sich dezent zur Mausposition (perspective-Transform).
// Auf Touch-Geräten und bei prefers-reduced-motion passiert nichts.

import { useRef, type ReactNode } from "react";

const MAX_DEG = 7;

export default function Tilt({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(700px) rotateY(${px * MAX_DEG}deg) rotateX(${-py * MAX_DEG}deg) translateY(-2px)`;
  };
  const onLeave = () => {
    const el = ref.current;
    if (el) el.style.transform = "";
  };

  return (
    <div ref={ref} className={`lp-tilt${className ? " " + className : ""}`} onPointerMove={onMove} onPointerLeave={onLeave}>
      {children}
    </div>
  );
}
