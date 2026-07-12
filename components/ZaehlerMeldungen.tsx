"use client";

// Vermieter-Seite: eingegangene Zählerstand-Meldungen aus dem Mieterportal.
// "Übernehmen" bucht ab der zweiten Meldung desselben Zählers die Differenz
// automatisch als Verbrauch.
import { useState, useTransition } from "react";
import { Gauge, Paperclip, Check } from "lucide-react";
import { uebernehmeZaehlerstand } from "@/lib/actions/zaehler";

export type ZaehlerMeldungVermieter = {
  id: string;
  art: string;
  zaehlernummer: string | null;
  stand: number;
  einheit: string;
  ablesedatum: string;
  notiz: string | null;
  foto_name: string | null;
  uebernommen_am: string | null;
  mieterName: string;
  objektName: string;
};

export default function ZaehlerMeldungen({ rows }: { rows: ZaehlerMeldungVermieter[] }) {
  const [pending, startTransition] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);

  if (rows.length === 0) return null;
  const offene = rows.filter((r) => !r.uebernommen_am);

  const uebernehmen = (id: string) =>
    startTransition(async () => {
      setFehler(null);
      setHinweis(null);
      const r = await uebernehmeZaehlerstand(id);
      if (r?.error) setFehler(r.error);
      else if (!r.verbrauchGebucht)
        setHinweis("Zählerstand gespeichert — der Verbrauch wird ab der zweiten Meldung desselben Zählers automatisch als Differenz gebucht.");
    });

  return (
    <div className="section mb-20">
      <div className="section-header">
        <h3><Gauge size={15} style={{ verticalAlign: "-2px" }} /> Zählerstand-Meldungen aus dem Mieterportal</h3>
        {offene.length > 0 && <span className="badge badge-amber">{offene.length} neu</span>}
      </div>
      <div className="section-body">
        {fehler && <p style={{ fontSize: 12, color: "var(--red)", marginBottom: 8 }}>{fehler}</p>}
        {hinweis && <p style={{ fontSize: 12, color: "var(--blue)", marginBottom: 8 }}>{hinweis}</p>}
        {rows.map((m) => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>{m.art}</span>
            {m.zaehlernummer && <span style={{ fontSize: 11, color: "var(--muted)" }}>Nr. {m.zaehlernummer}</span>}
            <span>{m.stand.toLocaleString("de-DE")} {m.einheit}</span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{new Date(m.ablesedatum).toLocaleDateString("de-DE")}</span>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{m.mieterName} · {m.objektName}</span>
            {m.foto_name && (
              <a href={`/api/zaehler-foto/${m.id}`} target="_blank" rel="noopener noreferrer" className="badge badge-neutral" style={{ textDecoration: "none" }}>
                <Paperclip size={11} style={{ verticalAlign: "-1px" }} /> Foto
              </a>
            )}
            <span style={{ marginLeft: "auto" }}>
              {m.uebernommen_am ? (
                <span className="badge badge-green"><Check size={11} style={{ verticalAlign: "-1px" }} /> Übernommen</span>
              ) : (
                <button type="button" className="btn btn-gold" style={{ fontSize: 11, padding: "5px 12px" }} disabled={pending} onClick={() => uebernehmen(m.id)}>
                  {pending ? "…" : "Übernehmen"}
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
