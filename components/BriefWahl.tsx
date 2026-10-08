"use client";

// „Dokument“ → Auswahl Zahlungserinnerung oder Mahnung (08.10.2026, Vorgabe des Betreibers:
// „bei Dokument, wenn man drauf drückt, erscheint in Grau, Apple-Design, die Auswahl“).
//
// Am Handy ein Aktionsblatt von unten (wie iOS), am Desktop ein kleines Blatt direkt am Knopf.
// Liegt im Portal an `document.body` — die Karten (.section) schneiden mit `overflow: hidden` ab.
// Keine Sperre: Die Mahnung ist immer wählbar; fehlt eine Erinnerung im Archiv, steht das nur als
// Hinweis darunter (lib/mahnung.ts → erinnerungArchiviert).
import Link from "next/link";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FileText } from "lucide-react";
import type { ZahlungsBriefWahl } from "@/lib/mahnung";

type Ort = { top: number; right: number };

/** Ab dieser Breite hängt das Blatt am Knopf; darunter kommt es von unten (globals.css, .briefwahl). */
const BLATT_AM_KNOPF = "(min-width: 561px)";

export default function BriefWahl({
  wahl,
  label = "Dokument",
  className = "btn btn-ghost briefwahl-knopf",
}: {
  wahl: ZahlungsBriefWahl;
  label?: string;
  className?: string;
}) {
  // zu = geschlossen · offen = sichtbar · gehtZu = Ausgangsbewegung läuft (gleicher Weg zurück)
  const [stand, setStand] = useState<"zu" | "offen" | "gehtZu">("zu");
  const [ort, setOrt] = useState<Ort>({ top: 0, right: 0 });
  const knopf = useRef<HTMLButtonElement>(null);
  const erste = useRef<HTMLAnchorElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  const schliessen = useCallback((fokusZurueck = true) => {
    setStand((s) => (s === "offen" ? "gehtZu" : s));
    // Rückfall, falls animationend ausbleibt (reduzierte Bewegung, Tab im Hintergrund).
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStand("zu"), 260);
    if (fokusZurueck) knopf.current?.focus();
  }, []);

  const oeffnen = () => {
    const r = knopf.current?.getBoundingClientRect();
    if (r) setOrt({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    if (timer.current) clearTimeout(timer.current);
    setStand("offen");
  };

  // Fokus auf die erste Wahl, sobald das Blatt steht (vor dem Zeichnen, kein Springen).
  useLayoutEffect(() => {
    if (stand === "offen") erste.current?.focus({ preventScroll: true });
  }, [stand]);

  useEffect(() => {
    if (stand !== "offen") return;
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") schliessen();
    };
    document.addEventListener("keydown", taste);
    // Nur am Desktop hängt das Blatt am Knopf: Scrollen oder Größe ändern verschiebt ihn, das Blatt
    // hinge sonst in der Luft. Am Handy NICHT — dort feuert schon das Ein-/Ausblenden der
    // Adressleiste ein resize, und das Blatt unten hängt nicht am Knopf.
    const amKnopf = window.matchMedia(BLATT_AM_KNOPF).matches;
    const weg = () => schliessen(false);
    if (amKnopf) {
      window.addEventListener("resize", weg);
      window.addEventListener("scroll", weg, { passive: true, capture: true });
    }
    return () => {
      document.removeEventListener("keydown", taste);
      if (amKnopf) {
        window.removeEventListener("resize", weg);
        window.removeEventListener("scroll", weg, { capture: true });
      }
    };
  }, [stand, schliessen]);

  const sichtbar = stand !== "zu";
  return (
    <>
      <button
        ref={knopf}
        type="button"
        className={className}
        aria-haspopup="dialog"
        aria-expanded={stand === "offen"}
        aria-controls={sichtbar ? id : undefined}
        onClick={() => (stand === "offen" ? schliessen() : oeffnen())}
      >
        <FileText size={13} aria-hidden /> {label}
      </button>
      {sichtbar &&
        createPortal(
          <div className={`briefwahl ${stand === "gehtZu" ? "briefwahl-geht" : ""}`}>
            <div className="briefwahl-schleier" onClick={() => schliessen()} aria-hidden />
            <div
              id={id}
              role="dialog"
              aria-label="Dokument wählen"
              className="briefwahl-blatt"
              style={{ top: ort.top, right: ort.right }}
              onAnimationEnd={(e) => {
                if (e.target === e.currentTarget && stand === "gehtZu") setStand("zu");
              }}
            >
              <div className="briefwahl-gruppe">
                <p className="briefwahl-titel">{wahl.titel}</p>
                <Link ref={erste} href={wahl.erinnerung} className="briefwahl-option" onClick={() => setStand("zu")}>
                  <span>Zahlungserinnerung</span>
                  <span className="briefwahl-sub">Freundlich, mit Frist von einer Woche</span>
                </Link>
                <Link href={wahl.mahnung} className="briefwahl-option" onClick={() => setStand("zu")}>
                  <span>Mahnung</span>
                  <span className="briefwahl-sub">
                    {wahl.erinnerungArchiviert ? "Zahlungserinnerung liegt im Archiv" : "Noch keine Zahlungserinnerung im Archiv"}
                  </span>
                </Link>
              </div>
              <button type="button" className="briefwahl-option briefwahl-abbrechen" onClick={() => schliessen()}>
                Abbrechen
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
