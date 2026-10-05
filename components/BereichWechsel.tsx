"use client";

// Umschalter MyImmo ↔ BuyImmo am Logo oben links (05.10.2026, Vorgabe des Betreibers).
//
// Ein Logo allein erkennt kaum jemand als Schalter. Deshalb steht neben der Wortmarke ein
// Doppelpfeil und darunter der Name des offenen Bereichs; das Menü nennt in einem Satz, wofür
// jeder Bereich da ist. Die Einträge sind echte Links auf die Startseite des Bereichs — der
// offene Bereich folgt danach aus der Adresse (`lib/bereich.ts`), nichts wird gespeichert.

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronsUpDown } from "lucide-react";
import { BEREICHE, BEREICH_REIHENFOLGE, type Bereich } from "@/lib/bereich";

export default function BereichWechsel({ bereich }: { bereich: Bereich }) {
  const [offen, setOffen] = useState(false);
  const huelle = useRef<HTMLDivElement>(null);
  const knopf = useRef<HTMLButtonElement>(null);
  const menueId = useId();
  const info = BEREICHE[bereich];

  // Schließen bei Klick daneben und mit Escape (Fokus zurück auf den Knopf).
  useEffect(() => {
    if (!offen) return;
    const daneben = (e: PointerEvent) => {
      if (huelle.current && !huelle.current.contains(e.target as Node)) setOffen(false);
    };
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOffen(false);
        knopf.current?.focus();
      }
    };
    document.addEventListener("pointerdown", daneben);
    document.addEventListener("keydown", taste);
    return () => {
      document.removeEventListener("pointerdown", daneben);
      document.removeEventListener("keydown", taste);
    };
  }, [offen]);

  return (
    <div className="bereich-wechsel" ref={huelle}>
      <button
        ref={knopf}
        type="button"
        className="bereich-knopf"
        aria-expanded={offen}
        aria-controls={menueId}
        aria-label={`${info.name} — Bereich wechseln`}
        title="Zwischen MyImmo und BuyImmo wechseln"
        onClick={() => setOffen((o) => !o)}
      >
        {/* Ausgeklappt: Wortmarke. Eingeklappt (Rail): das App-Icon, damit die Wortmarke
            nicht auf 68px zusammengequetscht wird. */}
        <span className="brand-wordmark">
          {info.marke}
          <span>Immo</span>
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/myimmo_logo_2048.png" alt="" className="brand-icon" width={38} height={38} />
        <ChevronsUpDown size={14} className="bereich-pfeil" aria-hidden />
      </button>
      <p>{info.zusatz}</p>

      {offen && (
        <div id={menueId} className="bereich-menue">
          {BEREICH_REIHENFOLGE.map((b) => {
            const e = BEREICHE[b];
            const aktiv = b === bereich;
            return (
              <Link
                key={b}
                href={e.start}
                className={`bereich-eintrag${aktiv ? " aktiv" : ""}`}
                aria-current={aktiv ? "true" : undefined}
                onClick={() => setOffen(false)}
              >
                <span className="bereich-eintrag-kopf">
                  <span className="brand-wordmark">
                    {e.marke}
                    <span>Immo</span>
                  </span>
                  {aktiv && <Check size={14} className="bereich-haken" aria-hidden />}
                </span>
                <span className="bereich-eintrag-text">{e.beschreibung}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
