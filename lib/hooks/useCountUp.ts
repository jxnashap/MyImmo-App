"use client";
import { useEffect, useRef, useState } from "react";

// Sanftes Hochzählen einer Zahl zum Zielwert (easeOutCubic). Rein visuell:
// der letzte Frame setzt exakt den Zielwert. Respektiert prefers-reduced-motion
// (springt dann sofort) → identisches Ergebnis, keine Vortäuschung.
const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function useCountUp(ziel: number, dauer = 500): number {
  const [wert, setWert] = useState(ziel);
  const vonRef = useRef(ziel);
  const rafRef = useRef<number>();
  useEffect(() => {
    if (prefersReduced() || dauer <= 0) { setWert(ziel); vonRef.current = ziel; return; }
    const von = vonRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dauer);
      const eased = 1 - Math.pow(1 - p, 3);
      setWert(von + (ziel - von) * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else vonRef.current = ziel;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [ziel, dauer]);
  return wert;
}
