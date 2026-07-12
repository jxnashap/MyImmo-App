"use client";

// Service-Portal: erhaltene Aufträge annehmen, erledigen oder ablehnen
// (mit optionaler Rückmeldung an den Vermieter).
import { useState, useTransition } from "react";
import { Wrench, CalendarDays, Building2, Phone, Mail, Globe, SendHorizonal } from "lucide-react";
import { beantworteAuftrag, beantrageAuftrag } from "@/lib/actions/service";
import { datum } from "@/lib/format";

export type PortalAuftragRow = {
  id: string; titel: string; beschreibung: string | null; termin: string | null;
  status: string; antwort: string | null; created_at: string;
  objekt_name: string | null; vermieter_name: string | null;
  erstellt_von?: string | null; firma_id?: string | null;
};
export type PortalFirmaRow = {
  id: string; name: string; gewerk: string | null; telefon: string | null;
  email: string | null; website: string | null; notiz: string | null;
};
export type AuftraggeberRow = { vermieter_id: string; label: string };

const STATUS_META: Record<string, { label: string; cls: string }> = {
  freigabe: { label: "Wartet auf Freigabe", cls: "badge-amber" },
  offen: { label: "Offen", cls: "badge-amber" },
  angenommen: { label: "Angenommen", cls: "badge-blue" },
  erledigt: { label: "Erledigt", cls: "badge-green" },
  abgelehnt: { label: "Abgelehnt", cls: "badge-red" },
  nicht_freigegeben: { label: "Nicht freigegeben", cls: "badge-red" },
};

function FirmaKontakt({ f }: { f: PortalFirmaRow }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <span className="badge badge-teal">{f.name}</span>
      {f.telefon && <a href={`tel:${f.telefon.replace(/\s/g, "")}`} style={{ fontSize: 12, color: "var(--gold)", textDecoration: "none" }}><Phone size={11} style={{ verticalAlign: "-1px" }} /> {f.telefon}</a>}
      {f.email && <a href={`mailto:${f.email}`} style={{ fontSize: 12, color: "var(--gold)", textDecoration: "none" }}><Mail size={11} style={{ verticalAlign: "-1px" }} /> {f.email}</a>}
      {f.website && <a href={f.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--gold)", textDecoration: "none" }}><Globe size={11} style={{ verticalAlign: "-1px" }} /> Website</a>}
    </span>
  );
}

function Eintrag({ a, firmen }: { a: PortalAuftragRow; firmen: PortalFirmaRow[] }) {
  const firma = a.firma_id ? firmen.find((f) => f.id === a.firma_id) ?? null : null;
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
      {firma && (
        <div style={{ marginTop: 6 }}>
          <FirmaKontakt f={firma} />
        </div>
      )}
      {(a.status === "offen" || a.status === "angenommen") && a.erstellt_von === "service" && firma && (
        <p style={{ fontSize: 12, marginTop: 6, padding: "6px 10px", background: "var(--green-dim)", color: "var(--green)", borderRadius: 6 }}>
          Vom Vermieter freigegeben — jetzt die Firma anrufen, das Problem erklären
          und den Termin direkt mit dem Mieter abstimmen.
        </p>
      )}
      {a.antwort && (
        <p style={{ fontSize: 12, marginTop: 6, padding: "6px 10px", background: "var(--gold-pale)", borderLeft: "3px solid var(--gold)", borderRadius: 6 }}>
          <strong>Deine Rückmeldung:</strong> {a.antwort}
        </p>
      )}
      {(a.status === "offen" || a.status === "angenommen") && (
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

function AntragForm({ auftraggeber, firmen }: { auftraggeber: AuftraggeberRow[]; firmen: PortalFirmaRow[] }) {
  const [offen, setOffen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  const senden = (fd: FormData) =>
    startTransition(async () => {
      setFehler(null); setOk(false);
      const r = await beantrageAuftrag(fd);
      if (r?.error) setFehler(r.error);
      else { setOk(true); setOffen(false); }
    });

  return (
    <div className="section">
      <div className="section-header">
        <h3><SendHorizonal size={15} style={{ verticalAlign: "-2px" }} /> Auftrag beantragen</h3>
        <button type="button" className="btn btn-gold" style={{ fontSize: 12 }} onClick={() => { setOffen(!offen); setOk(false); }}>
          {offen ? "Abbrechen" : "Neuer Antrag"}
        </button>
      </div>
      <div className="section-body">
        <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
          Du hast etwas entdeckt, das gemacht werden muss? Beschreibe es hier — der Vermieter
          bekommt die Anfrage in seinem Portal und gibt den Auftrag frei. Danach rufst du die
          passende Firma an und stimmst den Termin direkt mit dem Mieter ab.
        </p>
        {ok && <p style={{ fontSize: 12, color: "var(--green)", marginTop: 8 }}>Antrag gesendet — wartet auf Freigabe des Vermieters ✓</p>}
        {offen && (
          <form action={senden} style={{ display: "grid", gap: 10, marginTop: 12, padding: 14, background: "var(--bg3)", borderRadius: 10, border: "1px solid var(--line)" }}>
            {auftraggeber.length === 1 ? (
              <input type="hidden" name="vermieterId" value={auftraggeber[0].vermieter_id} />
            ) : (
              <div className="form-group">
                <label>Auftraggeber *</label>
                <select name="vermieterId" required defaultValue="">
                  <option value="" disabled>– wählen –</option>
                  {auftraggeber.map((v) => <option key={v.vermieter_id} value={v.vermieter_id}>{v.label}</option>)}
                </select>
              </div>
            )}
            <div className="form-row">
              <div className="form-group"><label>Was muss gemacht werden? *</label><input name="titel" required maxLength={200} placeholder="z. B. Dachrinne verstopft, Haus Lindenstraße" /></div>
              <div className="form-group"><label>Objekt / Wohnung</label><input name="objekt" maxLength={200} placeholder="z. B. Lindenstraße 12, EG links" /></div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Vorgeschlagene Firma</label>
                <select name="firmaId" defaultValue="">
                  <option value="">– optional –</option>
                  {firmen.map((f) => <option key={f.id} value={f.id}>{f.name}{f.gewerk ? ` (${f.gewerk})` : ""}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Wunschtermin</label><input type="date" name="termin" /></div>
            </div>
            <div className="form-row single">
              <div className="form-group"><label>Beschreibung</label><textarea name="beschreibung" rows={3} maxLength={2000} placeholder="Problem, Dringlichkeit, betroffener Mieter …" /></div>
            </div>
            {fehler && <p style={{ fontSize: 12, color: "var(--red)", margin: 0 }}>{fehler}</p>}
            <div><button type="submit" className="btn btn-gold" disabled={pending}>{pending ? "…" : "Antrag an den Vermieter senden"}</button></div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function AuftraegePortal({
  auftraege, firmen, auftraggeber,
}: {
  auftraege: PortalAuftragRow[];
  firmen: PortalFirmaRow[];
  auftraggeber: AuftraggeberRow[];
}) {
  const offene = auftraege.filter((a) => ["offen", "angenommen", "freigabe"].includes(a.status));
  const erledigte = auftraege.filter((a) => ["erledigt", "abgelehnt", "nicht_freigegeben"].includes(a.status));
  return (
    <>
      <AntragForm auftraggeber={auftraggeber} firmen={firmen} />

      <div className="section">
        <div className="section-header">
          <h3>Aktuelle Aufträge</h3>
          {offene.length > 0 && <span className="badge badge-amber">{offene.length}</span>}
        </div>
        <div className="section-body">
          {offene.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--faint)" }}>
              Keine offenen Aufträge — sobald ein Vermieter dir etwas zuweist oder deinen
              Antrag freigibt, erscheint es hier.
            </p>
          ) : (
            offene.map((a) => <Eintrag key={a.id} a={a} firmen={firmen} />)
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-header"><h3><Building2 size={15} style={{ verticalAlign: "-2px" }} /> Firmenverzeichnis des Vermieters</h3></div>
        <div className="section-body">
          {firmen.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--faint)" }}>
              Noch keine Firmen hinterlegt — der Vermieter pflegt das Verzeichnis in seinem Portal.
            </p>
          ) : (
            firmen.map((f) => (
              <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{f.name}</span>
                {f.gewerk && <span className="badge badge-teal">{f.gewerk}</span>}
                {f.telefon && <a href={`tel:${f.telefon.replace(/\s/g, "")}`} style={{ fontSize: 12, color: "var(--gold)", textDecoration: "none" }}><Phone size={11} style={{ verticalAlign: "-1px" }} /> {f.telefon}</a>}
                {f.email && <a href={`mailto:${f.email}`} style={{ fontSize: 12, color: "var(--gold)", textDecoration: "none" }}><Mail size={11} style={{ verticalAlign: "-1px" }} /> {f.email}</a>}
                {f.website && <a href={f.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--gold)", textDecoration: "none" }}><Globe size={11} style={{ verticalAlign: "-1px" }} /> Website</a>}
                {f.notiz && <span style={{ fontSize: 11, color: "var(--muted)" }}>{f.notiz}</span>}
              </div>
            ))
          )}
        </div>
      </div>

      {erledigte.length > 0 && (
        <div className="section">
          <div className="section-header"><h3>Abgeschlossen</h3></div>
          <div className="section-body">
            {erledigte.map((a) => <Eintrag key={a.id} a={a} firmen={firmen} />)}
          </div>
        </div>
      )}
    </>
  );
}
