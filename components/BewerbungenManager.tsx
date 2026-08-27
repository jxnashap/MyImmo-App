"use client";

// Vermieter: Bewerbungs-Links verwalten + eingegangene Selbstauskünfte
// sichten und bewerten (Favorit / Ablehnen).
import { useState, useTransition } from "react";
import {
  Link2, Copy, Check, Star, XCircle, RotateCcw, ChevronDown, ChevronUp, UserRound,
  FileText, Download, X,
} from "lucide-react";
import {
  erstelleBewerberLink, setzeBewerberLinkAktiv, loescheBewerberLink,
  setzeBewerbungStatus, loescheBewerbung, ladeBewerbungDatei, loescheBewerbungDatei,
} from "@/lib/actions/bewerber";
import DeleteButton from "@/components/DeleteButton";
import { euro, datum } from "@/lib/format";
import { teilbarerLink } from "@/lib/appUrl";

export type BewerberLinkRow = {
  id: string; token: string; titel: string | null; aktiv: boolean; created_at: string;
  objektName: string;
};
export type BewerbungRow = {
  id: string; name: string; email: string | null; telefon: string | null;
  einzug_ab: string | null; personen: number | null; beruf: string | null;
  arbeitgeber: string | null; netto_einkommen: number | null; raucher: boolean | null;
  haustiere: string | null; schufa: boolean | null; nachricht: string | null;
  unterschrift_data: string | null; status: string; created_at: string;
  objektName: string;
  dateien: { id: string; name: string; groesse: number }[];
};

function dateiGroesse(b: number): string {
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} kB`;
}

// Download über die Server-Action: Base64 erst auf Klick laden (RLS-geprüft),
// dann als Blob speichern — kein Base64 in der Listen-Payload.
function BewerbungDatei({ d }: { d: { id: string; name: string; groesse: number } }) {
  const [laedt, setLaedt] = useState(false);
  const herunterladen = async () => {
    setLaedt(true);
    try {
      const r = await ladeBewerbungDatei(d.id);
      if (!r.ok || !r.data) return;
      // Data-URL von Hand dekodieren statt fetch(): die CSP der App erlaubt
      // unter connect-src kein data: — atob braucht keinen Netzwerkpfad.
      const komma = r.data.indexOf(",");
      const bin = atob(r.data.slice(komma + 1));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: r.typ ?? "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.name ?? d.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } finally {
      setLaedt(false);
    }
  };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "5px 10px", background: "var(--bg2)", border: "1px solid var(--line)", borderRadius: 10 }}>
      <FileText size={13} color="var(--gold)" />
      <span style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
      <span style={{ color: "var(--faint)" }}>{dateiGroesse(d.groesse)}</span>
      <button
        type="button" title="Herunterladen" disabled={laedt} onClick={herunterladen}
        style={{ background: "none", border: "none", color: "var(--gold)", cursor: "pointer", display: "inline-grid", placeItems: "center", padding: 2 }}
      >
        {laedt ? <span className="spinner" style={{ width: 11, height: 11 }} /> : <Download size={13} />}
      </button>
      <DeleteButton
        action={async () => { await loescheBewerbungDatei(d.id); }}
        className="delete-btn" label={<X size={12} />} confirmText={`Dokument „${d.name}“ endgültig löschen?`}
      />
    </span>
  );
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  neu: { label: "Neu", cls: "badge-amber" },
  favorit: { label: "Favorit", cls: "badge-green" },
  abgelehnt: { label: "Abgelehnt", cls: "badge-red" },
};

function LinkZeile({ l }: { l: BewerberLinkRow }) {
  const [kopiert, setKopiert] = useState(false);
  const [pending, startTransition] = useTransition();
  const url = teilbarerLink(`/bewerben/${l.token}`);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 12 }}>
      <Link2 size={14} color={l.aktiv ? "var(--gold)" : "var(--faint)"} />
      <span style={{ fontWeight: 600 }}>{l.objektName}</span>
      {l.titel && <span style={{ color: "var(--muted)" }}>{l.titel}</span>}
      <span className={`badge ${l.aktiv ? "badge-green" : "badge-neutral"}`}>{l.aktiv ? "Aktiv" : "Deaktiviert"}</span>
      <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6 }}>
        <button
          type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }}
          onClick={async () => { await navigator.clipboard.writeText(url); setKopiert(true); setTimeout(() => setKopiert(false), 1600); }}
        >
          {kopiert ? <><Check size={12} style={{ verticalAlign: "-2px" }} /> Kopiert</> : <><Copy size={12} style={{ verticalAlign: "-2px" }} /> Link kopieren</>}
        </button>
        <button
          type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} disabled={pending}
          onClick={() => startTransition(async () => { await setzeBewerberLinkAktiv(l.id, !l.aktiv); })}
        >
          {l.aktiv ? "Deaktivieren" : "Aktivieren"}
        </button>
        <DeleteButton action={async () => { await loescheBewerberLink(l.id); }} className="delete-btn" label={<XCircle size={14} />} confirmText="Link und alle zugehörigen Bewerbungen löschen?" />
      </span>
    </div>
  );
}

function BewerbungKarte({ b }: { b: BewerbungRow }) {
  const [offen, setOffen] = useState(false);
  const [pending, startTransition] = useTransition();
  const s = STATUS_META[b.status] ?? STATUS_META.neu;
  const set = (status: "neu" | "favorit" | "abgelehnt") =>
    startTransition(async () => { await setzeBewerbungStatus(b.id, status); });
  const info: [string, string][] = [];
  if (b.einzug_ab) info.push(["Einzug ab", datum(b.einzug_ab)]);
  if (b.personen != null) info.push(["Personen", String(b.personen)]);
  if (b.beruf) info.push(["Beruf", b.beruf]);
  if (b.arbeitgeber) info.push(["Arbeitgeber", b.arbeitgeber]);
  if (b.netto_einkommen != null) info.push(["Netto-Einkommen", euro(b.netto_einkommen)]);
  if (b.raucher != null) info.push(["Raucher", b.raucher ? "Ja" : "Nein"]);
  if (b.haustiere) info.push(["Haustiere", b.haustiere]);
  if (b.schufa != null) info.push(["SCHUFA vorhanden", b.schufa ? "Ja" : "Nein"]);
  if (b.email) info.push(["E-Mail", b.email]);
  if (b.telefon) info.push(["Telefon", b.telefon]);

  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13 }}>
        <UserRound size={14} color="var(--gold)" />
        <span style={{ fontWeight: 600 }}>{b.name}</span>
        <span className={`badge ${s.cls}`}>{s.label}</span>
        <span className="badge badge-neutral">{b.objektName}</span>
        <span style={{ fontSize: 11, color: "var(--faint)", marginLeft: "auto" }}>{datum(b.created_at)}</span>
        <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => setOffen(!offen)}>
          {offen ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Details
        </button>
      </div>
      {offen && (
        <div style={{ marginTop: 8, padding: 12, background: "var(--bg3)", borderRadius: 10, border: "1px solid var(--line)", fontSize: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "6px 18px" }}>
            {info.map(([k, v]) => (
              <span key={k}><span style={{ color: "var(--muted)" }}>{k}:</span> <strong>{v}</strong></span>
            ))}
          </div>
          {b.nachricht && <p style={{ marginTop: 10, whiteSpace: "pre-wrap", color: "var(--text)" }}>{b.nachricht}</p>}
          {b.dateien.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>
                Dokumente ({b.dateien.length}) — z. B. Gehaltsabrechnungen, SCHUFA:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {b.dateien.map((d) => <BewerbungDatei key={d.id} d={d} />)}
              </div>
            </div>
          )}
          {b.unterschrift_data && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4 }}>Unterschrift (bestätigt die Richtigkeit der Angaben):</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.unterschrift_data} alt="Unterschrift" style={{ maxWidth: 240, maxHeight: 90, background: "#fff", borderRadius: 6, border: "1px solid var(--line)", padding: 4 }} />
            </div>
          )}
          <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
            {b.status !== "favorit" && (
              <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px", color: "var(--green)" }} disabled={pending} onClick={() => set("favorit")}>
                <Star size={12} style={{ verticalAlign: "-2px" }} /> Favorit
              </button>
            )}
            {b.status !== "abgelehnt" && (
              <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px", color: "var(--red)" }} disabled={pending} onClick={() => set("abgelehnt")}>
                <XCircle size={12} style={{ verticalAlign: "-2px" }} /> Ablehnen
              </button>
            )}
            {b.status !== "neu" && (
              <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} disabled={pending} onClick={() => set("neu")}>
                <RotateCcw size={12} style={{ verticalAlign: "-2px" }} /> Zurücksetzen
              </button>
            )}
            <DeleteButton action={async () => { await loescheBewerbung(b.id); }} className="btn btn-ghost" label="Löschen" confirmText="Diese Bewerbung endgültig löschen (DSGVO)?" />
          </div>
        </div>
      )}
    </div>
  );
}

export default function BewerbungenManager({
  links, bewerbungen, properties,
}: {
  links: BewerberLinkRow[];
  bewerbungen: BewerbungRow[];
  properties: { id: string; bezeichnung: string }[];
}) {
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const erstellen = (fd: FormData) =>
    startTransition(async () => {
      setFehler(null);
      const r = await erstelleBewerberLink(fd);
      if (r?.error) setFehler(r.error);
    });

  return (
    <>
      <div className="section">
        <div className="section-header"><h3>Bewerbungs-Links</h3></div>
        <div className="section-body">
          <form action={erstellen} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 6 }}>
            <div className="form-group" style={{ minWidth: 200 }}>
              <label>Objekt</label>
              <select name="propId" required defaultValue="">
                <option value="" disabled>– Objekt wählen –</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: 180 }}>
              <label>Titel (optional, sieht der Bewerber)</label>
              <input name="titel" maxLength={120} placeholder="z. B. 3-Zi-Wohnung ab 01.09." />
            </div>
            <button type="submit" className="btn btn-gold" disabled={pending}>Link erstellen</button>
          </form>
          {fehler && <p style={{ fontSize: 12, color: "var(--red)" }}>{fehler}</p>}
          {links.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--faint)", marginTop: 8 }}>
              Noch keine Links — erstelle einen Link je Objekt und teile ihn im Inserat
              (ImmoScout, Kleinanzeigen, …). Interessenten füllen die Selbstauskunft ohne Konto aus.
            </p>
          ) : (
            links.map((l) => <LinkZeile key={l.id} l={l} />)
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <h3>Eingegangene Bewerbungen</h3>
          {bewerbungen.filter((b) => b.status === "neu").length > 0 && (
            <span className="badge badge-amber">{bewerbungen.filter((b) => b.status === "neu").length} neu</span>
          )}
        </div>
        <div className="section-body">
          {bewerbungen.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--faint)" }}>Noch keine Bewerbungen eingegangen.</p>
          ) : (
            bewerbungen.map((b) => <BewerbungKarte key={b.id} b={b} />)
          )}
        </div>
      </div>
    </>
  );
}
