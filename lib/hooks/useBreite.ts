"use client";
// Breite eines Elements in Pixeln, laufend nachgeführt (ResizeObserver).
//
// Für Diagramme (03.10.2026): Ein per viewBox gestrecktes SVG skaliert seine SCHRIFT
// mit — in einer halben Spalte schrumpfte die Achsenbeschriftung auf ~6 px, in voller
// Breite wuchs sie auf ~18 px. Mit der gemessenen Breite als Koordinatensystem ist
// 1 Einheit = 1 Pixel, und 11,5 heißt überall 11,5 px.
// `null`, bis gemessen ist (beim Server-Rendern gibt es keine Breite).
// Callback-Ref statt useRef: Erscheint das Element erst später (z. B. nach einem
// Leerzustand), wird es trotzdem beobachtet.
import { useEffect, useState } from "react";

export function useBreite<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [breite, setBreite] = useState<number | null>(null);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver((eintraege) => {
      const w = Math.round(eintraege[0]?.contentRect.width ?? 0);
      if (w > 0) setBreite((alt) => (alt === w ? alt : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, breite] as const;
}
