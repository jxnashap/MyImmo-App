"use client";

// Kaufnebenkosten auf einen Blick (BuyImmo-Fahrplan, 05.10.2026): Kaufpreis + Bundesland +
// Makler ja/nein → was zusätzlich zum Kaufpreis anfällt. Dieselbe Regel wie im Kauf-Rechner
// (`kaufnebenkosten()` in lib/kalk.ts). Reine Rechnung, keine Aussage darüber, ob jemand kaufen kann.

import { useState } from "react";
import { BUNDESLAENDER, MAKLER_STANDARD_PROZENT, NOTAR_GRUNDBUCH_SATZ, kaufnebenkosten } from "@/lib/kalk";
import { euro } from "@/lib/format";
import { zahlDe0 } from "@/lib/zahl";

const prozent = (anteil: number) => `${(anteil * 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`;

export default function NebenkostenRechner() {
  const [kaufpreis, setKaufpreis] = useState("250.000");
  // Index statt Steuersatz als Wert: Fünf Länder haben 5,0 % — mit dem Satz als Wert sprang die
  // Auswahl von „Niedersachsen“ auf „Baden-Württemberg“ zurück (gleicher Wert, erste Option gewinnt).
  const [land, setLand] = useState("0");
  const [mitMakler, setMitMakler] = useState(true);

  const kp = zahlDe0(kaufpreis);
  const grest = BUNDESLAENDER[Number(land)]?.v ?? 0;
  const nk = kaufnebenkosten(kp, grest, mitMakler ? MAKLER_STANDARD_PROZENT : 0);

  // In der Demo bedienbar (`data-demo-erlaubt`): reine Rechnung, nichts wird gespeichert.
  return (
    <div className="nk-rechner" data-demo-erlaubt>
      <div className="nk-rechner-eingabe">
        <div className="form-group">
          <label htmlFor="nk-kaufpreis">Kaufpreis €</label>
          <input id="nk-kaufpreis" inputMode="decimal" value={kaufpreis} onChange={(e) => setKaufpreis(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="nk-land">Bundesland</label>
          <select id="nk-land" value={land} onChange={(e) => setLand(e.target.value)}>
            {BUNDESLAENDER.map((b, i) => (
              <option key={b.l} value={String(i)}>{b.l}</option>
            ))}
          </select>
        </div>
        <label className="massnahme-chip nk-makler">
          <input type="checkbox" checked={mitMakler} onChange={(e) => setMitMakler(e.target.checked)} />
          Mit Makler ({MAKLER_STANDARD_PROZENT.toLocaleString("de-DE")} %)
        </label>
      </div>
      <div className="nk-rechner-ergebnis">
        <div className="nk-zeile"><span>Grunderwerbsteuer ({prozent(grest)})</span><span className="zahl">{euro(nk.grunderwerbsteuer)}</span></div>
        <div className="nk-zeile"><span>Notar und Grundbuch (ca. {prozent(NOTAR_GRUNDBUCH_SATZ)})</span><span className="zahl">{euro(nk.notarGrundbuch)}</span></div>
        {mitMakler && (
          <div className="nk-zeile"><span>Makler ({MAKLER_STANDARD_PROZENT.toLocaleString("de-DE")} %)</span><span className="zahl">{euro(nk.makler)}</span></div>
        )}
        <div className="nk-zeile nk-summe"><span>Kaufnebenkosten</span><span className="zahl">{euro(nk.summe)}</span></div>
        <p className="nk-hinweis">
          {prozent(nk.satz)} vom Kaufpreis, zusätzlich zum Kaufpreis. Viele Banken finanzieren die Nebenkosten nicht
          mit — frag bei deiner Bank nach.
        </p>
      </div>
    </div>
  );
}
