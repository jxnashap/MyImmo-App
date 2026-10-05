"use client";

// Eine Diagramm-Karte mit Umschalter oben links (04.10.2026, Wunsch des Betreibers): statt
// zwei Grafiken untereinander EINE, zwischen der man wechselt. Rechts im Kopf steht, was zur
// gewählten Ansicht gehört (Prozent-Abzeichen bzw. Zeitraum 1J/3J/5J/Max).
//
// Die Wahl merkt sich der Browser (localStorage) — eine reine Komfort-Einstellung; fehlt der
// Speicher (privates Fenster), startet die Karte einfach mit der ersten Ansicht.
import { useEffect, useState, type ReactNode } from "react";

export type DiagrammAnsicht = { schluessel: string; titel: string; rechts?: ReactNode; inhalt: ReactNode };

export default function DiagrammWechsel({ ansichten, speicherSchluessel }: { ansichten: DiagrammAnsicht[]; speicherSchluessel: string }) {
  const [aktiv, setAktiv] = useState(ansichten[0]?.schluessel ?? "");
  const schluessel = ansichten.map((a) => a.schluessel).join("|");

  useEffect(() => {
    try {
      const gemerkt = window.localStorage.getItem(speicherSchluessel);
      // Erst nach dem Mount lesen — der Server kennt den Speicher nicht (sonst Hydrationsfehler).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (gemerkt && schluessel.split("|").includes(gemerkt)) setAktiv(gemerkt);
    } catch {
      /* kein Speicher → erste Ansicht */
    }
  }, [schluessel, speicherSchluessel]);

  const waehle = (s: string) => {
    setAktiv(s);
    try {
      window.localStorage.setItem(speicherSchluessel, s);
    } catch {
      /* nicht merken ist harmlos */
    }
  };

  const ansicht = ansichten.find((a) => a.schluessel === aktiv) ?? ansichten[0];
  if (!ansicht) return null;

  return (
    <div className="section" style={{ marginBottom: 0 }}>
      <div className="section-header">
        <div role="tablist" aria-label="Grafik wählen" className="diagramm-wahl">
          {ansichten.map((a) => (
            <button
              key={a.schluessel}
              type="button"
              role="tab"
              aria-selected={a.schluessel === ansicht.schluessel}
              className={a.schluessel === ansicht.schluessel ? "aktiv" : undefined}
              onClick={() => waehle(a.schluessel)}
            >
              {a.titel}
            </button>
          ))}
        </div>
        {ansicht.rechts}
      </div>
      <div className="section-body" role="tabpanel">{ansicht.inhalt}</div>
    </div>
  );
}
