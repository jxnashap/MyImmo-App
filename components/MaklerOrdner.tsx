"use client";

// Makler-Ordner: schlanke Käufer-Checkliste (6 Kern-Dokumente) mit Upload
// (base64 ≤ 8 MB), Abhaken, Datum, Fortschritts-Ring. Kernprinzip
// Datensparsamkeit: Rohdaten (Gehalt, Kontoauszüge, Ausweis) gehören an die
// Bank bzw. werden nur gezeigt — nicht an den Makler herausgegeben.

import { useMemo, useRef, useState, useTransition } from "react";
import { FolderClosed, Upload, Eye, Download, X, Check, TriangleAlert, Info } from "lucide-react";
import { useToast } from "@/components/Toast";
import { MAKLER_CHECKLISTE, type MaklerDok, type MaklerItem } from "@/lib/makler";
import {
  setMaklerStatus, setMaklerDatum, uploadMaklerDatei, removeMaklerDatei,
} from "@/lib/actions/makler";

const LEER = (key: string): MaklerDok => ({
  item_key: key, status: "offen", notiz: null, datum: null,
  datei_name: null, datei_type: null, datei_size: null,
});

function fmtSize(b: number | null): string {
  if (!b) return "";
  return b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;
}

const BADGE: Record<MaklerDok["status"], { label: string; bg: string; fg: string }> = {
  offen: { label: "Offen", bg: "var(--bg4, #2a2722)", fg: "var(--muted)" },
  hochgeladen: { label: "Hochgeladen", bg: "rgba(212,175,90,0.15)", fg: "var(--gold)" },
  erledigt: { label: "Erledigt", bg: "rgba(74,157,111,0.15)", fg: "var(--green, #4a9d6f)" },
};

export default function MaklerOrdner({ initialDocs }: { initialDocs: MaklerDok[] }) {
  const toast = useToast();
  const [docs, setDocs] = useState<Record<string, MaklerDok>>(() => {
    const m: Record<string, MaklerDok> = {};
    for (const it of MAKLER_CHECKLISTE) m[it.key] = LEER(it.key);
    for (const d of initialDocs) m[d.item_key] = { ...m[d.item_key], ...d };
    return m;
  });
  const [pending, start] = useTransition();
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const erledigt = useMemo(
    () => MAKLER_CHECKLISTE.filter((i) => docs[i.key]?.status === "erledigt").length,
    [docs],
  );
  const total = MAKLER_CHECKLISTE.length;
  const pct = Math.round((erledigt / total) * 100);

  function apply(dok: MaklerDok) {
    setDocs((p) => ({ ...p, [dok.item_key]: { ...p[dok.item_key], ...dok } }));
  }

  function toggleErledigt(item: MaklerItem) {
    const cur = docs[item.key];
    const next = cur.status === "erledigt" ? (cur.datei_name ? "hochgeladen" : "offen") : "erledigt";
    start(async () => {
      try { apply(await setMaklerStatus(item.key, next)); }
      catch (e) { toast(e instanceof Error ? e.message : "Fehler beim Speichern."); }
    });
  }

  function onDatum(item: MaklerItem, datum: string) {
    start(async () => {
      try { apply(await setMaklerDatum(item.key, datum || null)); }
      catch (e) { toast(e instanceof Error ? e.message : "Fehler beim Speichern."); }
    });
  }

  function onFile(item: MaklerItem, file: File | undefined) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) { toast("Datei zu groß (max. 8 MB)."); return; }
    const fd = new FormData();
    fd.set("datei", file);
    start(async () => {
      try { apply(await uploadMaklerDatei(item.key, fd)); toast("Datei hinterlegt."); }
      catch (e) { toast(e instanceof Error ? e.message : "Upload fehlgeschlagen."); }
    });
  }

  function onRemove(item: MaklerItem) {
    start(async () => {
      try { apply(await removeMaklerDatei(item.key)); }
      catch (e) { toast(e instanceof Error ? e.message : "Fehler beim Entfernen."); }
    });
  }

  const ring = `conic-gradient(var(--gold) ${pct * 3.6}deg, var(--line) 0deg)`;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Kopf: Titel + Fortschritts-Ring */}
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <FolderClosed size={20} color="var(--gold)" />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Makler-Ordner</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Dein Käufer-Paket für Makler &amp; Verkäufer</div>
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: ring, display: "grid", placeItems: "center" }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--bg2)", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{pct}%</div>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{erledigt}/{total}<br />erledigt</div>
        </div>
      </div>

      {/* Faustregel-Box: Datensparsamkeit */}
      <div style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "11px 13px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--bg3)" }}>
        <Info size={15} color="var(--gold)" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
          <strong style={{ color: "var(--text)" }}>Faustregel:</strong> Der Makler bekommt <strong>Vertrauens- und
          Ergebnis-Dokumente</strong> (Finanzierungsbestätigung, Selbstauskunft, SCHUFA-BonitätsCheck, Ausweis nur zeigen).
          Die <strong>Rohdaten</strong> (Gehaltsabrechnungen, Kontoauszüge) gehen an die <strong>Bank</strong>, nicht an den Makler.
          Eine gesetzliche Pflicht zur Vorlage gibt es nicht — wer früh liefert, hat aber einen Wettbewerbsvorteil.
        </div>
      </div>

      {/* Checkliste */}
      <div style={{ display: "grid", gap: 8 }}>
        {MAKLER_CHECKLISTE.map((item) => {
          const d = docs[item.key];
          const b = BADGE[d.status];
          return (
            <div key={item.key} style={{ padding: "12px 14px", borderRadius: 11, background: "var(--bg2)", border: "1px solid var(--line)" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                {/* Abhaken */}
                <button type="button" onClick={() => toggleErledigt(item)} disabled={pending}
                  title={d.status === "erledigt" ? "Wieder öffnen" : "Als erledigt markieren"}
                  style={{
                    flexShrink: 0, width: 22, height: 22, marginTop: 1, borderRadius: 6, cursor: "pointer",
                    border: `1.5px solid ${d.status === "erledigt" ? "var(--green, #4a9d6f)" : "var(--line2)"}`,
                    background: d.status === "erledigt" ? "var(--green, #4a9d6f)" : "transparent",
                    display: "grid", placeItems: "center",
                  }}>
                  {d.status === "erledigt" && <Check size={14} color="#fff" />}
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{item.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: b.bg, color: b.fg }}>{b.label}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 3, lineHeight: 1.45 }}>{item.hinweis}</div>

                  {item.datensparsam && (
                    <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginTop: 6, padding: "6px 9px", borderRadius: 7, background: "rgba(240,160,48,0.08)", border: "1px solid var(--amber)" }}>
                      <TriangleAlert size={12} color="var(--amber)" style={{ flexShrink: 0, marginTop: 1 }} />
                      <span style={{ fontSize: 11, color: "var(--text)" }}>Datensparsam behandeln — nicht als Rohdaten an den Makler geben.</span>
                    </div>
                  )}

                  {/* Datei-Chip oder Upload */}
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 9 }}>
                    {d.datei_name ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 10px", borderRadius: 8, background: "var(--bg3)", border: "1px solid var(--line)" }}>
                        <span style={{ fontSize: 11.5, color: "var(--text)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.datei_name}</span>
                        {d.datei_size ? <span style={{ fontSize: 10.5, color: "var(--faint)" }}>{fmtSize(d.datei_size)}</span> : null}
                        <a href={`/makler/datei/${item.key}`} target="_blank" rel="noopener noreferrer" title="Ansehen" style={{ color: "var(--muted)", display: "grid", placeItems: "center" }}><Eye size={14} /></a>
                        <a href={`/makler/datei/${item.key}?download=1`} title="Herunterladen" style={{ color: "var(--muted)", display: "grid", placeItems: "center" }}><Download size={14} /></a>
                        <button type="button" onClick={() => onRemove(item)} disabled={pending} title="Entfernen" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", display: "grid", placeItems: "center", padding: 0 }}><X size={14} /></button>
                      </div>
                    ) : (
                      <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} disabled={pending}
                        onClick={() => fileRefs.current[item.key]?.click()}>
                        <Upload size={13} style={{ verticalAlign: "-2px" }} /> Datei hochladen
                      </button>
                    )}
                    <input ref={(el) => { fileRefs.current[item.key] = el; }} type="file" hidden
                      accept="application/pdf,image/*"
                      onChange={(e) => { onFile(item, e.target.files?.[0]); e.currentTarget.value = ""; }} />

                    <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--faint)", marginLeft: "auto" }}>
                      Datum
                      <input type="date" value={d.datum ?? ""} onChange={(e) => onDatum(item, e.target.value)}
                        style={{ padding: "4px 7px", borderRadius: 7, border: "1px solid var(--line2)", background: "var(--bg3)", fontSize: 11.5, color: "var(--text)" }} />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 10.5, color: "var(--faint)", margin: 0, display: "flex", gap: 7 }}>
        <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Deine Dokumente sind über die Zugriffskontrolle (RLS) nur deinem Konto zugänglich. Du gibst sie
          selbst an Makler/Verkäufer weiter — MyImmo verschickt nichts automatisch.</span>
      </p>
    </div>
  );
}
