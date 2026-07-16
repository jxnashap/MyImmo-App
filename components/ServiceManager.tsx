"use client";

// Vermieter: Service-Partner einladen (SV-Code), Aufträge vergeben und
// den Bearbeitungsstand sehen — Tab "Service" im Mieterportal.
import { useState, useTransition } from "react";
import {
  Wrench, Copy, Check, KeyRound, XCircle, UserRound, Trash2,
  Building2, Phone, Mail, Globe, ShieldCheck,
} from "lucide-react";
import {
  erzeugeServiceCode, widerrufeServiceCode, entferneServicePartner,
  erstelleAuftrag, loescheAuftrag, entscheideAuftrag, uebernimmAuftragAlsKosten,
} from "@/lib/actions/service";
import { erstelleFirma, loescheFirma } from "@/lib/actions/firmen";
import { GEWERKE } from "@/lib/gewerke";
import DeleteButton from "@/components/DeleteButton";
import { datum } from "@/lib/format";

export type ServicePartnerRow = { user_id: string; firma: string | null; email: string | null; created_at: string };
export type ServiceCodeRow = { code: string; gueltig_bis: string };
export type FirmaRow = {
  id: string; name: string; gewerk: string | null; telefon: string | null;
  email: string | null; website: string | null; notiz: string | null;
};
export type AuftragRow = {
  id: string; titel: string; beschreibung: string | null; termin: string | null;
  status: string; antwort: string | null; created_at: string;
  objekt_name: string | null; partnerName: string;
  erstellt_von: string; firmaName: string | null;
  mieterName: string | null; public_token: string;
  betrag: number | null; lohnanteil: number | null;
  rechnung_name: string | null; kosten_id: string | null;
};
export type MieterOption = { id: string; name: string };

const STATUS_META: Record<string, { label: string; cls: string }> = {
  freigabe: { label: "Freigabe angefragt", cls: "badge-amber" },
  offen: { label: "Offen", cls: "badge-amber" },
  angenommen: { label: "Angenommen", cls: "badge-blue" },
  erledigt: { label: "Erledigt", cls: "badge-green" },
  abgelehnt: { label: "Abgelehnt", cls: "badge-red" },
  nicht_freigegeben: { label: "Nicht freigegeben", cls: "badge-red" },
};

const eur = (n: number) =>
  new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " €";

// Erledigter Auftrag mit Betrag → per Klick als Kosten-Buchung übernehmen
// (Rechnung wandert als Beleg mit; Lohnanteil landet in der Notiz für § 35a).
function KostenUebernahme({ a }: { a: AuftragRow }) {
  const [pending, startTransition] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);

  if (a.status !== "erledigt" || !(Number(a.betrag) > 0)) return null;
  if (a.kosten_id) {
    return (
      <p style={{ fontSize: 12, marginTop: 6 }}>
        <span className="badge badge-green"><Check size={11} style={{ verticalAlign: "-1px" }} /> Als Kosten erfasst ({eur(Number(a.betrag))})</span>
      </p>
    );
  }
  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          setFehler(null);
          const r = await uebernimmAuftragAlsKosten(fd);
          if (r?.error) setFehler(r.error);
        })
      }
      style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8, padding: "8px 10px", background: "var(--bg3)", borderRadius: 8, border: "1px solid var(--line)" }}
    >
      <input type="hidden" name="id" value={a.id} />
      <span style={{ fontSize: 12 }}>
        <strong>{eur(Number(a.betrag))}</strong>
        {Number(a.lohnanteil) > 0 && <span style={{ color: "var(--muted)" }}> · davon Lohn {eur(Number(a.lohnanteil))} (§ 35a)</span>}
        {a.rechnung_name && <span style={{ color: "var(--muted)" }}> · Rechnung: {a.rechnung_name}</span>}
      </span>
      <select name="kategorie" className="input" defaultValue="Reparatur" style={{ fontSize: 12, padding: "4px 8px", width: "auto" }}>
        {["Reparatur", "Instandhaltung", "Modernisierung", "Verwaltung", "Sonstiges"].map((k) => <option key={k}>{k}</option>)}
      </select>
      <button type="submit" className="btn btn-gold" disabled={pending} style={{ fontSize: 12 }}>
        {pending ? "…" : "Als Kosten übernehmen"}
      </button>
      {fehler && <span style={{ fontSize: 12, color: "var(--red)" }}>{fehler}</span>}
    </form>
  );
}

function CodeSektion({ codes }: { codes: ServiceCodeRow[] }) {
  const [neuer, setNeuer] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const erzeugen = () =>
    startTransition(async () => {
      setFehler(null);
      const r = await erzeugeServiceCode();
      if (r.code) setNeuer(r.code);
      else setFehler(r.error ?? "Code konnte nicht erstellt werden.");
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
        {fehler && <p style={{ fontSize: 12, color: "var(--red)" }}>{fehler}</p>}
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

function FirmenSektion({ firmen }: { firmen: FirmaRow[] }) {
  const [offen, setOffen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const speichern = (fd: FormData) =>
    startTransition(async () => {
      setFehler(null);
      const r = await erstelleFirma(fd);
      if (r?.error) setFehler(r.error);
      else setOffen(false);
    });

  return (
    <div className="section">
      <div className="section-header">
        <h3><Building2 size={15} style={{ verticalAlign: "-2px" }} /> Firmenverzeichnis</h3>
        <button type="button" className="btn btn-gold" style={{ fontSize: 12 }} onClick={() => setOffen(!offen)}>
          {offen ? "Abbrechen" : "Firma hinzufügen"}
        </button>
      </div>
      <div className="section-body">
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
          Handwerksbetriebe & Grundstücks-Dienste mit Kontaktdaten — dein Hausmeister sieht
          das Verzeichnis im Service-Portal und ruft nach deiner Freigabe direkt an.
        </p>
        {offen && (
          <form action={speichern} style={{ display: "grid", gap: 10, padding: 14, background: "var(--bg3)", borderRadius: 10, border: "1px solid var(--line)", marginBottom: 12 }}>
            <div className="form-row">
              <div className="form-group"><label>Firma *</label><input name="name" required maxLength={200} placeholder="z. B. Sanitär Müller GmbH" /></div>
              <div className="form-group"><label>Gewerk</label>
                <select name="gewerk" defaultValue="">
                  <option value="">– wählen –</option>
                  {GEWERKE.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Telefon</label><input name="telefon" maxLength={50} placeholder="040 1234567" /></div>
              <div className="form-group"><label>E-Mail</label><input type="email" name="email" maxLength={200} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Website</label><input name="website" maxLength={300} placeholder="www.beispiel.de" /></div>
              <div className="form-group"><label>Notiz</label><input name="notiz" maxLength={500} placeholder="z. B. Notdienst 24 h, Ansprechpartner Herr Kurt" /></div>
            </div>
            {fehler && <p style={{ fontSize: 12, color: "var(--red)", margin: 0 }}>{fehler}</p>}
            <div><button type="submit" className="btn btn-gold" disabled={pending}>{pending ? "…" : "Speichern"}</button></div>
          </form>
        )}
        {firmen.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--faint)" }}>
            Noch keine Firmen hinterlegt — z. B. Sanitär, Heizung, Elektro, Schlüsseldienst,
            Gartenpflege oder Winterdienst.
          </p>
        ) : (
          firmen.map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
              <Building2 size={14} color="var(--gold)" />
              <span style={{ fontWeight: 600 }}>{f.name}</span>
              {f.gewerk && <span className="badge badge-teal">{f.gewerk}</span>}
              {f.telefon && <a href={`tel:${f.telefon.replace(/\s/g, "")}`} style={{ fontSize: 12, color: "var(--gold)", textDecoration: "none" }}><Phone size={11} style={{ verticalAlign: "-1px" }} /> {f.telefon}</a>}
              {f.email && <a href={`mailto:${f.email}`} style={{ fontSize: 12, color: "var(--gold)", textDecoration: "none" }}><Mail size={11} style={{ verticalAlign: "-1px" }} /> {f.email}</a>}
              {f.website && <a href={f.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--gold)", textDecoration: "none" }}><Globe size={11} style={{ verticalAlign: "-1px" }} /> Website</a>}
              {f.notiz && <span style={{ fontSize: 11, color: "var(--muted)" }}>{f.notiz}</span>}
              <span style={{ marginLeft: "auto" }}>
                <DeleteButton action={async () => { await loescheFirma(f.id); }} className="delete-btn" label={<Trash2 size={13} />} confirmText="Firma aus dem Verzeichnis löschen?" />
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FreigabeButtons({ id, mieterListe }: { id: string; mieterListe: MieterOption[] }) {
  const [pending, startTransition] = useTransition();
  const [mieterId, setMieterId] = useState("");
  const entscheiden = (freigeben: boolean) =>
    startTransition(async () => { await entscheideAuftrag(id, freigeben, mieterId || undefined); });
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      {mieterListe.length > 0 && (
        <select className="input" style={{ width: "auto", fontSize: 12, padding: "5px 10px" }} value={mieterId} onChange={(e) => setMieterId(e.target.value)}>
          <option value="">Mieter-Kontakt teilen? (optional)</option>
          {mieterListe.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      )}
      <button type="button" className="btn btn-gold" style={{ fontSize: 11, padding: "5px 12px" }} disabled={pending} onClick={() => entscheiden(true)}>
        <ShieldCheck size={12} style={{ verticalAlign: "-2px" }} /> Freigeben
      </button>
      <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 12px", color: "var(--red)" }} disabled={pending} onClick={() => entscheiden(false)}>
        Ablehnen
      </button>
    </div>
  );
}

function LinkKopierButton({ token }: { token: string }) {
  const [kopiert, setKopiert] = useState(false);
  return (
    <button
      type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}
      title="Öffentlicher Link mit Auftragsdetails + Mieter-Kontakt (zur Weitergabe an die Firma)"
      onClick={async () => {
        await navigator.clipboard.writeText(`${window.location.origin}/auftrag/${token}`);
        setKopiert(true); setTimeout(() => setKopiert(false), 1600);
      }}
    >
      {kopiert ? <><Check size={12} style={{ verticalAlign: "-2px" }} /> Kopiert</> : <><Copy size={12} style={{ verticalAlign: "-2px" }} /> Firmen-Link</>}
    </button>
  );
}

export default function ServiceManager({
  partner, codes, auftraege, properties, firmen, mieterListe, initialTitel, initialText,
}: {
  partner: ServicePartnerRow[];
  codes: ServiceCodeRow[];
  auftraege: AuftragRow[];
  properties: { id: string; bezeichnung: string }[];
  firmen: FirmaRow[];
  mieterListe: MieterOption[];
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

      <FirmenSektion firmen={firmen} />

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
              <div className="form-row single">
                <div className="form-group">
                  <label>Mieter-Kontakt für Terminabsprache teilen (optional)</label>
                  <select name="mieterId" defaultValue="">
                    <option value="">– nicht teilen –</option>
                    {mieterListe.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <span style={{ fontSize: 11, color: "var(--faint)" }}>
                    Wenn gewählt, enthält der Firmen-Link Name & Telefonnummer des Mieters
                    mit der Bitte um direkte Terminabsprache.
                  </span>
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
                    {a.erstellt_von === "service" && <span className="badge badge-blue">vom Hausmeister beantragt</span>}
                    {a.firmaName && <span className="badge badge-teal">{a.firmaName}</span>}
                    {a.mieterName && <span className="badge badge-green" title="Mieter-Kontakt wird über den Firmen-Link geteilt">Kontakt: {a.mieterName}</span>}
                    {a.mieterName && (a.status === "offen" || a.status === "angenommen") && <LinkKopierButton token={a.public_token} />}
                    {a.objekt_name && <span style={{ fontSize: 11, color: "var(--muted)" }}>{a.objekt_name}</span>}
                    {a.termin && <span style={{ fontSize: 11, color: "var(--muted)" }}>Termin {datum(a.termin)}</span>}
                    <span style={{ fontSize: 11, color: "var(--faint)", marginLeft: "auto" }}>{datum(a.created_at)}</span>
                    <DeleteButton action={async () => { await loescheAuftrag(a.id); }} className="delete-btn" label={<Trash2 size={13} />} confirmText="Auftrag löschen?" />
                  </div>
                  {a.beschreibung && <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, whiteSpace: "pre-wrap" }}>{a.beschreibung}</p>}
                  {a.status === "freigabe" && (
                    <div style={{ marginTop: 8 }}>
                      <FreigabeButtons id={a.id} mieterListe={mieterListe} />
                    </div>
                  )}
                  {a.antwort && (
                    <p style={{ fontSize: 12, marginTop: 6, padding: "6px 10px", background: "var(--gold-pale)", borderLeft: "3px solid var(--gold)", borderRadius: 6 }}>
                      <strong>Rückmeldung:</strong> {a.antwort}
                    </p>
                  )}
                  <KostenUebernahme a={a} />
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
