import { TrendingUp, TrendingDown, Check } from "lucide-react";
import { uebernehmeIndexwert } from "@/lib/actions/properties";
import { HPI_QUELLE } from "@/lib/wert/hpi";
import type { Fortschreibung } from "@/lib/wert/fortschreibung";

const euro = (n: number) => "€ " + Math.round(n).toLocaleString("de-DE");

// Indexierte Wertschätzung (Kaufpreis × amtlicher Häuserpreisindex) auf der
// Objektseite. Übernahme als "aktueller Wert" nur per Klick — vorschlagen +
// bestätigen, keine stille Automatik.
export default function IndexwertKarte({
  propId, f, aktuellerWert, live,
}: {
  propId: string; f: Fortschreibung; aktuellerWert: number | null; live: boolean;
}) {
  const steigt = f.veraenderungProzent >= 0;
  const Icon = steigt ? TrendingUp : TrendingDown;
  const abweichung = aktuellerWert && aktuellerWert > 0
    ? Math.round(((f.wert - aktuellerWert) / aktuellerWert) * 1000) / 10
    : null;
  const uebernehmen = uebernehmeIndexwert.bind(null, propId, f.wert, f.standQuartal);

  return (
    <div className="section" style={{ marginBottom: 0 }}>
      <div className="section-header">
        <h3><Icon size={15} style={{ verticalAlign: "-2px" }} /> Indexierte Wertschätzung</h3>
        <span className={`badge ${steigt ? "badge-green" : "badge-neutral"}`}>
          {steigt ? "+" : ""}{f.veraenderungProzent.toLocaleString("de-DE")} % seit Kauf
        </span>
      </div>
      <div className="section-body">
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 24, fontWeight: 700, color: "var(--gold)" }}>{euro(f.wert)}</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Stand {f.standQuartal}</span>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 6 }}>
          Kaufpreis × Entwicklung des amtlichen Häuserpreisindex seit {f.basisQuartal}
          {" "}(Index {f.basisIndex.toLocaleString("de-DE")} → {f.standIndex.toLocaleString("de-DE")}).
          {abweichung != null && (
            <> Dein eingetragener Wert ({euro(aktuellerWert!)}) liegt {Math.abs(abweichung).toLocaleString("de-DE")} % {abweichung > 0 ? "darunter" : "darüber"}.</>
          )}
        </div>
        <form action={uebernehmen} style={{ marginTop: 12 }}>
          <button type="submit" className="btn btn-outline" style={{ fontSize: 12.5 }}>
            <Check size={13} style={{ verticalAlign: "-2px" }} /> Als aktuellen Wert übernehmen
          </button>
        </form>
        <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 10 }}>
          Indexierte Schätzung (bundesweiter Index, keine regionale Lage) — kein Marktwert/Gutachten.
          Quelle: {HPI_QUELLE.name}, {HPI_QUELLE.basis}, {HPI_QUELLE.lizenz}{live ? "" : ` · Offline-Stand ${HPI_QUELLE.snapshotStand}`}.
        </div>
      </div>
    </div>
  );
}
