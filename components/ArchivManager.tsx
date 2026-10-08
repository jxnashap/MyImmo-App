"use client";
import SubmitButton from "@/components/SubmitButton";

import { useMemo, useState } from "react";
import { Building2, User, Tag, X, Download, Eye, FileText, Image as ImageIcon, Paperclip, Archive, Plus, SlidersHorizontal, Upload } from "lucide-react";
import Select from "@/components/filters/Select";
import RowDialog from "@/components/RowDialog";
import { useToast } from "@/components/Toast";
import { createDokument, updateDokument, deleteDokument } from "@/lib/actions/archiv";
import type { ArchivDoc } from "@/app/(app)/archiv/page";
import type { Property, Tenant } from "@/lib/types";

export const ARCHIV_ARTEN = [
  "Mietvertrag",
  "Nebenkostenabrechnung",
  "Versicherung",
  "Schreiben / Brief",
  "Übergabeprotokoll",
  "Rechnung",
  "Grundbuch / Kauf",
  "Energieausweis",
  "Sonstiges",
];

const fileIcon = (type: string | null) =>
  type === "application/pdf" ? <FileText size={16} /> : type?.startsWith("image/") ? <ImageIcon size={16} /> : <Paperclip size={16} />;

const deDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";

export default function ArchivManager({
  docs,
  properties,
  mieter,
}: {
  docs: ArchivDoc[];
  properties: Pick<Property, "id" | "bezeichnung">[];
  mieter: Pick<Tenant, "id" | "vorname" | "nachname">[];
}) {
  const propName = useMemo(() => new Map(properties.map((p) => [p.id, p.bezeichnung])), [properties]);
  const mieterName = useMemo(
    () => new Map(mieter.map((m) => [m.id, [m.vorname, m.nachname].filter(Boolean).join(" ") || "Mieter"])),
    [mieter],
  );

  const toast = useToast();
  const [fObjekt, setFObjekt] = useState("");
  const [fMieter, setFMieter] = useState("");
  const [fArt, setFArt] = useState("");
  const [q, setQ] = useState("");
  const [fbOpen, setFbOpen] = useState(false); // Mobile: Filter ein-/ausklappen
  const [showUpload, setShowUpload] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const offenDoc = docs.find((d) => d.id === editId) ?? null;

  const gefiltert = docs.filter((d) => {
    if (fObjekt && d.prop_id !== fObjekt) return false;
    if (fMieter && d.mieter_id !== fMieter) return false;
    if (fArt && (d.kategorie ?? "") !== fArt) return false;
    if (q) {
      const hay = `${d.titel ?? ""} ${d.datei_name ?? ""} ${d.inhalt ?? ""}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  const reset = () => {
    setFObjekt(""); setFMieter(""); setFArt(""); setQ("");
  };
  const aktiveFilter = fObjekt || fMieter || fArt || q;

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-kicker">Verwaltung · Belege</div>
          <div className="topbar-title">Archiv</div>
          <div className="topbar-sub">Alle Dokumente & Verträge — gefiltert nach Objekt, Mieter und Art</div>
        </div>
        <button type="button" className="btn btn-gold" onClick={() => setShowUpload((s) => !s)}>
          {showUpload ? <><X size={14} style={{ verticalAlign: "-2px" }} /> Schließen</> : <><Plus size={14} style={{ verticalAlign: "-2px" }} /> Dokument hochladen</>}
        </button>
      </div>
      <hr className="topbar-rule" />

      <details style={{ marginBottom: 16, background: "var(--bg3)", border: "1px solid var(--line)", borderRadius: 8, padding: "0 14px", fontSize: 12.5 }}>
        {/* Abstand am summary statt am details: So ist der ganze Kasten antippbar, nicht nur die Textzeile. */}
        <summary style={{ cursor: "pointer", color: "var(--muted)", fontWeight: 500, padding: "10px 0" }}>
          Wie lange muss ich Belege aufbewahren?
        </summary>
        <ul style={{ margin: "0 0 2px", paddingLeft: 18, color: "var(--muted)", lineHeight: 1.7 }}>
          <li>Belege zu Mieteinnahmen und Werbungskosten: mindestens bis der Steuerbescheid bestandskräftig ist (Faustregel ~5 Jahre).</li>
          <li>Handwerker-/Grundstücksrechnungen: <strong>2 Jahre</strong> gesetzliche Pflicht auch für Privatpersonen (§ 14b UStG).</li>
          <li>Bei Überschusseinkünften über 500.000 €/Jahr: <strong>6 Jahre</strong> (§ 147a AO).</li>
          <li>Als Unternehmer (eigene Vermietungs-/Firmenbuchhaltung): Rechnungen/Buchungsbelege <strong>8 Jahre</strong>.</li>
        </ul>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--faint)", margin: "6px 0 10px" }}>Anhaltspunkte ohne Gewähr, keine Steuerberatung.</p>
      </details>

      {/* Upload */}
      {showUpload && (
        <form action={createDokument} className="form-box" style={{ marginBottom: 20 }}>
          <h3>Dokument ablegen</h3>
          <p>Vertrag, Schreiben, Abrechnung o. ä. — mit Objekt, Mieter und Art ablegen.</p>
          <div className="form-row">
            <div className="form-group">
              <label>Titel *</label>
              <input type="text" name="titel" placeholder="z. B. Mietvertrag Wohnung 2" required />
            </div>
            <div className="form-group">
              <label>Art</label>
              <select name="kategorie" defaultValue="Mietvertrag">
                {ARCHIV_ARTEN.map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Objekt</label>
              <select name="prop_id" defaultValue="">
                <option value="">– keines –</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Mieter</label>
              <select name="mieter_id" defaultValue="">
                <option value="">– keiner –</option>
                {mieter.map((m) => <option key={m.id} value={m.id}>{mieterName.get(m.id)}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row single">
            <div className="form-group">
              <label>Notiz (optional)</label>
              <input type="text" name="inhalt" placeholder="z. B. Laufzeit, Besonderheiten" />
            </div>
          </div>
          <div className="form-row single">
            <div className="form-group">
              <label>Datei (PDF/Bild · max. 8 MB)</label>
              <input type="file" name="datei" accept="application/pdf,image/*" />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setShowUpload(false)}>Abbrechen</button>
            <SubmitButton>Im Archiv speichern</SubmitButton>
          </div>
        </form>
      )}

      {/* Filter — sofort anwendend, gleiches Design wie app-weit */}
      <div className="filterbar">
        <button className="fb-toggle" type="button" aria-expanded={fbOpen} onClick={() => setFbOpen((o) => !o)}>
          <SlidersHorizontal size={15} /> Filter{aktiveFilter ? " (aktiv)" : ""}
        </button>
        <div className={`fb-controls${fbOpen ? " open" : ""}`}>
          <Select
            value={fObjekt}
            ariaLabel="Objekt"
            icon={Building2}
            onChange={setFObjekt}
            options={[{ value: "", label: "Alle Objekte" }, ...properties.map((p) => ({ value: p.id, label: p.bezeichnung }))]}
          />
          <Select
            value={fMieter}
            ariaLabel="Mieter"
            icon={User}
            onChange={setFMieter}
            options={[{ value: "", label: "Alle Mieter" }, ...mieter.map((m) => ({ value: m.id, label: mieterName.get(m.id) ?? "Mieter" }))]}
          />
          <Select
            value={fArt}
            ariaLabel="Art"
            icon={Tag}
            onChange={setFArt}
            options={[{ value: "", label: "Alle Arten" }, ...ARCHIV_ARTEN.map((a) => ({ value: a, label: a }))]}
          />
          <input className="set-input fb-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Titel, Dateiname…" aria-label="Suche" />
        </div>
        <span className="fb-spacer" />
        <div className="fb-chips">
          <span style={{ fontSize: 12, color: "var(--muted)" }}>{gefiltert.length} / {docs.length}</span>
          {aktiveFilter && (
            <button type="button" className="fb-reset" onClick={reset}>Zurücksetzen</button>
          )}
        </div>
      </div>

      {/* Liste */}
      {gefiltert.length === 0 ? (
        <div className="empty">
          <Archive className="empty-icon" size={36} color="var(--faint)" />
          <p>{docs.length === 0 ? "Noch keine Dokumente im Archiv." : "Keine Dokumente für diese Filter."}</p>
          {/* Der Leerzustand nannte kein Weiter — der Upload-Knopf oben war
              leicht zu uebersehen (Audit: "Archiv ohne Upload-CTA"). */}
          {docs.length === 0 && (
            <button type="button" className="btn btn-outline" style={{ marginTop: 10 }} onClick={() => setShowUpload(true)}>
              <Upload size={14} style={{ verticalAlign: "-2px" }} /> Erstes Dokument hochladen
            </button>
          )}
        </div>
      ) : (
        <div className="section">
          {/* Eine Zeile je Dokument (03.10.2026): Titel, darunter Art · Objekt · Mieter; die Notiz
              steht im Bearbeiten-Dialog und als Tooltip, nicht mehr als dritte Zeile. */}
          <div className="section-body listen">
            {gefiltert.map((d) => (
              <div
                key={d.id}
                className="listen-zeile"
                style={{ cursor: "pointer" }}
                tabIndex={0}
                role="button"
                aria-label="Dokument bearbeiten"
                title={d.inhalt ?? undefined}
                onClick={() => setEditId(d.id)}
                onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); setEditId(d.id); } }}
              >
                <span className="listen-icon">{fileIcon(d.datei_type)}</span>
                <span className="listen-zeile-text">
                  <span className="listen-zeile-titel">{d.titel || d.datei_name || "Dokument"}</span>
                  <span className="listen-zeile-sub">
                    {[d.kategorie, d.prop_id ? propName.get(d.prop_id) : null, d.mieter_id ? mieterName.get(d.mieter_id) : null].filter(Boolean).join(" · ") || "ohne Zuordnung"}
                  </span>
                </span>
                <span className="listen-zeile-datum">{deDate(d.created_at)}</span>
                {d.datei_name && (
                  <span style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <a href={`/archiv/${d.id}/datei`} target="_blank" rel="noopener noreferrer" className="delete-btn" title={`Öffnen: ${d.datei_name}`} aria-label="Datei öffnen" style={{ color: "var(--muted)", display: "inline-grid", placeItems: "center" }}><Eye size={15} /></a>
                    <a href={`/archiv/${d.id}/datei?download=1`} className="delete-btn" title="Herunterladen" aria-label="Datei herunterladen" style={{ color: "var(--muted)", display: "inline-grid", placeItems: "center" }}><Download size={15} /></a>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {offenDoc && (
        <RowDialog title="Dokument bearbeiten" onClose={() => setEditId(null)}>
          <form
            // update/deleteDokument WERFEN. Im Formular ersetzte der Fehler die
            // Seite durch die Fehlerseite; im onClick verpuffte er als nicht
            // abgefangenes Promise — das Löschen scheiterte STILL (30.09.2026).
            action={async (fd) => {
              try {
                await updateDokument(offenDoc.id, fd);
                setEditId(null);
              } catch {
                // Die Server-Meldung kommt in Produktion nicht an (Next schwärzt geworfene
                // Fehler) — deshalb nennt der Text den häufigsten Grund selbst.
                toast("Speichern fehlgeschlagen. Ist das Dokument im Mieterportal zugestellt, bleiben Datei, Mieter und Objekt fest — erst auf der Mieterseite zurückziehen.", "error");
              }
            }}
            className="form-box"
            style={{ padding: 0, border: "none", background: "none", maxWidth: "none" }}
          >
            <div className="form-row">
              <div className="form-group"><label>Titel *</label><input name="titel" defaultValue={offenDoc.titel ?? ""} required /></div>
              <div className="form-group"><label>Art</label>
                <select name="kategorie" defaultValue={offenDoc.kategorie ?? "Sonstiges"}>{ARCHIV_ARTEN.map((a) => <option key={a}>{a}</option>)}</select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Objekt</label>
                <select name="prop_id" defaultValue={offenDoc.prop_id ?? ""}>
                  <option value="">– keines –</option>
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Mieter</label>
                <select name="mieter_id" defaultValue={offenDoc.mieter_id ?? ""}>
                  <option value="">– keiner –</option>
                  {mieter.map((m) => <option key={m.id} value={m.id}>{mieterName.get(m.id)}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row single">
              <div className="form-group"><label>Notiz (optional)</label><input name="inhalt" defaultValue={offenDoc.inhalt ?? ""} /></div>
            </div>
            <div className="form-row single">
              <div className="form-group">
                <label>Datei ersetzen (optional · PDF/Bild · max. 8 MB)</label>
                {offenDoc.datei_name && <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Aktuell: {offenDoc.datei_name} — neue Datei wählen zum Ersetzen.</div>}
                <input type="file" name="datei" accept="application/pdf,image/*" />
              </div>
            </div>
            <div className="form-actions" style={{ justifyContent: "space-between" }}>
              <button data-demo-sperre
                type="button"
                className="btn btn-ghost"
                onClick={async () => {
                  if (!confirm(`„${offenDoc.titel || "Dokument"}“ aus dem Archiv löschen?`)) return;
                  try {
                    await deleteDokument(offenDoc.id);
                    setEditId(null);
                  } catch {
                    toast("Löschen fehlgeschlagen. Ist das Dokument im Mieterportal zugestellt, erst auf der Mieterseite zurückziehen.", "error");
                  }
                }}
              >
                Löschen
              </button>
              <SubmitButton>Speichern</SubmitButton>
            </div>
          </form>
        </RowDialog>
      )}
    </div>
  );
}
