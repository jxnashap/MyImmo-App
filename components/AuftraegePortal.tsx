"use client";

// Service-Portal: erhaltene Aufträge annehmen, erledigen oder ablehnen
// (mit optionaler Rückmeldung an den Vermieter).
import { useEffect, useState, useTransition } from "react";
import { Wrench, CalendarDays, Building2, Phone, Mail, Globe, SendHorizonal, Check, Link2 } from "lucide-react";
import { beantworteAuftrag, beantrageAuftrag, meldeFachbetriebNoetig } from "@/lib/actions/service";
import { datum } from "@/lib/format";
import { teilbarerLink } from "@/lib/appUrl";
import { fachbetriebPflicht } from "@/lib/fachbetriebPflicht";
import type { AuftragNotiz } from "@/lib/auftragNotizen";
import AuftragVerlauf from "@/components/AuftragVerlauf";

export type PortalAuftragRow = {
  id: string; titel: string; beschreibung: string | null; termin: string | null;
  status: string; antwort: string | null; created_at: string;
  objekt_name: string | null; vermieter_name: string | null;
  erstellt_von?: string | null; firma_id?: string | null;
  mieter_id?: string | null; public_token?: string | null;
  vermieter_id?: string;
  /** Firma, die der Hausmeister mit „Fachbetrieb nötig“ vorgeschlagen hat. */
  vorgeschlagene_firma_id?: string | null;
  /** Verlauf: Notizen und Fotos (lib/auftragNotizen.ts). */
  notizen?: AuftragNotiz[];
};
export type PortalFirmaRow = {
  id: string; name: string; gewerk: string | null; telefon: string | null;
  email: string | null; website: string | null; notiz: string | null;
};
export type AuftraggeberRow = {
  vermieter_id: string;
  label: string;
  /** Nur als Hausmeister kann er Anträge stellen (Migration 20261005100000). */
  rolle?: "hausmeister" | "dienstleister";
};
/** Zugewiesenes Objekt (Sicht `service_objekte_portal`). */
export type PortalObjektRow = { id: string; bezeichnung: string; adresse: string | null; vermieter_id: string };

/** Hinweis statt Absenden — Vorschau beim Vermieter und Demo-Hausmeister. */
export const VORSCHAU_NICHT_GESENDET = "Nur Ansicht — in der Demo wird nichts gesendet.";

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

/** Firmen-Link (öffentliche Auftragsseite mit Mieter-Kontakt): kopieren
 *  oder direkt als vorbefüllte E-Mail an die Firma schicken. */
function FirmenLinkAktionen({
  token, titel, objekt, firma,
}: {
  token: string; titel: string; objekt: string | null; firma: PortalFirmaRow | null;
}) {
  const [kopiert, setKopiert] = useState(false);
  // Erst nach der Hydration bauen — sonst backt der Server einen relativen
  // (toten) Link in die mailto-URL. NICHT window.location.origin: wird der
  // Link auf einer Vorschau-/Fallback-Domain erzeugt, bekaeme der Handwerker
  // genau diese Adresse (siehe lib/appUrl.ts).
  const [link, setLink] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Link erst nach dem Mount bauen (teilbarerLink braucht den Browser)
  useEffect(() => { setLink(teilbarerLink(`/auftrag/${token}`)); }, [token]);
  const betreff = `Auftragsanfrage: ${titel}${objekt ? ` (${objekt})` : ""}`;
  const text =
    `Guten Tag,\n\nwir bitten um Ausführung des folgenden Auftrags:\n${titel}${objekt ? `\nObjekt: ${objekt}` : ""}\n\n` +
    `Alle Details sowie der Mieter-Kontakt für die Terminabsprache:\n${link}\n\n` +
    `Bitte stimmen Sie den Termin direkt mit der Mieterin / dem Mieter ab.\n\nMit freundlichen Grüßen`;
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
      <a
        href={`mailto:${encodeURIComponent(firma?.email ?? "")}?subject=${encodeURIComponent(betreff)}&body=${encodeURIComponent(text)}`}
        className="btn btn-outline" style={{ fontSize: 11, padding: "5px 12px", textDecoration: "none" }}
      >
        <Mail size={12} style={{ verticalAlign: "-2px" }} /> Per E-Mail an die Firma
      </a>
      <button
        type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 12px" }}
        onClick={async () => { await navigator.clipboard.writeText(link); setKopiert(true); setTimeout(() => setKopiert(false), 1600); }}
      >
        {kopiert ? <><Check size={12} style={{ verticalAlign: "-2px" }} /> Kopiert</> : <><Link2 size={12} style={{ verticalAlign: "-2px" }} /> Link kopieren</>}
      </button>
    </div>
  );
}

/** „Kann ich nicht selbst — Fachbetrieb nötig“: Firma VORSCHLAGEN, der Vermieter entscheidet. */
function FachbetriebForm({ a, firmen, vorschau, fertig }: { a: PortalAuftragRow; firmen: PortalFirmaRow[]; vorschau: boolean; fertig: () => void }) {
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const senden = (fd: FormData) =>
    startTransition(async () => {
      setFehler(null);
      if (vorschau) return;
      try {
        const r = await meldeFachbetriebNoetig(fd);
        if ("error" in r) setFehler(r.error);
        else fertig();
      } catch {
        setFehler("Konnte nicht gesendet werden.");
      }
    });
  return (
    <form action={senden} className="fachbetrieb-form">
      <input type="hidden" name="auftragId" value={a.id} />
      <div style={{ fontSize: 12, fontWeight: 600 }}>Fachbetrieb nötig — Vorschlag an den Vermieter</div>
      <textarea name="text" rows={2} maxLength={2000} required placeholder="Warum? z. B. Therme zeigt Störung F28, Gasgeruch, Leitung in der Wand" />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select name="firmaId" defaultValue="" style={{ flex: "1 1 200px" }}>
          <option value="">– Firma vorschlagen (optional) –</option>
          {firmen.map((f) => <option key={f.id} value={f.id}>{f.name}{f.gewerk ? ` (${f.gewerk})` : ""}</option>)}
        </select>
        <input name="kostenSchaetzung" inputMode="decimal" maxLength={20} placeholder="Kosten ca. (€)" style={{ flex: "0 1 140px" }} />
      </div>
      <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>
        Du beauftragst nicht selbst: Der Vermieter gibt frei, lehnt ab oder fragt nach. Danach meldest du dich bei der Firma.
      </p>
      {fehler && <p role="alert" style={{ fontSize: 12, color: "var(--red)", margin: 0 }}>{fehler}</p>}
      {vorschau && <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>{VORSCHAU_NICHT_GESENDET}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" className="btn btn-gold" disabled={pending || vorschau}>{pending ? "…" : "Vorschlag senden"}</button>
        <button type="button" className="btn btn-ghost" onClick={fertig}>Abbrechen</button>
      </div>
    </form>
  );
}

function Eintrag({ a, firmen, vorschau, darfVorschlagen }: { a: PortalAuftragRow; firmen: PortalFirmaRow[]; vorschau: boolean; darfVorschlagen: boolean }) {
  const firma = a.firma_id ? firmen.find((f) => f.id === a.firma_id) ?? null : null;
  const vorgeschlagen = !firma && a.vorgeschlagene_firma_id ? firmen.find((f) => f.id === a.vorgeschlagene_firma_id) ?? null : null;
  // Gas, Strom, Trinkwasser, Schornstein: „selbst erledigt“ gibt es nicht, solange keine Firma am
  // Auftrag hängt (der Server prüft dasselbe — lib/fachbetriebPflicht.ts).
  const pflicht = fachbetriebPflicht(a.titel, a.beschreibung);
  const selbstGesperrt = !!pflicht && !a.firma_id;
  const [fachbetrieb, setFachbetrieb] = useState(false);
  const [aktion, setAktion] = useState<null | "angenommen" | "erledigt" | "abgelehnt">(null);
  const [text, setText] = useState("");
  const [betrag, setBetrag] = useState("");
  const [lohn, setLohn] = useState("");
  const [rechnung, setRechnung] = useState<File | null>(null);
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
      if (status === "erledigt") {
        fd.set("betrag", betrag);
        fd.set("lohnanteil", lohn);
        if (rechnung) fd.set("rechnung", rechnung);
      }
      const r = await beantworteAuftrag(fd);
      if (r?.error) setFehler(r.error);
      else { setAktion(null); setText(""); setBetrag(""); setLohn(""); setRechnung(null); }
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
      {a.status === "freigabe" && vorgeschlagen && (
        <p style={{ fontSize: 12, marginTop: 6, color: "var(--muted)" }}>Dein Vorschlag: <strong>{vorgeschlagen.name}</strong> — wartet auf den Vermieter.</p>
      )}
      {selbstGesperrt && (a.status === "offen" || a.status === "angenommen") && (
        <p className="pflicht-hinweis" role="note">
          <strong>Nur Fachbetrieb ({pflicht.bereich}).</strong> {pflicht.grund} Bitte nicht selbst daran arbeiten —
          {darfVorschlagen ? " „Fachbetrieb nötig“ wählen." : " melde dich beim Vermieter."}
        </p>
      )}
      {(a.status === "offen" || a.status === "angenommen") && firma && (
        <p style={{ fontSize: 12, marginTop: 6, padding: "6px 10px", background: "var(--green-dim)", color: "var(--green)", borderRadius: 6 }}>
          {a.mieter_id
            ? "Vom Vermieter freigegeben — jetzt die Firma anrufen oder ihr den Auftrags-Link per E-Mail schicken; den Termin stimmt die Firma direkt mit dem Mieter ab."
            : "Vom Vermieter freigegeben — jetzt die Firma anrufen und das Problem erklären."}
        </p>
      )}
      {(a.status === "offen" || a.status === "angenommen") && a.mieter_id && a.public_token && (
        <FirmenLinkAktionen token={a.public_token} titel={a.titel} objekt={a.objekt_name} firma={firma} />
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
              {aktion === "erledigt" && (
                <>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 130 }}>
                      Rechnungsbetrag (€, optional)
                      <input className="input" inputMode="decimal" value={betrag} onChange={(e) => setBetrag(e.target.value)} placeholder="z. B. 245,50" />
                    </label>
                    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--muted)", flex: 1, minWidth: 130 }}>
                      davon Arbeits-/Lohnanteil (€)
                      <input className="input" inputMode="decimal" value={lohn} onChange={(e) => setLohn(e.target.value)} placeholder="z. B. 180,00" />
                    </label>
                  </div>
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--muted)" }}>
                    Rechnung anhängen (PDF/Foto, max. 4 MB)
                    <input
                      type="file" className="input"
                      accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                      onChange={(e) => setRechnung(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <p style={{ fontSize: 11, color: "var(--faint)", margin: 0 }}>
                    Betrag, Lohnanteil und Rechnung gehen an den Vermieter — er übernimmt sie per Klick
                    in seine Kostenerfassung. Der Lohnanteil ist für die Steuer wichtig (§ 35a).
                  </p>
                </>
              )}
              {fehler && <p role="alert" style={{ fontSize: 12, color: "var(--red)" }}>{fehler}</p>}
              {vorschau && <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>{VORSCHAU_NICHT_GESENDET}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="btn btn-gold" disabled={pending || vorschau} onClick={() => { if (!vorschau) senden(aktion); }}>
                  {pending ? "…" : aktion === "angenommen" ? "Annahme senden" : aktion === "erledigt" ? "Als erledigt melden" : "Ablehnung senden"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setAktion(null)}>Abbrechen</button>
              </div>
            </div>
          ) : (
            fachbetrieb ? (
              <FachbetriebForm a={a} firmen={firmen} vorschau={vorschau} fertig={() => setFachbetrieb(false)} />
            ) : (
            <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
              {a.status === "offen" && (
                <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 12px", color: "var(--blue)" }} onClick={() => setAktion("angenommen")}>
                  Annehmen
                </button>
              )}
              {!selbstGesperrt && (
                <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 12px", color: "var(--green)" }} onClick={() => setAktion("erledigt")}>
                  {firma ? "Erledigt melden" : "Selbst erledigt"}
                </button>
              )}
              {darfVorschlagen && !firma && (
                <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 12px", color: "var(--amber)" }} onClick={() => setFachbetrieb(true)}>
                  Fachbetrieb nötig
                </button>
              )}
              {a.status === "offen" && (
                <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 12px", color: "var(--red)" }} onClick={() => setAktion("abgelehnt")}>
                  Ablehnen
                </button>
              )}
            </span>
            )
          )}
        </div>
      )}
      <AuftragVerlauf
        auftragId={a.id}
        notizen={a.notizen ?? []}
        ich="service"
        offen={["freigabe", "offen", "angenommen"].includes(a.status)}
        vorschau={vorschau}
      />
    </div>
  );
}

function AntragForm({
  auftraggeber, firmen, objekte, vorschau,
}: { auftraggeber: AuftraggeberRow[]; firmen: PortalFirmaRow[]; objekte: PortalObjektRow[]; vorschau: boolean }) {
  const [offen, setOffen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ok, setOk] = useState<null | "freigegeben" | "wartet">(null);
  const [pending, startTransition] = useTransition();
  const [vermieterId, setVermieterId] = useState(auftraggeber.length === 1 ? auftraggeber[0].vermieter_id : "");
  // Nur Objekte des gewählten Auftraggebers — und nur die, die er zugewiesen hat.
  const seineObjekte = objekte.filter((o) => o.vermieter_id === vermieterId);

  const senden = (fd: FormData) =>
    startTransition(async () => {
      setFehler(null); setOk(null);
      if (vorschau) return; // Vorschau: nie an den Server
      const r = await beantrageAuftrag(fd);
      if (r?.error) setFehler(r.error);
      else { setOk(r?.freigegeben ? "freigegeben" : "wartet"); setOffen(false); }
    });

  return (
    <div className="section">
      <div className="section-header">
        <h3><SendHorizonal size={15} style={{ verticalAlign: "-2px" }} /> Auftrag beantragen</h3>
        <button type="button" className="btn btn-gold" style={{ fontSize: 12 }} onClick={() => { setOffen(!offen); setOk(null); }}>
          {offen ? "Abbrechen" : "Neuer Antrag"}
        </button>
      </div>
      <div className="section-body">
        <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
          Du hast etwas entdeckt, das gemacht werden muss? Beschreibe es hier — der Vermieter
          bekommt die Anfrage in seinem Portal und gibt den Auftrag frei. Liegen die geschätzten
          Kosten innerhalb der Grenze, die er festgelegt hat, ist der Auftrag sofort freigegeben.
          Danach rufst du die passende Firma an und stimmst den Termin direkt mit dem Mieter ab.
        </p>
        {ok === "wartet" && <p style={{ fontSize: 12, color: "var(--green)", marginTop: 8 }}>Antrag gesendet — wartet auf Freigabe des Vermieters ✓</p>}
        {ok === "freigegeben" && <p style={{ fontSize: 12, color: "var(--green)", marginTop: 8 }}>Innerhalb der Kostengrenze — der Auftrag ist freigegeben und steht unten als offen ✓</p>}
        {offen && (
          <form action={senden} style={{ display: "grid", gap: 10, marginTop: 12, padding: 14, background: "var(--bg3)", borderRadius: 10, border: "1px solid var(--line)" }}>
            {auftraggeber.length === 1 ? (
              <input type="hidden" name="vermieterId" value={auftraggeber[0].vermieter_id} />
            ) : (
              <div className="form-group">
                <label>Auftraggeber *</label>
                <select name="vermieterId" required value={vermieterId} onChange={(e) => setVermieterId(e.target.value)}>
                  <option value="" disabled>– wählen –</option>
                  {auftraggeber.map((v) => <option key={v.vermieter_id} value={v.vermieter_id}>{v.label}</option>)}
                </select>
              </div>
            )}
            <div className="form-row single">
              <div className="form-group"><label>Was muss gemacht werden? *</label><input name="titel" required maxLength={200} placeholder="z. B. Dachrinne verstopft" /></div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Objekt</label>
                {/* Nur zugewiesene Objekte — die Datenbank lehnt jedes andere ab. */}
                <select name="propId" defaultValue="" key={vermieterId}>
                  <option value="">{seineObjekte.length === 0 ? "– kein Objekt zugewiesen –" : "– allgemein, kein bestimmtes Objekt –"}</option>
                  {seineObjekte.map((o) => <option key={o.id} value={o.id}>{o.bezeichnung}{o.adresse ? ` · ${o.adresse}` : ""}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Wo genau?</label><input name="objekt" maxLength={200} placeholder="z. B. EG links, Keller, Dach" /></div>
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
            <div className="form-row">
              <div className="form-group">
                <label>Geschätzte Kosten (€)</label>
                <input name="kostenSchaetzung" inputMode="decimal" maxLength={20} placeholder="z. B. 250" />
              </div>
              <div className="form-group" style={{ fontSize: 11, color: "var(--muted)", alignSelf: "end" }}>
                Ohne Schätzung entscheidet immer der Vermieter.
              </div>
            </div>
            <div className="form-row single">
              <div className="form-group"><label>Beschreibung</label><textarea name="beschreibung" rows={3} maxLength={2000} placeholder="Problem, Dringlichkeit, betroffener Mieter …" /></div>
            </div>
            {fehler && <p role="alert" style={{ fontSize: 12, color: "var(--red)", margin: 0 }}>{fehler}</p>}
            {vorschau && <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>{VORSCHAU_NICHT_GESENDET}</p>}
            <div><button type="submit" className="btn btn-gold" disabled={pending || vorschau}>{pending ? "…" : "Antrag an den Vermieter senden"}</button></div>
          </form>
        )}
      </div>
    </div>
  );
}

/** Die Objekte, die der Vermieter dem Hausmeister zugewiesen hat — eine Zeile je Objekt. */
function ObjektListe({ objekte, mehrereAuftraggeber, auftraggeber }: { objekte: PortalObjektRow[]; mehrereAuftraggeber: boolean; auftraggeber: AuftraggeberRow[] }) {
  if (objekte.length === 0) return null;
  const name = (id: string) => auftraggeber.find((a) => a.vermieter_id === id)?.label ?? "";
  return (
    <div className="section">
      <div className="section-header">
        <h3><Building2 size={15} style={{ verticalAlign: "-2px" }} /> Deine Objekte</h3>
        <span className="badge badge-neutral">{objekte.length}</span>
      </div>
      <div className="section-body">
        {objekte.map((o) => (
          <div key={o.id} className="listen-zeile" style={{ cursor: "default" }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="listen-zeile-titel" style={{ fontWeight: 500 }}>{o.bezeichnung}</span>
              <span className="listen-zeile-sub">{[o.adresse, mehrereAuftraggeber ? name(o.vermieter_id) : null].filter(Boolean).join(" · ")}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AuftraegePortal({
  auftraege, firmen, auftraggeber, objekte = [], vorschau = false,
}: {
  auftraege: PortalAuftragRow[];
  firmen: PortalFirmaRow[];
  auftraggeber: AuftraggeberRow[];
  /** Zugewiesene Objekte (nur Hausmeister). */
  objekte?: PortalObjektRow[];
  /** Formulare ausfüllbar, Senden aus (Ansicht beim Vermieter, Demo). */
  vorschau?: boolean;
}) {
  const offene = auftraege.filter((a) => ["offen", "angenommen", "freigabe"].includes(a.status));
  const erledigte = auftraege.filter((a) => ["erledigt", "abgelehnt", "nicht_freigegeben"].includes(a.status));
  // Anträge stellt nur ein Hausmeister — die Datenbank prüft dieselbe Rolle.
  const alsHausmeister = auftraggeber.filter((a) => (a.rolle ?? "hausmeister") === "hausmeister");
  const hausmeisterBei = new Set(alsHausmeister.map((a) => a.vermieter_id));
  // Ohne Vermieter-ID (ältere Zeilen) zählt die einzige Verknüpfung.
  const darf = (a: PortalAuftragRow) =>
    a.vermieter_id ? hausmeisterBei.has(a.vermieter_id) : alsHausmeister.length === auftraggeber.length && alsHausmeister.length > 0;
  return (
    <>
      {alsHausmeister.length > 0 ? (
        <AntragForm auftraggeber={alsHausmeister} firmen={firmen} objekte={objekte} vorschau={vorschau} />
      ) : (
        <p className="dienstleister-hinweis">
          Als Dienstleister siehst du hier die Aufträge, die dir gegeben werden — mit Termin,
          Ort und Ansprechpartner. Neue Arbeiten beauftragt der Vermieter.
        </p>
      )}

      <ObjektListe objekte={objekte} mehrereAuftraggeber={auftraggeber.length > 1} auftraggeber={auftraggeber} />

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
            offene.map((a) => <Eintrag key={a.id} a={a} firmen={firmen} vorschau={vorschau} darfVorschlagen={darf(a)} />)
          )}
        </div>
      </div>

      {alsHausmeister.length > 0 && (
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
      )}

      {erledigte.length > 0 && (
        <div className="section">
          <div className="section-header"><h3>Abgeschlossen</h3></div>
          <div className="section-body">
            {erledigte.map((a) => <Eintrag key={a.id} a={a} firmen={firmen} vorschau={vorschau} darfVorschlagen={false} />)}
          </div>
        </div>
      )}
    </>
  );
}
