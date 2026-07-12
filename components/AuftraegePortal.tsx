"use client";

// Service-Portal: erhaltene Aufträge annehmen, erledigen oder ablehnen
// (mit optionaler Rückmeldung an den Vermieter).
import { useState, useTransition } from "react";
import { Wrench, CalendarDays } from "lucide-react";
import { beantworteAuftrag } from "@/lib/actions/service";
import { datum } from "@/lib/format";

export type PortalAuftragRow = {
  id: string; titel: string; beschreibung: string | null; termin: string | null;
  status: string; antwort: string | null; created_at: string;
  objekt_name: string | null; vermieter_name: string | null;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  offen: { label: "Offen", cls: "badge-amber" },
  angenommen: { label: "Angenommen", cls: "badge-blue" },
  erledigt: { label: "Erledigt", cls: "badge-green" },
  abgelehnt: { label: "Abgelehnt", cls: "badge-red" },
};

function Eintrag({ a }: { a: PortalAuftragRow }) {
  const [aktion, setAktion] = useState<null | "angenommen" | "erledigt" | "abgelehnt">(null);
  const [text, setText] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const s = STATUS_META[a.status] ?? STATUS_META.offen;

  const senden = (status: "angenommen" | "erledigt" | "abgelehnt") =>
    startTransition(async () => {
      setFehler(null);
      const fd = new FormData();
      fd.set("id", a.id);
      fd.set("status", status);
      fd.set("antwort", text);
      const r = await beantworteAuftrag(fd);
      if (r?.error) setFehler(r.error);
      else { setAktion(null); setText(""); }
    });

  return (
    <div style={{ padding: "12px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Wrench size={14} color="var(--gold)" />
        <span style={{ fontWeight: 600 }}>{a.titel}</span>
        <span className={`badge ${s.cls}`}>{s.label}</span>
        {a.vermieter_name && <span className="badge badge-neutral">{a.vermieter_name}</span>}
        {a.termin && (
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            <CalendarDays size={11} style={{ verticalAlign: "-1px" }} /> Wunschtermin {datum(a.termin)}
          </span>
        )}
        <span style={{ fontSize: 11, color: "var(--faint)", marginLeft: "auto" }}>{datum(a.created_at)}</span>
      </div>
      {a.objekt_name && <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Objekt: {a.objekt_name}</p>}
      {a.beschreibung && <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, whiteSpace: "pre-wrap" }}>{a.beschreibung}</p>}
      {a.antwort && (
        <p style={{ fontSize: 12, marginTop: 6, padding: "6px 10px", background: "var(--gold-pale)", borderLeft: "3px solid var(--gold)", borderRadius: 6 }}>
          <strong>Deine Rückmeldung:</strong> {a.antwort}
        </p>
      )}
      {a.status !== "erledigt" && a.status !== "abgelehnt" && (
        <div style={{ marginTop: 8 }}>
          {aktion ? (
            <div style={{ display: "grid", gap: 8, padding: 12, background: "var(--bg3)", borderRadius: 10, border: "1px solid var(--line)" }}>
              <textarea
                rows={2} maxLength={1000} className="input" value={text} onChange={(e) => setText(e.target.value)}
                placeholder={aktion === "abgelehnt" ? "Kurze Begründung (empfohlen)" : "Rückmeldung an den Vermieter (optional, z. B. Termin oder Materialbedarf)"}
              />
              {fehler && <p style={{ fontSize: 12, color: "var(--red)" }}>{fehler}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn-gold" disabled={pending} onClick={() => senden(aktion)}>
                  {pending ? "…" : aktion === "angenommen" ? "Annahme senden" : aktion === "erledigt" ? "Als erledigt melden" : "Ablehnung senden"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setAktion(null)}>Abbrechen</button>
              </div>
            </div>
          ) : (
            <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
              {a.status === "offen" && (
                <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 12px", color: "var(--blue)" }} onClick={() => setAktion("angenommen")}>
                  Annehmen
                </button>
              )}
              <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 12px", color: "var(--green)" }} onClick={() => setAktion("erledigt")}>
                Erledigt melden
              </button>
              {a.status === "offen" && (
                <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 12px", color: "var(--red)" }} onClick={() => setAktion("abgelehnt")}>
                  Ablehnen
                </button>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function AuftraegePortal({ auftraege }: { auftraege: PortalAuftragRow[] }) {
  const offene = auftraege.filter((a) => a.status === "offen" || a.status === "angenommen");
  const erledigte = auftraege.filter((a) => a.status === "erledigt" || a.status === "abgelehnt");
  return (
    <>
      <div className="section">
        <div className="section-header">
          <h3>Aktuelle Aufträge</h3>
          {offene.length > 0 && <span className="badge badge-amber">{offene.length}</span>}
        </div>
        <div className="section-body">
          {offene.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--faint)" }}>
              Keine offenen Aufträge — sobald ein Vermieter dir etwas zuweist, erscheint es hier.
            </p>
          ) : (
            offene.map((a) => <Eintrag key={a.id} a={a} />)
          )}
        </div>
      </div>
      {erledigte.length > 0 && (
        <div className="section">
          <div className="section-header"><h3>Abgeschlossen</h3></div>
          <div className="section-body">
            {erledigte.map((a) => <Eintrag key={a.id} a={a} />)}
          </div>
        </div>
      )}
    </>
  );
}
