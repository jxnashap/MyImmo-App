"use client";
import SubmitButton from "@/components/SubmitButton";

import { useMemo, useState } from "react";
import { Building2, User, Tag, X, Download, Eye, FileText, Image as ImageIcon, Paperclip, Archive, Home, Plus, SlidersHorizontal } from "lucide-react";
import Select from "@/components/filters/Select";
import RowDialog from "@/components/RowDialog";
import { createDokument, updateDokument, deleteDokument } from "@/lib/actions/archiv";
import type { ArchivDoc } from "@/app/archiv/page";
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

const ART_BADGE: Record<string, string> = {
  "Mietvertrag": "badge-gold",
  "Nebenkostenabrechnung": "badge-teal",
  "Versicherung": "badge-green",
  "Schreiben / Brief": "badge-teal",
  "Übergabeprotokoll": "badge-gold",
  "Rechnung": "badge-red",
  "Grundbuch / Kauf": "badge-green",
  "Energieausweis": "badge-teal",
  "Sonstiges": "badge-teal",
};

const fileIcon = (type: string | null) =>
  type === "application/pdf" ? <FileText size={22} /> : type?.startsWith("image/") ? <ImageIcon size={22} /> : <Paperclip size={22} />;

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
          <div className="topbar-title">Archiv</div>
          <div className="topbar-sub">Alle Dokumente & Verträge — gefiltert nach Objekt, Mieter und Art</div>
        </div>
        <button type="button" className="btn btn-gold" onClick={() => setShowUpload((s) => !s)}>
          {showUpload ? <><X size={14} style={{ verticalAlign: "-2px" }} /> Schließen</> : <><Plus size={14} style={{ verticalAlign: "-2px" }} /> Dokument hochladen</>}
        </button>
      </div>

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
          <input className="set-input fb-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suche: Titel, Dateiname…" aria-label="Suche" />
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
        </div>
      ) : (
        <div className="section">
          <div className="section-body" style={{ paddingTop: 4 }}>
            {gefiltert.map((d) => (
              <div
                key={d.id}
                className="row-click"
                tabIndex={0}
                role="button"
                aria-label="Dokument bearbeiten"
                onClick={() => setEditId(d.id)}
                onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); setEditId(d.id); } }}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 8px", borderBottom: "1px solid var(--line)", borderRadius: 8 }}
              >
                <div style={{ display: "flex", alignItems: "center", color: "var(--muted)" }}>{fileIcon(d.datei_type)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {d.titel || d.datei_name || "Dokument"}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4, alignItems: "center" }}>
                    {d.kategorie && <span className={`badge ${ART_BADGE[d.kategorie] || "badge-teal"}`}>{d.kategorie}</span>}
                    {d.prop_id && propName.get(d.prop_id) && <span style={{ fontSize: 11, color: "var(--muted)" }}><Home size={11} style={{ verticalAlign: "-1px" }} /> {propName.get(d.prop_id)}</span>}
                    {d.mieter_id && mieterName.get(d.mieter_id) && <span style={{ fontSize: 11, color: "var(--muted)" }}><User size={11} style={{ verticalAlign: "-1px" }} /> {mieterName.get(d.mieter_id)}</span>}
                    <span style={{ fontSize: 11, color: "var(--faint)" }}>{deDate(d.created_at)}</span>
                  </div>
                  {d.inhalt && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{d.inhalt}</div>}
                </div>
                {d.datei_name && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <a href={`/archiv/${d.id}/datei`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 5 }} title={d.datei_name}><Eye size={13} /> Öffnen</a>
                    <a href={`/archiv/${d.id}/datei?download=1`} className="delete-btn" title="Herunterladen" style={{ color: "var(--muted)", display: "inline-grid", placeItems: "center" }}><Download size={14} /></a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {offenDoc && (
        <RowDialog title="Dokument bearbeiten" onClose={() => setEditId(null)}>
          <form
            action={async (fd) => { await updateDokument(offenDoc.id, fd); setEditId(null); }}
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
              <button
                type="button"
                className="btn btn-ghost"
                onClick={async () => { if (confirm(`„${offenDoc.titel || "Dokument"}" aus dem Archiv löschen?`)) { await deleteDokument(offenDoc.id); setEditId(null); } }}
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
