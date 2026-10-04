// Schulden-Uhr: EINE Zeile über den Krediten (04.10.2026) — offene Schuld groß, darunter ein
// Balken „abbezahlt / offen“, rechts die Tilgung je Monat. Rechnung: lib/schuldenStand.ts.
// Kein Sekundenzähler — die Restschuld ist ein eingetragener Stand, kein Live-Wert.
import { euro } from "@/lib/format";
import type { SchuldenStand } from "@/lib/schuldenStand";

export default function SchuldenUhr({ stand, zusatz }: { stand: SchuldenStand; zusatz?: string }) {
  const p = stand.prozent ?? 0;
  const pText = (stand.prozent ?? 0).toLocaleString("de-DE", { maximumFractionDigits: 1 });
  return (
    <div className="schulden-uhr">
      <div className="su-kopf">
        <span className="kpi-label">Schulden gesamt</span>
        <span className="su-zahl">{euro(stand.offen)}</span>
        {zusatz && <span className="su-zusatz">{zusatz}</span>}
      </div>
      <div className="su-mitte">
        <div className="su-balken" role="img" aria-label={`${pText} % abbezahlt`}>
          <i style={{ width: `${Math.min(100, Math.max(0, p))}%` }} />
        </div>
        <div className="su-legende">
          <span><b>Abbezahlt {euro(stand.getilgt)}</b> · {pText} %</span>
          <span>von {euro(stand.ursprung)}</span>
        </div>
      </div>
      <div className="su-rechts" title="Näherung: Rate minus Zinsanteil, über alle Kredite">
        <span className="su-tilgung">− {euro(stand.tilgungMonat)}</span>
        <span className="su-zusatz">Tilgung / Monat</span>
      </div>
    </div>
  );
}
