"use client";

// Vermieter: Service-Partner einladen (SV-Code), Aufträge vergeben und
// den Bearbeitungsstand sehen — Tab "Service" im Mieterportal.
import { useState, useTransition } from "react";
import {
  Wrench, Copy, Check, KeyRound, XCircle, UserRound, Trash2,
} from "lucide-react";
import {
  erzeugeServiceCode, widerrufeServiceCode, entferneServicePartner,
  erstelleAuftrag, loescheAuftrag,
} from "@/lib/actions/service";
import DeleteButton from "@/components/DeleteButton";
import { datum } from "@/lib/format";

export type ServicePartnerRow = { user_id: string; firma: string | null; email: string | null; created_at: string };
export type ServiceCodeRow = { code: string; gueltig_bis: string };
export type AuftragRow = {
  id: string; titel: string; beschreibung: string | null; termin: string | null;
  status: string; antwort: string | null; created_at: string;
  objekt_name: string | null; partnerName: string;
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  offen: { label: "Offen", cls: "badge-amber" },
  angenommen: { label: "Angenommen", cls: "badge-blue" },
  erledigt: { label: "Erledigt", cls: "badge-green" },
  abgelehnt: { label: "Abgelehnt", cls: "badge-red" },
};

function CodeSektion({ codes }: { codes: ServiceCodeRow[] }) {
  const [neuer, setNeuer] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const erzeugen = () =>
    startTransition(async () => {
      const r = await erzeugeServiceCode();
      if (r.code) setNeuer(r.code);
    });

  const alle = neuer && !codes.some((c) => c.code === neuer) ? [{ code: neuer, gueltig_bis: "" }, ...codes] : codes;

  return (
    <div className="section">
      <div className="section-header">
        <h3><KeyRound size={15} style={{ verticalAlign: "-2px" }} /> Service-Einladungscodes</h3>
        <button type="button" className="btn btn-gold" style={{ fontSize: 12 }} disabled={pending} onClick={erzeugen}>
          {pending ? "…" : "Neuen Code erzeugen"}
        </button>
      </div>
      <div className="section-body">
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: alle.length ? 10 : 0 }}>
          Gib den Code an deinen Handwerker/Hausmeister — er registriert sich damit unter
          „Service / Hausmeister" und ist dann mit dir verknüpft. Jeder Code gilt einmalig, 14 Tage.
        </p>
        {alle.map((c) => (
          <div key={c.code} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
            <code style={{ fontWeight: 700, letterSpacing: "0.06em" }}>{c.code}</code>
            {c.gueltig_bis && <span style={{ fontSize: 11, color: "var(--muted)" }}>gültig bis {datum(c.gueltig_bis)}</span>}
            <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6 }}>
              <button
                type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}
                onClick={async () => { await navigator.clipboard.writeText(c.code); setKopiert(c.code); setTimeout(() => setKopiert(null), 1600); }}
              >
                {kopiert === c.code ? <><Check size={12} style={{ verticalAlign: "-2px" }} /> Kopiert</> : <><Copy size={12} style={{ verticalAlign: "-2px" }} /> Kopieren</>}
              </button>
              <DeleteButton action={async () => { await widerrufeServiceCode(c.code); }} className="delete-btn" label={<XCircle size={14} />} confirmText="Diesen Code widerrufen?" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ServiceManager({
  partner, codes, auftraege, properties, initialTitel, initialText,
}: {
  partner: ServicePartnerRow[];
  codes: ServiceCodeRow[];
  auftraege: AuftragRow[];
  properties: { id: string; bezeichnung: string }[];
  initialTitel?: string;
  initialText?: string;
}) {
  const [fehler, setFehler] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  const senden = (fd: FormData) =>
    startTransition(async () => {
      setFehler(null); setOk(false);
      const r = await erstelleAuftrag(fd);
      if (r?.error) setFehler(r.error);
      else setOk(true);
    });

  return (
    <>
      <CodeSektion codes={codes} />

      <div className="section">
        <div className="section-header"><h3>Verknüpfte Service-Partner</h3></div>
        <div className="section-body">
          {partner.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--faint)" }}>
              Noch kein Partner verknüpft — erzeuge oben einen Code und gib ihn weiter.
            </p>
          ) : (
            partner.map((p) => (
              <div key={p.user_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                <Wrench size={14} color="var(--gold)" />
                <span style={{ fontWeight: 600 }}>{p.firma || p.email || "Service-Partner"}</span>
                {p.firma && p.email && <span style={{ fontSize: 11, color: "var(--muted)" }}>{p.email}</span>}
                <span style={{ fontSize: 11, color: "var(--faint)", marginLeft: "auto" }}>seit {datum(p.created_at)}</span>
                <DeleteButton action={async () => { await entferneServicePartner(p.user_id); }} className="delete-btn" label={<Trash2 size={13} />} confirmText="Verknüpfung zu diesem Partner lösen?" />
              </div>
            ))
          )}
        </div>
      </div>

      {partner.length > 0 && (
        <div className="section">
          <div className="section-header"><h3>Auftrag vergeben</h3></div>
          <div className="section-body">
            <form action={senden} style={{ display: "grid", gap: 10 }}>
              <div className="form-row">
                <div className="form-group">
                  <label>Service-Partner *</label>
                  <select name="serviceUserId" required defaultValue={partner.length === 1 ? partner[0].user_id : ""}>
                    {partner.length !== 1 && <option value="" disabled>– wählen –</option>}
                    {partner.map((p) => <option key={p.user_id} value={p.user_id}>{p.firma || p.email || "Partner"}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Objekt</label>
                  <select name="propId" defaultValue="">
                    <option value="">– optional –</option>
                    {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Betreff *</label>
                  <input name="titel" required maxLength={200} defaultValue={initialTitel ?? ""} placeholder="z. B. Wasserhahn Küche tropft" />
                </div>
                <div className="form-group">
                  <label>Wunschtermin</label>
                  <input type="date" name="termin" />
                </div>
              </div>
              <div className="form-row single">
                <div className="form-group">
                  <label>Beschreibung</label>
                  <textarea name="beschreibung" rows={3} maxLength={2000} defaultValue={initialText ?? ""} placeholder="Was ist zu tun? Zugang, Ansprechpartner, Details …" />
                </div>
              </div>
              {fehler && <p style={{ fontSize: 12, color: "var(--red)", margin: 0 }}>{fehler}</p>}
              {ok && <p style={{ fontSize: 12, color: "var(--green)", margin: 0 }}>Auftrag gesendet ✓</p>}
              <div><button type="submit" className="btn btn-gold" disabled={pending}>{pending ? "…" : "Auftrag senden"}</button></div>
            </form>
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-header">
          <h3>Aufträge</h3>
          {auftraege.filter((a) => a.status === "offen").length > 0 && (
            <span className="badge badge-amber">{auftraege.filter((a) => a.status === "offen").length} offen</span>
          )}
        </div>
        <div className="section-body">
          {auftraege.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--faint)" }}>Noch keine Aufträge vergeben.</p>
          ) : (
            auftraege.map((a) => {
              const s = STATUS_META[a.status] ?? STATUS_META.offen;
              return (
                <div key={a.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <UserRound size={14} color="var(--gold)" />
                    <span style={{ fontWeight: 600 }}>{a.titel}</span>
                    <span className={`badge ${s.cls}`}>{s.label}</span>
                    <span className="badge badge-neutral">{a.partnerName}</span>
                    {a.objekt_name && <span style={{ fontSize: 11, color: "var(--muted)" }}>{a.objekt_name}</span>}
                    {a.termin && <span style={{ fontSize: 11, color: "var(--muted)" }}>Termin {datum(a.termin)}</span>}
                    <span style={{ fontSize: 11, color: "var(--faint)", marginLeft: "auto" }}>{datum(a.created_at)}</span>
                    <DeleteButton action={async () => { await loescheAuftrag(a.id); }} className="delete-btn" label={<Trash2 size={13} />} confirmText="Auftrag löschen?" />
                  </div>
                  {a.beschreibung && <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, whiteSpace: "pre-wrap" }}>{a.beschreibung}</p>}
                  {a.antwort && (
                    <p style={{ fontSize: 12, marginTop: 6, padding: "6px 10px", background: "var(--gold-pale)", borderLeft: "3px solid var(--gold)", borderRadius: 6 }}>
                      <strong>Rückmeldung:</strong> {a.antwort}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
