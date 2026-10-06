"use client";
import { TriangleAlert } from "lucide-react";

// Beleihungsordner: konditionale Bank-Checkliste mit Upload (Drag&Drop,
// base64 ≤ 8 MB), Abhaken, Fortschritts-Ring, „Aus MyImmo erzeugen" und
// Deckblatt-PDF fürs Bankpaket. Design im Einstellungs-Stil der App.

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Landmark, FileText, Upload, Eye, Download, X, Bot, Loader2, Share2, Copy, Mail, MessageSquare } from "lucide-react";
import { useToast } from "@/components/Toast";
import { useReAuth } from "@/components/ReAuthDialog";
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
  createFreigabe,
  widerrufeFreigabe,
  type Freigabe,
} from "@/lib/actions/beleihung";
import { teilbarerLink } from "@/lib/appUrl";
import { useModalFokus } from "@/lib/modalFokus";
import { abrufeJeLink, abrufZusammenfassung, type Abruf } from "@/lib/freigabeAbrufe";
import { zugangsMailLink } from "@/lib/zugangsMail";

export type Rueckmeldung = {
  id: string;
  token: string;
  name: string | null;
  bank: string | null;
  kontakt: string | null;
  nachricht: string | null;
  fehlend: string[] | null;
  created_at: string | null;
};

type Props = {
  propId: string;
  objektName: string;
  istEtw: boolean;
  hatMieter: boolean;
  initialDocs: BelDok[];
  initialFreigaben: Freigabe[];
  rueckmeldungen: Rueckmeldung[];
  /** Abruf-Protokoll der Bank-Links (05.10.2026). */
  abrufe?: Abruf[];
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

export default function BeleihungsOrdner({ propId, objektName, istEtw, hatMieter, initialDocs, initialFreigaben, rueckmeldungen, abrufe = [], defaults }: Props) {
  const toast = useToast();
  const [docs, setDocs] = useState<Record<string, BelDok>>(
    Object.fromEntries(initialDocs.map((d) => [d.item_key, d])),
  );
  // Freigaben (Phase 2) lokal führen; Teilen-Modal-Zustand
  const [freigaben, setFreigaben] = useState<Freigabe[]>(initialFreigaben);
  const [showShare, setShowShare] = useState(false);
  const teilenRef = useModalFokus<HTMLDivElement>(() => setShowShare(false), showShare);
  const [shareKeys, setShareKeys] = useState<Set<string>>(new Set());
  const [shareTage, setShareTage] = useState("14");
  const [shareBusy, setShareBusy] = useState(false);
  // Bank-Freigabe verlangt eine frische Anmeldung (Server prüft, Dialog holt nach).
  const { absichern: freigabeAbsichern, dialog: reAuthDialog } = useReAuth();
  // Nach dem Erstellen: Link, einmalig angezeigter Code, Empfänger (05.10.2026).
  const [neuerLink, setNeuerLink] = useState<{ link: string; code: string; an: string; ablauf: string } | null>(null);
  const [bankEmail, setBankEmail] = useState("");
  const [modusKauf, setModusKauf] = useState(false);
  const [selbst, setSelbst] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // item_key der laufenden Aktion
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [protokoll, setProtokoll] = useState<string | null>(null);
  const abrufeJe = useMemo(() => abrufeJeLink(abrufe), [abrufe]);

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
      toast(e instanceof Error ? e.message : "Fehler — bitte erneut versuchen.", "error");
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

  // ===== Freigabe-Link (Phase 2) =====
  const angabenObjekt = { darlehen, zweck, zinsbindung, tilgung, wunschrate, eigenkapital, sondertilgung };
  // Teilbar = alles, was eine Datei hat.
  const teilbareItems = BELEIHUNG_CHECKLISTE.filter((i) => !!dok(i.key).datei_name);
  const bonitaetGewaehlt = teilbareItems.some((i) => i.gruppe === "bonitaet" && shareKeys.has(i.key));

  function openShare() {
    // Default: Objekt/Vermietung/ETW AN, Bonität AUS (bewusste Entscheidung).
    setShareKeys(new Set(teilbareItems.filter((i) => i.gruppe !== "bonitaet").map((i) => i.key)));
    setNeuerLink(null);
    setShowShare(true);
  }

  function kopiereLink(token: string) {
    navigator.clipboard.writeText(teilbarerLink(`/beleihung/${token}`)).then(
      () => toast("Link kopiert."),
      () => toast("Kopieren fehlgeschlagen.", "error"),
    );
  }

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
            className="btn btn-outline"
            style={{ fontSize: 11 }}
            disabled={busy === item.key}
            onClick={() => run(item.key, () => generiereBeleihungDokument(propId, item.key), "Dokument aus MyImmo erzeugt.")}
          >
            {busy === item.key ? <Loader2 size={13} style={{ animation: "spin .8s linear infinite" }} /> : <Bot size={13} />} Aus MyImmo erzeugen
          </button>
        )}
        {/* Das Feld stand vorher ohne jede Beschriftung in jeder der ~25 Zeilen —
            mit Tooltip, den am Handy niemand sieht. Ein kurzes „Stand" davor
            sagt in jeder Zeile, welches Datum gemeint ist. */}
        <label
          style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: "var(--text-xs)", color: "var(--muted)", whiteSpace: "nowrap" }}
          title="Datum, das auf dem Dokument steht (Ausstellung bzw. Stichtag) — optional"
        >
          Stand
          <input
            type="date"
            value={d.datum ?? ""}
            onChange={(e) => run(item.key, () => setBeleihungDatum(propId, item.key, e.target.value || null))}
            aria-label={`Dokumentdatum: ${item.label}`}
            style={{ fontSize: 11, padding: "4px 6px", background: "var(--bg3)", border: "1px solid var(--line)", borderRadius: 8, color: d.datum ? "var(--ink)" : "var(--muted)", width: 118 }}
          />
        </label>
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
      {reAuthDialog}
      {/* Kopf */}
      <div style={{ marginBottom: 12 }}>
        <Link href={`/properties/${propId}`} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>← Zum Objekt</Link>
      </div>
      <div className="settings-head" style={{ flexWrap: "wrap", rowGap: 12 }}>
        <div className="settings-avatar"><Landmark size={22} /></div>
        <div className="who">
          <div className="topbar-kicker" style={{ marginBottom: 4 }}>Immobilie · Bankunterlagen</div>
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
                  <div className="progress-fill" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%`, background: "var(--gold-fill)" }} />
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
      <div className="section" style={{ marginBottom: 18 }}>
        <div style={{ padding: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <a href={deckblattUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ fontSize: 12 }}>
            <FileText size={14} /> Deckblatt / Übersicht als PDF
          </a>
          <button type="button" className="btn btn-gold" style={{ fontSize: 12 }} onClick={openShare}>
            <Share2 size={14} /> Freigabe-Link für die Bank
          </button>
          <Link href={`/properties/${propId}`} className="btn btn-ghost" style={{ fontSize: 12, marginLeft: "auto" }}>← Zum Objekt</Link>
        </div>
      </div>

      {/* Freigabe-Links — auch widerrufene, damit ihr Abruf-Protokoll sichtbar bleibt (05.10.2026):
          Wer einen Link aus Sorge widerruft, will gerade dann wissen, was schon geladen wurde. */}
      {freigaben.length > 0 && (
        <div className="section" style={{ marginBottom: 18 }}>
          <div className="section-header"><h3>Freigabe-Links</h3></div>
          {freigaben.slice(0, 10).map((f) => {
            const abgelaufen = new Date(f.ablauf) < new Date();
            const anz = rueckmeldungen.filter((r) => r.token === f.token).length;
            return (
              <div key={f.token} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", borderBottom: "1px solid var(--line)", flexWrap: "wrap", opacity: f.aktiv && !abgelaufen ? 1 : 0.65 }}>
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {f.empfaenger_email ?? `/beleihung/${f.token.slice(0, 8)}…`} · {f.item_keys.length} Dokument{f.item_keys.length === 1 ? "" : "e"}
                  </div>
                  <div style={{ fontSize: 11, color: abgelaufen ? "var(--red)" : "var(--muted)" }}>
                    {!f.aktiv ? "Widerrufen" : <>{abgelaufen ? "Abgelaufen am " : "Gültig bis "}{new Date(f.ablauf).toLocaleDateString("de-DE")}</>}
                    {anz > 0 && <> · <span style={{ color: "var(--gold)" }}>{anz} Rückmeldung{anz === 1 ? "" : "en"}</span></>}
                  </div>
                  <button type="button" onClick={() => setProtokoll(protokoll === f.token ? null : f.token)}
                    disabled={!abrufeJe.get(f.token)?.length}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 11, color: abrufeJe.get(f.token)?.length ? "var(--gold)" : "var(--muted)" }}>
                    {abrufZusammenfassung(abrufeJe.get(f.token))}
                  </button>
                  {protokoll === f.token && (
                    <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 3 }}>
                      {(abrufeJe.get(f.token) ?? []).map((a, n) => (
                        <li key={n} style={{ fontSize: 11.5, color: "var(--muted)", display: "flex", gap: 8 }}>
                          <span style={{ minWidth: 118 }}>{new Date(a.abgerufen_am).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                          <span style={{ color: "var(--text)" }}>{BELEIHUNG_CHECKLISTE.find((i) => i.key === a.item_key)?.label ?? a.item_key}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {f.aktiv && !abgelaufen && <>
                <button type="button" className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => kopiereLink(f.token)}><Copy size={12} /> Kopieren</button>
                <button
                  type="button" className="btn btn-ghost" style={{ fontSize: 11, color: "var(--red)" }}
                  onClick={async () => {
                    try {
                      await widerrufeFreigabe(f.token);
                      setFreigaben((prev) => prev.map((x) => (x.token === f.token ? { ...x, aktiv: false } : x)));
                      toast("Freigabe widerrufen — der Link ist sofort ungültig.");
                    } catch { toast("Widerrufen fehlgeschlagen.", "error"); }
                  }}
                >
                  <X size={12} /> Widerrufen
                </button>
                </>}
              </div>
            );
          })}
        </div>
      )}

      {/* Rückmeldungen der Bank */}
      {rueckmeldungen.length > 0 && (
        <div className="section" style={{ marginBottom: 24 }}>
          <div className="section-header">
            <h3><MessageSquare size={13} style={{ verticalAlign: "-2px" }} /> Rückmeldungen der Bank</h3>
            <span className="badge badge-gold">{rueckmeldungen.length}</span>
          </div>
          {rueckmeldungen.map((r) => (
            <div key={r.id} style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                <strong style={{ fontSize: 13 }}>{r.name || "Ohne Name"}{r.bank ? ` · ${r.bank}` : ""}</strong>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{r.created_at ? new Date(r.created_at).toLocaleString("de-DE") : ""}</span>
              </div>
              {r.kontakt && <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 4 }}>Kontakt: {r.kontakt}</div>}
              {r.nachricht && <div style={{ fontSize: 12.5, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{r.nachricht}</div>}
              {!!r.fehlend?.length && (
                <div style={{ marginTop: 6, fontSize: 11.5 }}>
                  <span style={{ color: "var(--amber)", fontWeight: 600 }}>Angeforderte Unterlagen:</span>{" "}
                  {r.fehlend.join(" · ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Teilen-Modal — per Portal an document.body, damit position:fixed
          garantiert zum Viewport zentriert (unabhängig von Vorfahren-
          Transforms wie der .fade-up-Seitenanimation). */}
      {showShare && typeof document !== "undefined" && createPortal(
        <div className="modal-overlay" onClick={() => setShowShare(false)}>
          <div
            ref={teilenRef}
            className="modal-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="beleihung-teilen-titel"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 520 }}
          >
            <h3 id="beleihung-teilen-titel" style={{ marginBottom: 4 }}>Freigabe-Link für die Bank</h3>
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 14 }}>
              Wähle, welche hochgeladenen Dokumente die Bank sehen darf. Der Link läuft automatisch ab und ist jederzeit widerrufbar.
            </p>

            {neuerLink ? (
              <>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>Zugangscode — wird nur jetzt angezeigt:</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                  <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.12em", fontFamily: "ui-monospace, monospace" }}>{neuerLink.code}</span>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => { navigator.clipboard.writeText(neuerLink.code).then(() => toast("Code kopiert.")); }}>
                    <Copy size={12} /> Code kopieren
                  </button>
                </div>
                <div style={{ background: "var(--bg3)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", fontSize: 12, wordBreak: "break-all", marginBottom: 12 }}>
                  {neuerLink.link}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a
                    className="btn btn-gold" style={{ fontSize: 12 }}
                    href={zugangsMailLink({
                      an: neuerLink.an,
                      betreff: `Finanzierungsunterlagen ${objektName}`,
                      einleitung: `über folgenden Link finden Sie die Unterlagen zum Objekt ${objektName}. Über das Formular auf der Seite können Sie sich direkt zurückmelden.`,
                      link: neuerLink.link,
                      code: neuerLink.code,
                      ablauf: neuerLink.ablauf,
                    })}
                  >
                    <Mail size={13} /> Mail an {neuerLink.an} öffnen
                  </a>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => { navigator.clipboard.writeText(neuerLink.link).then(() => toast("Link kopiert.")); }}>
                    <Copy size={13} /> Link kopieren
                  </button>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 12, marginLeft: "auto" }} onClick={() => setShowShare(false)}>Schließen</button>
                </div>
                <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "10px 0 0", lineHeight: 1.5 }}>
                  Die Mail öffnet sich in deinem Mailprogramm mit Link und Code — du kannst sie ändern oder direkt senden.
                  Sicherer: die Code-Zeile aus der Mail löschen und den Code getrennt schicken (SMS, Anruf). Wer nur den Link hat, sieht nichts.
                </p>
              </>
            ) : (
              <>
                <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 10, marginBottom: 12 }}>
                  {teilbareItems.length === 0 && (
                    <div style={{ padding: 14, fontSize: 12.5, color: "var(--muted)" }}>Noch keine Dokumente hochgeladen — erst Dateien ablegen, dann teilen.</div>
                  )}
                  {teilbareItems.map((item) => (
                    <label key={item.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderBottom: "1px solid var(--line)", cursor: "pointer", fontSize: 12.5 }}>
                      <input
                        type="checkbox"
                        checked={shareKeys.has(item.key)}
                        onChange={(e) => {
                          setShareKeys((prev) => {
                            const n = new Set(prev);
                            if (e.target.checked) n.add(item.key); else n.delete(item.key);
                            return n;
                          });
                        }}
                        style={{ accentColor: "var(--gold)" }}
                      />
                      <span style={{ flex: 1 }}>{item.label}</span>
                      {item.gruppe === "bonitaet" && <span className="badge badge-amber">Bonität</span>}
                    </label>
                  ))}
                </div>
                {bonitaetGewaehlt && (
                  <div style={{ fontSize: 11.5, color: "var(--amber)", fontWeight: 600, marginBottom: 12, lineHeight: 1.5 }}>
                    <TriangleAlert size={12} style={{ verticalAlign: "-2px" }} /> Bonitätsunterlagen enthalten persönliche/finanzielle Daten — nur bewusst teilen.
                  </div>
                )}
                <div className="field" style={{ marginBottom: 10 }}>
                  <label>E-Mail der Bank / des Beraters</label>
                  <input type="email" value={bankEmail} onChange={(e) => setBankEmail(e.target.value)} placeholder="berater@bank.de" autoComplete="off" />
                </div>
                <div className="field" style={{ marginBottom: 14 }}>
                  <label>Link gültig für</label>
                  <select value={shareTage} onChange={(e) => setShareTage(e.target.value)}>
                    <option value="7">7 Tage</option>
                    <option value="14">14 Tage</option>
                    <option value="30">30 Tage</option>
                  </select>
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowShare(false)}>Abbrechen</button>
                  <button
                    type="button" className="btn btn-gold" style={{ fontSize: 12 }}
                    disabled={shareBusy || shareKeys.size === 0 || !bankEmail.includes("@")}
                    onClick={() => freigabeAbsichern(async () => {
                      setShareBusy(true);
                      try {
                        const { freigabe: f, code } = await createFreigabe(propId, Array.from(shareKeys), angabenObjekt, Number(shareTage), bankEmail);
                        setFreigaben((prev) => [f, ...prev]);
                        setNeuerLink({ link: teilbarerLink(`/beleihung/${f.token}`), code, an: f.empfaenger_email ?? bankEmail, ablauf: f.ablauf });
                      } catch (e) {
                        toast(e instanceof Error ? e.message : "Freigabe fehlgeschlagen.", "error");
                      } finally { setShareBusy(false); }
                    })}
                  >
                    {shareBusy ? "Erzeuge…" : `Link erzeugen (${shareKeys.size})`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
