"use client";

// Bundesland-Auswahl für die Grunderwerbsteuer — EINE Komponente für den Nebenkosten-Rechner (Fahrplan),
// den Objekt-Rechner (/vergleich) und die Strategie (Gesamtprüfung 07.10.2026, Zusammenführung 11).
//
// Wert = Länderkürzel (lib/kalk.ts). Vorher war der Wert der Steuersatz: Fünf Länder haben 5,0 %, und
// nach dem Laden stand das erste Land mit demselben Satz da (B32). Ein gespeicherter Satz aus der Zeit
// davor („0.05“) lässt sich keinem Land eindeutig zuordnen — er erscheint deshalb als eigene Zeile
// „5,0 % (Bundesland nicht gespeichert)“, bis der Nutzer ein Land wählt. Der Betrag bleibt dabei richtig.

import { BUNDESLAENDER, altSatzAus, landAus } from "@/lib/kalk";

const prozent = (satz: number) => `${(satz * 100).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} %`;

export default function BundeslandWahl({
  wert,
  onWahl,
  id,
  className,
  style,
}: {
  /** Länderkürzel — oder ein gespeicherter Satz aus dem Altbestand. */
  wert: string;
  onWahl: (kuerzel: string) => void;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const alt = landAus(wert) ? null : altSatzAus(wert);
  return (
    <select id={id} className={className} style={style} value={wert} onChange={(e) => onWahl(e.target.value)}>
      {alt != null && <option value={wert}>{prozent(alt)} (Bundesland nicht gespeichert)</option>}
      {BUNDESLAENDER.map((b) => (
        <option key={b.k} value={b.k}>
          {b.l}
        </option>
      ))}
    </select>
  );
}
