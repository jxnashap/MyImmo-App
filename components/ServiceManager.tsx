"use client";

// Vermieter: Service-Partner einladen (SV-Code), Aufträge vergeben und
// den Bearbeitungsstand sehen — Tab "Service" im Mieterportal.
import { UEBERNAHME_KATEGORIEN } from "@/lib/kategorien";
import { useState, useTransition } from "react";
import {
  Wrench, Copy, Check, KeyRound, XCircle, UserRound, Trash2,
  Building2, Phone, Mail, Globe, ShieldCheck,
} from "lucide-react";
import {
  erzeugeServiceCode, widerrufeServiceCode, entferneServicePartner, setzeServicePartner, uebergebeServicePartner,
  erstelleAuftrag, loescheAuftrag, entscheideAuftrag, uebernimmAuftragAlsKosten, stelleRueckfrage,
  setzeKostengrenze,
} from "@/lib/actions/service";
import { erstelleFirma, loescheFirma } from "@/lib/actions/firmen";
import { GEWERKE } from "@/lib/gewerke";
import DeleteButton from "@/components/DeleteButton";
import { datum } from "@/lib/format";
import { teilbarerLink } from "@/lib/appUrl";
import { useToast } from "@/components/Toast";
import { actionFehler } from "@/lib/actionErgebnis";
import { VORSCHAU_NICHT_GESENDET } from "@/components/AuftraegePortal";
import AuftragVerlauf from "@/components/AuftragVerlauf";
import TaetigkeitWahl from "@/components/TaetigkeitWahl";
import { taetigkeit as taetigkeitVon } from "@/lib/taetigkeiten";
import { rueckfrageOffen, type AuftragNotiz } from "@/lib/auftragNotizen";

export type ServicePartnerRow = {
  user_id: string; firma: string | null; email: string | null; created_at: string;
  /** Hausmeister betreut Objekte und stellt Anträge; Dienstleister sieht nur seine Aufträge. */
  rolle: "hausmeister" | "dienstleister";
  /** IDs der zugewiesenen Objekte (`service_objekte`). */
  objekte: string[];
};
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
  /** Schätzung des Hausmeisters beim Antrag; `auto_freigegeben` = lag in der Kostengrenze. */
  kosten_schaetzung?: number | null; auto_freigegeben?: boolean;
  /** Rueckmeldungen der Firma ueber den oeffentlichen Auftrags-Link. */
  rueckmeldungen?: FirmenRueckmeldung[];
  /** Firma, die der Hausmeister mit „Fachbetrieb nötig“ vorschlägt (wird mit der Freigabe übernommen). */
  vorgeschlageneFirma?: string | null;
  /** Verlauf: Notizen und Fotos (lib/auftragNotizen.ts). */
  notizen?: AuftragNotiz[];
  /** Art der Arbeit (lib/taetigkeiten.ts); bei Aufträgen vor dem 05.10.2026 leer. */
  taetigkeit?: string | null;
};
export type FirmenRueckmeldung = {
  id: string; art: "zusage" | "absage" | "rueckfrage";
  firma: string | null; kontakt: string | null;
  termin: string | null; nachricht: string | null; created_at: string;
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
      <select name="kategorie" className="input" defaultValue="Reparatur" aria-label="Kategorie" style={{ fontSize: 12, padding: "4px 8px", width: "auto" }}>
        {UEBERNAHME_KATEGORIEN.map((k) => <option key={k}>{k}</option>)}
      </select>
      <label style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
        Rechnungsdatum
        <input type="date" name="buchungsdatum" className="input" style={{ fontSize: 12, padding: "4px 8px", width: "auto" }} title="Leer = heute" />
      </label>
      <button type="submit" className="btn btn-gold" disabled={pending} style={{ fontSize: 12 }}>
        {pending ? "…" : "Als Kosten übernehmen"}
      </button>
      {fehler && <span role="alert" style={{ fontSize: 12, color: "var(--red)" }}>{fehler}</span>}
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
        <button type="button" className="btn btn-outline" style={{ fontSize: 12 }} disabled={pending} onClick={erzeugen}>
          {pending ? "…" : "Neuen Code erzeugen"}
        </button>
      </div>
      <div className="section-body">
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: alle.length ? 10 : 0 }}>
          Gib den Code an deinen Handwerker/Hausmeister — er registriert sich damit unter
          „Service / Hausmeister“ und ist dann mit dir verknüpft. Jeder Code gilt einmalig, 14 Tage.
        </p>
        {fehler && <p role="alert" style={{ fontSize: 12, color: "var(--red)" }}>{fehler}</p>}
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
              <DeleteButton action={() => widerrufeServiceCode(c.code)} className="delete-btn" label={<XCircle size={14} />} confirmText="Diesen Code widerrufen?" />
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
        <button type="button" className="btn btn-outline" style={{ fontSize: 12 }} onClick={() => setOffen(!offen)}>
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
            {fehler && <p role="alert" style={{ fontSize: 12, color: "var(--red)", margin: 0 }}>{fehler}</p>}
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
              {f.telefon && <a href={`tel:${f.telefon.replace(/\s/g, "")}`} style={{ fontSize: 12, color: "var(--gold)", textDecoration: "none" }}><Phone size={11} style={{ display: "inline", verticalAlign: "-1px" }} /> {f.telefon}</a>}
              {f.email && <a href={`mailto:${f.email}`} style={{ fontSize: 12, color: "var(--gold)", textDecoration: "none" }}><Mail size={11} style={{ display: "inline", verticalAlign: "-1px" }} /> {f.email}</a>}
              {f.website && <a href={f.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--gold)", textDecoration: "none" }}><Globe size={11} style={{ display: "inline", verticalAlign: "-1px" }} /> Website</a>}
              {f.notiz && <span style={{ fontSize: 11, color: "var(--muted)" }}>{f.notiz}</span>}
              <span style={{ marginLeft: "auto" }}>
                <DeleteButton action={() => loescheFirma(f.id)} className="delete-btn" label={<Trash2 size={13} />} confirmText="Firma aus dem Verzeichnis löschen?" />
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const euro = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

/** Kostengrenze: Anträge des Hausmeisters bis zu diesem Betrag sind ohne Rückfrage frei. */
function KostengrenzeSektion({ grenze, demo }: { grenze: number | null; demo: boolean }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const speichern = (fd: FormData) =>
    startTransition(async () => {
      if (demo) return;
      const f = actionFehler(await setzeKostengrenze(fd));
      if (f) toast(f, "error");
      else toast("Kostengrenze gespeichert.");
    });
  return (
    <div className="section">
      <div className="section-header"><h3>Kostengrenze für Hausmeister-Anträge</h3></div>
      <div className="section-body">
        <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 10px", lineHeight: 1.6 }}>
          Beantragt dein Hausmeister einen Auftrag und schätzt die Kosten bis zu diesem Betrag,
          ist er sofort freigegeben — du siehst ihn trotzdem in der Liste. Darüber, oder ohne
          Schätzung, entscheidest du wie bisher. Die Schätzung stammt vom Hausmeister; die
          Rechnung kann davon abweichen. Leer lassen = jeder Antrag braucht deine Freigabe.
        </p>
        <form action={speichern} style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }} data-demo-erlaubt>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Grenze (€)</label>
            <input name="kostengrenze" inputMode="decimal" maxLength={12} defaultValue={grenze == null ? "" : String(grenze).replace(".", ",")} placeholder="z. B. 300" style={{ width: 140 }} />
          </div>
          <button type="submit" className="btn btn-outline" style={{ fontSize: 12 }} disabled={pending || demo}>{pending ? "…" : "Speichern"}</button>
          {grenze != null && <span style={{ fontSize: 11, color: "var(--muted)" }}>aktuell {euro(grenze)}</span>}
        </form>
        {demo && <p style={{ fontSize: 11, color: "var(--muted)", margin: "6px 0 0" }}>{VORSCHAU_NICHT_GESENDET}</p>}
      </div>
    </div>
  );
}

function FreigabeButtons({ id, mieterListe, demo = false }: { id: string; mieterListe: MieterOption[]; demo?: boolean }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const [mieterId, setMieterId] = useState("");
  const [frage, setFrage] = useState<string | null>(null);
  const rueckfrage = () =>
    startTransition(async () => {
      if (demo || frage === null) return;
      try {
        const fd = new FormData();
        fd.set("auftragId", id);
        fd.set("text", frage);
        const r = await stelleRueckfrage(fd);
        if ("error" in r) toast(r.error, "error");
        else { toast("Rückfrage an den Hausmeister gesendet ✓", "success"); setFrage(null); }
      } catch {
        toast("Rückfrage fehlgeschlagen.", "error");
      }
    });
  if (frage !== null) {
    return (
      <div style={{ display: "grid", gap: 8, padding: 10, borderRadius: 10, background: "var(--bg3)", border: "1px solid var(--line2)" }}>
        <textarea className="input" rows={2} maxLength={2000} value={frage} onChange={(e) => setFrage(e.target.value)} placeholder="z. B. Gibt es ein zweites Angebot? Reicht eine Reparatur statt Austausch?" autoFocus />
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-outline" style={{ fontSize: 11, padding: "5px 12px" }} disabled={pending || demo || frage.trim().length < 3} onClick={rueckfrage}>Rückfrage senden</button>
          <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 12px" }} onClick={() => setFrage(null)}>Abbrechen</button>
        </div>
      </div>
    );
  }
  const entscheiden = (freigeben: boolean) =>
    startTransition(async () => {
      // Antwort auswerten — sonst bleibt „Mieter nicht gefunden" ungesagt.
      const f = actionFehler(await entscheideAuftrag(id, freigeben, mieterId || undefined));
      if (f) toast(f, "error");
    });
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      {mieterListe.length > 0 && (
        <select className="input" style={{ width: "auto", fontSize: 12, padding: "5px 10px" }} value={mieterId} onChange={(e) => setMieterId(e.target.value)}>
          <option value="">Mieter-Kontakt teilen? (optional)</option>
          {mieterListe.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      )}
      <button type="button" className="btn btn-outline" style={{ fontSize: 11, padding: "5px 12px" }} disabled={pending} onClick={() => entscheiden(true)}>
        <ShieldCheck size={12} style={{ verticalAlign: "-2px" }} /> Freigeben
      </button>
      <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 12px", color: "var(--red)" }} disabled={pending} onClick={() => entscheiden(false)}>
        Ablehnen
      </button>
      <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "5px 12px", color: "var(--amber)" }} disabled={pending} onClick={() => setFrage("")}>
        Rückfrage
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
        // Produktionsadresse statt window.location.origin — der Link geht an
        // einen Handwerker und muss auch morgen noch stimmen (lib/appUrl.ts).
        await navigator.clipboard.writeText(teilbarerLink(`/auftrag/${token}`));
        setKopiert(true); setTimeout(() => setKopiert(false), 1600);
      }}
    >
      {kopiert ? <><Check size={12} style={{ verticalAlign: "-2px" }} /> Kopiert</> : <><Copy size={12} style={{ verticalAlign: "-2px" }} /> Firmen-Link</>}
    </button>
  );
}

const ROLLEN_TEXT: Record<ServicePartnerRow["rolle"], string> = {
  hausmeister: "Hausmeister",
  dienstleister: "Dienstleister",
};

// Ein Partner: Rolle, betreute Objekte, Übergabe an einen anderen Partner, Trennen
// (05.10.2026). Aufgeklappt nur bei Bedarf — die Liste bleibt eine Zeile je Partner.
function PartnerZeile({
  p, alle, properties, demo,
}: { p: ServicePartnerRow; alle: ServicePartnerRow[]; properties: { id: string; bezeichnung: string }[]; demo: boolean }) {
  const [rolle, setRolle] = useState(p.rolle);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const name = p.firma || p.email || "Service-Partner";
  const andere = alle.filter((x) => x.user_id !== p.user_id);
  const objektNamen = properties.filter((o) => p.objekte.includes(o.id)).map((o) => o.bezeichnung);

  const speichern = (fd: FormData) =>
    startTransition(async () => {
      if (demo) return;
      try {
        const r = await setzeServicePartner(fd);
        if ("error" in r) toast(r.error, "error");
        else toast(`${name}: gespeichert ✓`, "success");
      } catch {
        toast("Speichern fehlgeschlagen.", "error");
      }
    });
  const uebergeben = (fd: FormData) =>
    startTransition(async () => {
      if (demo) return;
      try {
        const r = await uebergebeServicePartner(fd);
        if ("error" in r) toast(r.error, "error");
        else toast(`Übergeben: ${r.auftraege} offene Aufträge${r.objekte ? `, ${r.objekte} Objekte` : ""} ✓`, "success");
      } catch {
        toast("Übergabe fehlgeschlagen.", "error");
      }
    });

  return (
    <details className="partner-zeile">
      <summary>
        <Wrench size={14} color="var(--gold)" style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="listen-zeile-titel" style={{ fontWeight: 600 }}>{name}</span>
          <span className="listen-zeile-sub">
            {[ROLLEN_TEXT[p.rolle], p.rolle === "hausmeister" ? (objektNamen.length ? objektNamen.join(", ") : "noch keine Objekte") : null, p.firma && p.email ? p.email : null]
              .filter(Boolean).join(" · ")}
          </span>
        </span>
        <span style={{ fontSize: 11, color: "var(--faint)", whiteSpace: "nowrap" }}>seit {datum(p.created_at)}</span>
      </summary>
      <div className="partner-inhalt">
        <form action={speichern} style={{ display: "grid", gap: 10 }}>
          <input type="hidden" name="serviceUserId" value={p.user_id} />
          <div className="form-group" style={{ margin: 0 }}>
            <label>Rolle</label>
            <select name="rolle" value={rolle} onChange={(e) => setRolle(e.target.value as ServicePartnerRow["rolle"])}>
              <option value="hausmeister">Hausmeister — betreut Objekte, stellt Anträge</option>
              <option value="dienstleister">Dienstleister — sieht nur Aufträge, die du ihm gibst</option>
            </select>
          </div>
          {rolle === "hausmeister" && (
            <fieldset className="partner-objekte">
              <legend>Betreute Objekte — er sieht nur diese (Name und Adresse, keine Zahlen)</legend>
              {properties.length === 0 ? (
                <span style={{ fontSize: 12, color: "var(--faint)" }}>Noch keine Objekte angelegt.</span>
              ) : (
                properties.map((o) => (
                  <label key={o.id}>
                    <input type="checkbox" name="objekt" value={o.id} defaultChecked={p.objekte.includes(o.id)} /> {o.bezeichnung}
                  </label>
                ))
              )}
            </fieldset>
          )}
          {demo && <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>{VORSCHAU_NICHT_GESENDET}</p>}
          <div><button type="submit" className="btn btn-gold" disabled={pending || demo}>{pending ? "…" : "Speichern"}</button></div>
        </form>

        {andere.length > 0 && (
          <form action={uebergeben} className="partner-uebergabe">
            <input type="hidden" name="alt" value={p.user_id} />
            <div style={{ fontSize: 12, fontWeight: 600 }}>Partner wechseln</div>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
              Offene Aufträge (beantragt, offen, angenommen) gehen an den neuen Partner. Erledigte bleiben hier.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select name="neu" required defaultValue="" style={{ flex: "1 1 200px" }}>
                <option value="" disabled>– an wen? –</option>
                {andere.map((x) => <option key={x.user_id} value={x.user_id}>{x.firma || x.email || "Partner"} ({ROLLEN_TEXT[x.rolle]})</option>)}
              </select>
              {p.objekte.length > 0 && (
                <label style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
                  <input type="checkbox" name="mitObjekten" value="1" defaultChecked /> auch die {p.objekte.length} Objekte
                </label>
              )}
              <button type="submit" className="btn btn-outline" disabled={pending || demo}>Übergeben</button>
            </div>
          </form>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <DeleteButton action={() => entferneServicePartner(p.user_id)} className="btn btn-ghost" label={<><Trash2 size={13} style={{ verticalAlign: "-2px" }} /> Verknüpfung lösen</>} confirmText="Verknüpfung zu diesem Partner lösen? Er sieht danach keine Objekte und Aufträge von dir mehr." />
        </div>
      </div>
    </details>
  );
}

export default function ServiceManager({
  partner, codes, auftraege, properties, firmen, mieterListe, initialTitel, initialText, demo = false, kostengrenze = null,
}: {
  partner: ServicePartnerRow[];
  codes: ServiceCodeRow[];
  auftraege: AuftragRow[];
  properties: { id: string; bezeichnung: string }[];
  firmen: FirmaRow[];
  mieterListe: MieterOption[];
  initialTitel?: string;
  initialText?: string;
  /** Demo (01.10.2026): „Auftrag vergeben" ausfüllbar, Senden aus. */
  demo?: boolean;
  /** vermieter_profil.kostengrenze (null = keine). */
  kostengrenze?: number | null;
}) {
  const [fehler, setFehler] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, startTransition] = useTransition();

  const senden = (fd: FormData) =>
    startTransition(async () => {
      setFehler(null); setOk(false);
      if (demo) return; // Demo: nie an den Server
      const r = await erstelleAuftrag(fd);
      if (r?.error) setFehler(r.error);
      else setOk(true);
    });

  return (
    <>
      <CodeSektion codes={codes} />

      <FirmenSektion firmen={firmen} />

      {partner.length > 0 && <KostengrenzeSektion grenze={kostengrenze} demo={demo} />}

      <div className="section">
        <div className="section-header"><h3>Verknüpfte Service-Partner</h3><span style={{ fontSize: 12, color: "var(--muted)" }}>Antippen: Rolle, Objekte, Wechsel</span></div>
        <div className="section-body">
          {partner.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--faint)" }}>
              Noch kein Partner verknüpft — erzeuge oben einen Code und gib ihn weiter.
            </p>
          ) : (
            partner.map((p) => <PartnerZeile key={p.user_id} p={p} alle={partner} properties={properties} demo={demo} />)
          )}
        </div>
      </div>

      {/* Ohne verknüpftes Service-Konto gibt es keinen Empfänger für einen
          Auftrag. Der Block verschwand dann kommentarlos — man konnte
          Handwerksfirmen samt Gewerk und Kontakt pflegen und stieß danach auf
          eine Funktion, die es scheinbar nicht gibt. Jetzt steht dort, was
          fehlt. */}
      {partner.length === 0 && firmen.length > 0 && (
        <div className="section">
          <div className="section-header"><h3>Auftrag vergeben</h3></div>
          <div className="section-body">
            <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
              Du hast {firmen.length} {firmen.length === 1 ? "Firma" : "Firmen"} im Verzeichnis,
              aber noch kein verknüpftes <strong>Service-Konto</strong>. Aufträge laufen über das
              Service-Portal — der Betrieb braucht dafür einen eigenen Zugang. Erzeuge oben unter{" "}
              <strong>Service-Partner</strong> einen Einladungscode und schicke ihn deinem
              Handwerksbetrieb; sobald er sich registriert hat, kannst du hier Aufträge vergeben.
            </p>
          </div>
        </div>
      )}

      {partner.length > 0 && (
        <div className="section">
          <div className="section-header"><h3>Auftrag vergeben</h3></div>
          <div className="section-body">
            {/* `data-demo-erlaubt`: In der Demo soll der Besucher sehen, was
                sich auswählen lässt (Partner, Objekt, Mieter-Kontakt) — die
                Felder bleiben bedienbar, nur das Senden ist aus. */}
            <form action={senden} style={{ display: "grid", gap: 10 }} {...(demo ? { "data-demo-erlaubt": "" } : {})}>
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
                  <label>Art der Arbeit *</label>
                  <TaetigkeitWahl />
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
              {fehler && <p role="alert" style={{ fontSize: 12, color: "var(--red)", margin: 0 }}>{fehler}</p>}
              {ok && <p style={{ fontSize: 12, color: "var(--green)", margin: 0 }}>Auftrag gesendet ✓</p>}
              {demo && <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>{VORSCHAU_NICHT_GESENDET}</p>}
              <div><button type="submit" className="btn btn-gold" disabled={pending || demo}>{pending ? "…" : "Auftrag senden"}</button></div>
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
                  {/* Drei Zeilen statt einer Wickel-Zeile (06.10.2026): Am Handy stand
                      das Icon sonst allein über dem Titel und der Papierkorb allein unten.
                      1) Icon + Titel + Löschen, 2) Merkmale, 3) Objekt · Termin · Datum. */}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <UserRound size={14} color="var(--gold)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <span style={{ fontWeight: 600, flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{a.titel}</span>
                    <span style={{ flexShrink: 0 }}>
                      <DeleteButton action={() => loescheAuftrag(a.id)} className="delete-btn" label={<Trash2 size={13} />} confirmText="Auftrag löschen?" />
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                    <span className={`badge ${s.cls}`}>{s.label}</span>
                    <span className="badge badge-neutral">{a.partnerName}</span>
                    {taetigkeitVon(a.taetigkeit) && <span className={`badge ${taetigkeitVon(a.taetigkeit)!.selbst ? "badge-neutral" : "badge-amber"}`}>{taetigkeitVon(a.taetigkeit)!.label}</span>}
                    {a.erstellt_von === "service" && <span className="badge badge-blue">vom Hausmeister beantragt</span>}
                    {a.status === "freigabe" && rueckfrageOffen(a.notizen ?? []) && <span className="badge badge-amber">Rückfrage offen</span>}
                    {a.status === "freigabe" && !rueckfrageOffen(a.notizen ?? []) && (a.notizen ?? []).some((n) => n.rueckfrage) && <span className="badge badge-green">Hausmeister hat geantwortet</span>}
                    {a.auto_freigegeben && <span className="badge badge-amber" title="Lag innerhalb deiner Kostengrenze — ohne Rückfrage freigegeben">automatisch freigegeben</span>}
                    {a.kosten_schaetzung != null && <span style={{ fontSize: 11, color: "var(--muted)" }}>Schätzung {euro(a.kosten_schaetzung)}</span>}
                    {a.firmaName && <span className="badge badge-teal">{a.firmaName}</span>}
                    {a.mieterName && <span className="badge badge-green" title="Mieter-Kontakt wird über den Firmen-Link geteilt">Kontakt: {a.mieterName}</span>}
                    {a.mieterName && (a.status === "offen" || a.status === "angenommen") && <LinkKopierButton token={a.public_token} />}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                    {[a.objekt_name, a.termin ? `Termin ${datum(a.termin)}` : null, `angelegt ${datum(a.created_at)}`].filter(Boolean).join(" · ")}
                  </div>
                  {a.beschreibung && <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, whiteSpace: "pre-wrap" }}>{a.beschreibung}</p>}
                  {a.status === "freigabe" && a.vorgeschlageneFirma && (
                    <p style={{ fontSize: 12, marginTop: 6 }}>
                      Vorschlag des Hausmeisters: <span className="badge badge-teal">{a.vorgeschlageneFirma}</span> — wird mit der Freigabe zur Firma des Auftrags.
                    </p>
                  )}
                  {a.status === "freigabe" && (
                    <div style={{ marginTop: 8 }}>
                      <FreigabeButtons id={a.id} mieterListe={mieterListe} demo={demo} />
                    </div>
                  )}
                  {a.antwort && (
                    <p style={{ fontSize: 12, marginTop: 6, padding: "6px 10px", background: "var(--gold-pale)", borderLeft: "3px solid var(--gold)", borderRadius: 6 }}>
                      <strong>Rückmeldung:</strong> {a.antwort}
                    </p>
                  )}
                  {/* Rueckmeldungen ueber den oeffentlichen Link. Ohne diese
                      Anzeige liefe der neue Rueckkanal ins Leere — die Firma
                      antwortet, und niemand sieht es. */}
                  {(a.rueckmeldungen ?? []).map((r) => {
                    const stil =
                      r.art === "zusage" ? { farbe: "var(--green)", label: "Auftrag angenommen" }
                      : r.art === "absage" ? { farbe: "var(--red)", label: "Abgesagt" }
                      : { farbe: "var(--amber)", label: "Rückfrage" };
                    return (
                      <div key={r.id} style={{ fontSize: 12, marginTop: 6, padding: "7px 10px", background: "var(--bg2)", borderLeft: `3px solid ${stil.farbe}`, borderRadius: 6 }}>
                        <strong style={{ color: stil.farbe }}>{stil.label}</strong>
                        {r.firma ? ` · ${r.firma}` : ""}
                        {r.termin ? ` · Termin ${datum(r.termin)}` : ""}
                        {r.kontakt && <div style={{ color: "var(--muted)" }}>Rückruf: {r.kontakt}</div>}
                        {r.nachricht && <div style={{ whiteSpace: "pre-wrap", marginTop: 2 }}>{r.nachricht}</div>}
                        <div style={{ color: "var(--faint)", fontSize: 11, marginTop: 2 }}>{datum(r.created_at)}</div>
                      </div>
                    );
                  })}
                  <KostenUebernahme a={a} />
                  <AuftragVerlauf
                    auftragId={a.id}
                    notizen={a.notizen ?? []}
                    ich="vermieter"
                    partnerName={a.partnerName}
                    offen={["freigabe", "offen", "angenommen"].includes(a.status)}
                    vorschau={demo}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
