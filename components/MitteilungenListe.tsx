// Mitteilungen des Vermieters im Mieterportal (02.10.2026) — z. B. „Wasser am Montag
// abgestellt“. Server-Komponente; „gelesen und bestätigt“ über ZustellungBestaetigen.
import { Megaphone } from "lucide-react";
import { datum } from "@/lib/format";
import type { PortalMitteilung } from "@/lib/portalDaten";
import ZustellungBestaetigen from "@/components/ZustellungBestaetigen";

export default function MitteilungenListe({ mitteilungen, nurLesen = false }: { mitteilungen: PortalMitteilung[]; nurLesen?: boolean }) {
  if (mitteilungen.length === 0) return null;
  return (
    <div className="section">
      <div className="section-header"><h3><Megaphone size={15} style={{ verticalAlign: "-2px" }} /> Mitteilungen deines Vermieters</h3></div>
      <div className="section-body" style={{ display: "grid", gap: 12 }}>
        {mitteilungen.map((m) => (
          <div key={m.id} style={{ borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
              <strong style={{ fontSize: 13 }}>{m.titel}</strong>
              <span style={{ fontSize: 11.5, color: "var(--muted)", marginLeft: "auto" }}>{datum(m.zugestellt_am)}</span>
            </div>
            <p style={{ fontSize: 12.5, margin: "4px 0 0", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.nachricht}</p>
            {m.bestaetigung_noetig && (
              <div style={{ marginTop: 6 }}>
                {m.bestaetigt_am
                  ? <span className="badge badge-green">bestätigt {datum(m.bestaetigt_am)}</span>
                  : <ZustellungBestaetigen zustellungId={m.id} nurLesen={nurLesen} />}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
