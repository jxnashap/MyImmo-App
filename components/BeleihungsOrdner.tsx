"use client";

// Beleihungsordner: konditionale Bank-Checkliste mit Upload (Drag&Drop,
// base64 ≤ 8 MB), Abhaken, Fortschritts-Ring, „Aus MyImmo erzeugen" und
// Deckblatt-PDF fürs Bankpaket. Design im Einstellungs-Stil der App.

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Landmark, FileText, Upload, Eye, Download, X, Bot, Loader2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import {
  BELEIHUNG_CHECKLISTE,
  BEL_GRUPPEN,
  itemSichtbar,
  type BelDok,
  type BelItem,
  type BelKontext,
} from "@/lib/beleihung";
import {
  setBeleihungStatus,
  setBeleihungDatum,
  uploadBeleihungDatei,
  removeBeleihungDatei,
  generiereBeleihungDokument,
} from "@/lib/actions/beleihung";

type Props = {
  propId: string;
  objektName: string;
  istEtw: boolean;
  hatMieter: boolean;
  initialDocs: BelDok[];
  defaults: { darlehen: string; wunschrate: string; eigenkapital: string };
};

const LEER: BelDok = { item_key: "", status: "offen", notiz: null, datum: null, datei_name: null, datei_type: null, datei_size: null };

function fmtSize(b: number | null): string {
  if (!b) return "";
  return b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`;
}

// Fortschritts-Ring (Gold-Bogen auf var(--bg4))
function Ring({ done, total }: { done: number; total: number }) {
  const p = total > 0 ? done / total : 0;
  const R = 26, C = 2 * Math.PI * R;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={R} fill="none" stroke="var(--bg4)" strokeWidth="6" />
        <circle
          cx="32" cy="32" r={R} fill="none" stroke="var(--gold)" strokeWidth="6"
          strokeLinecap="round" strokeDasharray={`${C * p} ${C}`}
          transform="rotate(-90 32 32)" style={{ transition: "stroke-dasharray .4s ease" }}
        />
        <text x="32" y="37" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--ink)">
          {Math.round(p * 100)}%
        </text>
      </svg>
      <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
        <strong style={{ color: "var(--ink)", fontSize: 15 }}>{done}/{total}</strong><br />erledigt
      </div>
    </div>
  );
}

export default function BeleihungsOrdner({ propId, objektName, istEtw, hatMieter, initialDocs, defaults }: Props) {
  const toast = useToast();
  const [docs, setDocs] = useState<Record<string, BelDok>>(
    Object.fromEntries(initialDocs.map((d) => [d.item_key, d])),
  );
  const [modusKauf, setModusKauf] = useState(false);
  const [selbst, setSelbst] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // item_key der laufenden Aktion
  const [dragKey, setDragKey] = useState<string | null>(null);

  // Angaben & Wunsch-Konditionen (fließen ins Deckblatt-PDF)
  const [darlehen, setDarlehen] = useState(defaults.darlehen);
  const [zweck, setZweck] = useState(modusKauf ? "kauf" : "umschuldung");
  const [zinsbindung, setZinsbindung] = useState("10");
  const [tilgung, setTilgung] = useState("2");
  const [wunschrate, setWunschrate] = useState(defaults.wunschrate);
  const [eigenkapital, setEigenkapital] = useState(defaults.eigenkapital);
  const [sondertilgung, setSondertilgung] = useState("5 % p.a.");

  const ctx: BelKontext = { istEtw, hatMieter, modusKauf, selbststaendig: selbst };
  const sichtbar = useMemo(() => BELEIHUNG_CHECKLISTE.filter((i) => itemSichtbar(i, ctx)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [istEtw, hatMieter, modusKauf, selbst]);

  const dok = (key: string): BelDok => docs[key] ?? { ...LEER, item_key: key };
  const erledigt = (key: string) => dok(key).status === "erledigt";
  const doneCount = sichtbar.filter((i) => erledigt(i.key)).length;

  async function run(key: string, fn: () => Promise<BelDok>, okMsg?: string) {
    setBusy(key);
    try {
      const neu = await fn();
      setDocs((prev) => ({ ...prev, [key]: neu }));
      if (okMsg) toast(okMsg);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Fehler — bitte erneut versuchen.");
    } finally {
      setBusy(null);
    }
  }

  function uploadFile(key: string, file: File) {
    if (file.size > 8 * 1024 * 1024) { toast("Datei zu groß (max. 8 MB)."); return; }
    const fd = new FormData();
    fd.set("datei", file);
    run(key, () => uploadBeleihungDatei(propId, key, fd), "Datei gespeichert.");
  }

  const deckblattUrl = `/properties/${propId}/beleihung/deckblatt?` + new URLSearchParams({
    darlehen, zweck, zinsbindung, tilgung, wunschrate, eigenkapital, sondertilgung,
    modus: modusKauf ? "kauf" : "beleihung", selbst: selbst ? "1" : "0",
  }).toString();

  function itemZeile(item: BelItem) {
    const d = dok(item.key);
    const hatDatei = !!d.datei_name;
    const chip =
      d.status === "erledigt" ? <span className="badge badge-green">Erledigt</span> :
      d.status === "hochgeladen" ? <span className="badge badge-gold">Hochgeladen</span> :
      <span className="badge" style={{ background: "var(--bg4)", color: "var(--muted)", border: "1px solid var(--line)" }}>Offen</span>;

    return (
      <div
        key={item.key}
        onDragOver={(e) => { e.preventDefault(); setDragKey(item.key); }}
        onDragLeave={() => setDragKey((k) => (k === item.key ? null : k))}
        onDrop={(e) => {
          e.preventDefault(); setDragKey(null);
          const f = e.dataTransfer.files?.[0];
          if (f) uploadFile(item.key, f);
        }}
        style={{
          display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10,
          padding: "12px 16px", borderBottom: "1px solid var(--line)",
          background: dragKey === item.key ? "var(--gold-pale)" : undefined,
          transition: "background .15s",
        }}
      >
        <input
          type="checkbox"
          checked={erledigt(item.key)}
          disabled={busy === item.key}
          onChange={(e) =>
            run(item.key, () => setBeleihungStatus(propId, item.key, e.target.checked ? "erledigt" : hatDatei ? "hochgeladen" : "offen"))
          }
          title="Als erledigt abhaken"
          style={{ width: 17, height: 17, accentColor: "var(--gold)", flexShrink: 0 }}
        />
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, textDecoration: erledigt(item.key) ? "line-through" : undefined, opacity: erledigt(item.key) ? 0.65 : 1 }}>
            {item.label}
          </div>
          {item.hinweis && <div style={{ fontSize: 11, color: "var(--muted)" }}>{item.hinweis}</div>}
          {d.notiz && <div style={{ fontSize: 11, color: "var(--gold)" }}>{d.notiz}</div>}
        </div>
        {chip}
        {hatDatei ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, background: "var(--bg4)", border: "1px solid var(--line)", borderRadius: 20, padding: "3px 6px 3px 10px", maxWidth: 260 }}>
            <FileText size={12} style={{ flexShrink: 0 }} />
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={d.datei_name ?? ""}>{d.datei_name}</span>
            <span style={{ color: "var(--muted)", flexShrink: 0 }}>{fmtSize(d.datei_size)}</span>
            <a href={`/properties/${propId}/beleihung/datei/${item.key}`} target="_blank" rel="noopener noreferrer" title="Ansehen" style={{ display: "inline-grid", placeItems: "center", color: "var(--ink)" }}><Eye size={13} /></a>
            <a href={`/properties/${propId}/beleihung/datei/${item.key}?download=1`} title="Herunterladen" style={{ display: "inline-grid", placeItems: "center", color: "var(--ink)" }}><Download size={13} /></a>
            <button type="button" title="Datei entfernen" onClick={() => run(item.key, () => removeBeleihungDatei(propId, item.key), "Datei entfernt.")} style={{ display: "inline-grid", placeItems: "center", background: "none", border: "none", cursor: "pointer", color: "var(--red)", padding: 0 }}><X size={13} /></button>
          </span>
        ) : (
          <label className="btn btn-ghost" style={{ fontSize: 11, cursor: "pointer" }}>
            {busy === item.key ? <Loader2 size={13} style={{ animation: "spin .8s linear infinite" }} /> : <Upload size={13} />} Hochladen
            <input
              type="file"
              accept="application/pdf,image/*"
              style={{ display: "none" }}
              disabled={busy === item.key}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(item.key, f); e.target.value = ""; }}
            />
          </label>
        )}
        {item.auto && !hatDatei && (
          <button
            type="button"
            className="btn btn-gold"
            style={{ fontSize: 11 }}
            disabled={busy === item.key}
            onClick={() => run(item.key, () => generiereBeleihungDokument(propId, item.key), "Dokument aus MyImmo erzeugt.")}
          >
            {busy === item.key ? <Loader2 size={13} style={{ animation: "spin .8s linear infinite" }} /> : <Bot size={13} />} Aus MyImmo erzeugen
          </button>
        )}
        <input
          type="date"
          value={d.datum ?? ""}
          onChange={(e) => run(item.key, () => setBeleihungDatum(propId, item.key, e.target.value || null))}
          title="Datum des Dokuments (optional)"
          style={{ fontSize: 11, padding: "4px 6px", background: "var(--bg3)", border: "1px solid var(--line)", borderRadius: 8, color: d.datum ? "var(--ink)" : "var(--muted)", width: 118 }}
        />
      </div>
    );
  }

  const toggleStyle = (aktiv: boolean): React.CSSProperties => ({
    fontSize: 11.5, padding: "5px 12px", borderRadius: 20, cursor: "pointer",
    border: `1px solid ${aktiv ? "var(--gold-dim)" : "var(--line)"}`,
    background: aktiv ? "var(--gold-pale)" : "var(--bg3)",
    color: aktiv ? "var(--gold)" : "var(--muted)", fontWeight: 600,
  });

  const inp = (label: string, value: string, set: (v: string) => void, suffix?: string) => (
    <div className="field">
      <label>{label}{suffix ? ` (${suffix})` : ""}</label>
      <input type="text" inputMode="decimal" value={value} onChange={(e) => set(e.target.value)} />
    </div>
  );

  return (
    <div className="fade-up">
      {/* Kopf */}
      <div className="settings-head" style={{ flexWrap: "wrap", rowGap: 12 }}>
        <div className="settings-avatar"><Landmark size={22} /></div>
        <div className="who">
          <h1>Beleihungsordner</h1>
          <p>{objektName} — alle Unterlagen fürs Bankgespräch</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={toggleStyle(modusKauf)} onClick={() => { setModusKauf(!modusKauf); if (!modusKauf) setZweck("kauf"); }}>
              {modusKauf ? "Modus: Kauf" : "Modus: Beleihung"}
            </button>
            <button type="button" style={toggleStyle(selbst)} onClick={() => setSelbst(!selbst)}>
              Selbstständig{selbst ? " ✓" : ""}
            </button>
          </div>
          <Ring done={doneCount} total={sichtbar.length} />
        </div>
      </div>

      {/* Gruppen */}
      {BEL_GRUPPEN.map((g) => {
        const items = sichtbar.filter((i) => i.gruppe === g.id);
        if (!items.length) return null;
        const done = items.filter((i) => erledigt(i.key)).length;
        return (
          <div className="section" key={g.id} style={{ marginBottom: 18 }}>
            <div className="section-header">
              <h3>{g.label}</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{done}/{items.length}</span>
                <div className="progress-bar" style={{ width: 90, marginTop: 0 }}>
                  <div className="progress-fill" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%`, background: "var(--gold)" }} />
                </div>
              </div>
            </div>
            {items.map(itemZeile)}
          </div>
        );
      })}

      {/* Angaben & Wunsch-Konditionen */}
      <div className="section" style={{ marginBottom: 18 }}>
        <div className="section-header"><h3>Angaben &amp; Wunsch-Konditionen</h3></div>
        <div style={{ padding: 16 }}>
          <div className="field-row">
            {inp("Darlehenshöhe", darlehen, setDarlehen, "€")}
            <div className="field">
              <label>Verwendungszweck</label>
              <select value={zweck} onChange={(e) => setZweck(e.target.value)}>
                <option value="kauf">Kauf</option>
                <option value="modernisierung">Modernisierung</option>
                <option value="umschuldung">Umschuldung</option>
                <option value="kapital">Kapitalbeschaffung</option>
              </select>
            </div>
          </div>
          <div className="field-row">
            {inp("Zinsbindung", zinsbindung, setZinsbindung, "Jahre")}
            {inp("Anfängliche Tilgung", tilgung, setTilgung, "%")}
          </div>
          <div className="field-row">
            {inp("Wunschrate", wunschrate, setWunschrate, "€/Monat")}
            {inp("Eigenkapital", eigenkapital, setEigenkapital, "€")}
          </div>
          <div className="field-row">
            {inp("Sondertilgung", sondertilgung, setSondertilgung)}
            <div />
          </div>
        </div>
      </div>

      {/* Bankpaket-Leiste */}
      <div className="section" style={{ marginBottom: 24 }}>
        <div style={{ padding: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <a href={deckblattUrl} target="_blank" rel="noopener noreferrer" className="btn btn-gold" style={{ fontSize: 12 }}>
            <FileText size={14} /> Deckblatt / Übersicht als PDF
          </a>
          <span className="badge" style={{ background: "var(--bg4)", color: "var(--muted)", border: "1px solid var(--line)" }}>
            Freigabe-Link für die Bank — folgt (Phase 2)
          </span>
          <Link href={`/properties/${propId}`} className="btn btn-ghost" style={{ fontSize: 12, marginLeft: "auto" }}>← Zum Objekt</Link>
        </div>
      </div>
    </div>
  );
}
