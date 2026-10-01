"use client";

// Wischen über den Inhalt = nächster/voriger Reiter (01.10.2026).
// Navigiert über den Router, damit die Adresse mitzieht und „Zurück" im
// Browser weiter funktioniert. Entscheidung in lib/wischen.ts.
//
// Kein Wisch, wenn er …
//   - in einem Eingabefeld beginnt (Text markieren, Cursor setzen),
//   - in einem waagerecht scrollbaren Bereich beginnt (Tabellen, Leisten,
//     Diagramme) — der braucht die Geste selbst,
//   - in einem Bereich mit `data-kein-wischen` beginnt,
//   - am Bildschirmrand beginnt (System-Zurück-Geste).
// Verschachtelt (Ansicht Mieter im Vermieter-Portal): Der innere wechselt und
// hält die Geste an, der äußere sieht sie nicht.
import { useRouter } from "next/navigation";
import { useRef, type ReactNode } from "react";
import { wischRichtung, zielReiter } from "@/lib/wischen";

function blockiert(ziel: EventTarget | null, wurzel: HTMLElement): boolean {
  let el = ziel instanceof Element ? ziel : null;
  while (el && el !== wurzel) {
    if (el.matches("input, textarea, select, [contenteditable=''], [contenteditable='true'], [data-kein-wischen]")) return true;
    if (el instanceof HTMLElement) {
      const ox = getComputedStyle(el).overflowX;
      if ((ox === "auto" || ox === "scroll") && el.scrollWidth > el.clientWidth + 1) return true;
    }
    el = el.parentElement;
  }
  return false;
}

export default function WischReiter({ reiter, aktuell, children }: { reiter: string[]; aktuell: number; children: ReactNode }) {
  const router = useRouter();
  const wurzel = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; t: number } | null>(null);

  return (
    <div
      ref={wurzel}
      onTouchStart={(e) => {
        if (e.touches.length !== 1 || !wurzel.current || blockiert(e.target, wurzel.current)) {
          start.current = null;
          return;
        }
        const p = e.touches[0];
        start.current = { x: p.clientX, y: p.clientY, t: e.timeStamp };
      }}
      onTouchEnd={(e) => {
        const s = start.current;
        start.current = null;
        if (!s) return;
        const p = e.changedTouches[0];
        const richtung = wischRichtung({
          dx: p.clientX - s.x,
          dy: p.clientY - s.y,
          ms: e.timeStamp - s.t,
          startX: s.x,
          breite: window.innerWidth,
        });
        if (richtung === 0) return;
        // Waagerechter Wisch: gehört diesem Bereich, auch am Listenrand —
        // sonst wechselte ein äußerer Bereich unerwartet seinen Reiter.
        e.stopPropagation();
        const ziel = zielReiter(reiter, aktuell, richtung);
        if (ziel) router.push(ziel, { scroll: false });
      }}
      onTouchCancel={() => { start.current = null; }}
    >
      {children}
    </div>
  );
}
