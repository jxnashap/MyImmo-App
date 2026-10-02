// Gebäude-Infos im Mieterportal (02.10.2026): was der Vermieter zum Haus hinterlegt hat —
// Hausmeister, Notdienste, Müll, Hausordnung. Server-Komponente, nur Anzeige.
import { Building2 } from "lucide-react";
import { datum } from "@/lib/format";
import type { GebaeudeInfo } from "@/lib/portalDaten";

const FELDER: [keyof GebaeudeInfo, string][] = [
  ["hausmeister", "Hausmeister / Ansprechpartner"],
  ["notdienst", "Notdienste"],
  ["muell", "Müll & Entsorgung"],
  ["hausordnung", "Hausordnung"],
  ["sonstiges", "Sonstiges"],
];

export default function HausInfosKarte({ info, titel }: { info: GebaeudeInfo | undefined; titel: string }) {
  const gefuellt = info ? FELDER.filter(([k]) => (info[k] ?? "").toString().trim()) : [];
  if (!info || gefuellt.length === 0) return null;
  return (
    <div className="section">
      <div className="section-header">
        <h3><Building2 size={15} style={{ verticalAlign: "-2px" }} /> Haus-Infos{titel ? ` · ${titel}` : ""}</h3>
        <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Stand {datum(info.updated_at)}</span>
      </div>
      <div className="section-body" style={{ display: "grid", gap: 10 }}>
        {gefuellt.map(([k, label]) => (
          <div key={k}>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 12.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{String(info[k])}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
