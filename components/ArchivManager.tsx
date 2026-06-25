"use client";

import { useMemo, useState } from "react";
import DeleteButton from "@/components/DeleteButton";
import { createDokument, deleteDokument } from "@/lib/actions/archiv";
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
  type === "application/pdf" ? "📄" : type?.startsWith("image/") ? "🖼️" : "📎";

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
  const [showUpload, setShowUpload] = useState(false);

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
          <div className="topbar-title">🗄 Archiv</div>
          <div className="topbar-sub">Alle Dokumente & Verträge — gefiltert nach Objekt, Mieter und Art</div>
        </div>
        <button type="button" className="btn btn-gold" onClick={() => setShowUpload((s) => !s)}>
          {showUpload ? "× Schließen" : "＋ Dokument hochladen"}
        </button>
      </div>

      {/* Upload */}
      {showUpload && (
        <form action={createDokument} className="form-box" style={{ marginBottom: 20 }}>
          <h3>📤 Dokument ablegen</h3>
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
            <button type="submit" className="btn btn-gold">Im Archiv speichern</button>
          </div>
        </form>
      )}

      {/* Filter */}
      <div className="section">
        <div className="section-header"><h3>Filter</h3><span style={{ fontSize: 11, color: "var(--muted)" }}>{gefiltert.length} / {docs.length} Dokument(e)</span></div>
        <div className="section-body" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Objekt</label>
            <select className="input" value={fObjekt} onChange={(e) => setFObjekt(e.target.value)} style={{ minWidth: 160 }}>
              <option value="">Alle Objekte</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Mieter</label>
            <select className="input" value={fMieter} onChange={(e) => setFMieter(e.target.value)} style={{ minWidth: 160 }}>
              <option value="">Alle Mieter</option>
              {mieter.map((m) => <option key={m.id} value={m.id}>{mieterName.get(m.id)}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Art</label>
            <select className="input" value={fArt} onChange={(e) => setFArt(e.target.value)} style={{ minWidth: 160 }}>
              <option value="">Alle Arten</option>
              {ARCHIV_ARTEN.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, flex: "1 1 160px" }}>
            <label>Suche</label>
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Titel, Dateiname…" />
          </div>
          {aktiveFilter && (
            <button type="button" className="btn btn-ghost" onClick={reset} style={{ fontSize: 12 }}>× Zurücksetzen</button>
          )}
        </div>
      </div>

      {/* Liste */}
      {gefiltert.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🗄</div>
          <p>{docs.length === 0 ? "Noch keine Dokumente im Archiv." : "Keine Dokumente für diese Filter."}</p>
        </div>
      ) : (
        <div className="section">
          <div className="section-body" style={{ paddingTop: 4 }}>
            {gefiltert.map((d) => (
              <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ fontSize: 22 }}>{fileIcon(d.datei_type)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {d.titel || d.datei_name || "Dokument"}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4, alignItems: "center" }}>
                    {d.kategorie && <span className={`badge ${ART_BADGE[d.kategorie] || "badge-teal"}`}>{d.kategorie}</span>}
                    {d.prop_id && propName.get(d.prop_id) && <span style={{ fontSize: 11, color: "var(--muted)" }}>🏠 {propName.get(d.prop_id)}</span>}
                    {d.mieter_id && mieterName.get(d.mieter_id) && <span style={{ fontSize: 11, color: "var(--muted)" }}>👤 {mieterName.get(d.mieter_id)}</span>}
                    <span style={{ fontSize: 11, color: "var(--faint)" }}>{deDate(d.created_at)}</span>
                  </div>
                  {d.inhalt && <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>{d.inhalt}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {d.datei_name && (
                    <>
                      <a href={`/archiv/${d.id}/datei`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ fontSize: 12 }} title={d.datei_name}>👁 Öffnen</a>
                      <a href={`/archiv/${d.id}/datei?download=1`} className="delete-btn" title="Herunterladen" style={{ color: "var(--muted)" }}>⬇</a>
                    </>
                  )}
                  <DeleteButton action={deleteDokument.bind(null, d.id)} className="delete-btn" label="✕" confirmText={`„${d.titel || "Dokument"}" aus dem Archiv löschen?`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
