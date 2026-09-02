"use client";

// Marktwert-Einschätzungen (Verkauf-Assistent): eigenen Marktwert je Objekt
// mit Datum festhalten, nach Objekt filtern und die bisherigen Einschätzungen
// als Liste sehen. Speichert in `bewertung_historie` — die Einträge erscheinen
// dadurch auch in der Wertentwicklung des Objekts.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2, Check, TrendingUp, ClipboardList } from "lucide-react";
import { datum as fmtDatum } from "@/lib/format";
import { zahlDe0 } from "@/lib/zahl";
import { bereiteListeAuf, type EinschaetzungRow } from "@/lib/einschaetzung";
import { speichereEinschaetzung, loescheEinschaetzung, uebernehmeAlsWert } from "@/lib/actions/einschaetzung";

const eur = (n: number) => "€ " + Math.round(n).toLocaleString("de-DE");
const num = zahlDe0;

export type EinschaetzungObjekt = { id: string; name: string; wert: number | null };

export default function MarktwertEinschaetzungen({
  objekte,
  eintraege,
}: {
  objekte: EinschaetzungObjekt[];
  eintraege: EinschaetzungRow[];
}) {
  const router = useRouter();
  const heute = new Date().toISOString().slice(0, 10);
  const [objId, setObjId] = useState(objekte[0]?.id ?? "");
  const [wert, setWert] = useState("");
  const [dat, setDat] = useState(heute);
  const [notiz, setNotiz] = useState("");
  const [filter, setFilter] = useState<string>("alle");
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const nameOf = useMemo(() => new Map(objekte.map((o) => [o.id, o.name])), [objekte]);
  const liste = useMemo(() => bereiteListeAuf(eintraege), [eintraege]);
  const gefiltert = filter === "alle" ? liste : liste.filter((e) => e.immobilie_id === filter);

  // Nur Objekte anbieten, zu denen es auch Einträge gibt (plus „Alle").
  const filterObjekte = useMemo(() => {
    const ids = new Set(liste.map((e) => e.immobilie_id));
    return objekte.filter((o) => ids.has(o.id));
  }, [liste, objekte]);

  const speichern = () =>
    start(async () => {
      setFehler(null); setHinweis(null);
      const res = await speichereEinschaetzung({ immobilieId: objId, marktwert: num(wert), datum: dat, notiz });
      if (res.ok) {
        setWert(""); setNotiz("");
        setHinweis("Einschätzung gespeichert.");
        router.refresh();
      } else setFehler(res.error);
    });

  const loeschen = (id: string) =>
    start(async () => {
      setFehler(null); setHinweis(null);
      const res = await loescheEinschaetzung(id);
      if (res.ok) router.refresh();
      else setFehler(res.error ?? "Löschen fehlgeschlagen.");
    });

  const uebernehmen = (immobilieId: string, marktwert: number, datumIso: string) =>
    start(async () => {
      setFehler(null); setHinweis(null);
      const res = await uebernehmeAlsWert(immobilieId, marktwert, datumIso);
      if (res.ok) { setHinweis("Als aktueller Marktwert des Objekts übernommen."); router.refresh(); }
      else setFehler(res.error ?? "Übernehmen fehlgeschlagen.");
    });

  if (objekte.length === 0) {
    return (
      <div className="empty">
        <ClipboardList className="empty-icon" size={32} color="var(--faint)" />
        <p>Lege zuerst ein Objekt an — danach kannst du hier Marktwert-Einschätzungen festhalten.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Erfassen */}
      <div style={{ display: "grid", gap: 10 }}>
        <div className="form-row">
          <div className="form-group">
            <label>Objekt</label>
            <select value={objId} onChange={(e) => setObjId(e.target.value)}>
              {objekte.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Geschätzter Marktwert (€)</label>
            <input value={wert} onChange={(e) => setWert(e.target.value)} inputMode="decimal" placeholder="z. B. 415.000" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Datum der Einschätzung</label>
            <input type="date" value={dat} max={heute} onChange={(e) => setDat(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Notiz (optional)</label>
            <input value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="z. B. Maklergespräch, Vergleichsangebot" maxLength={200} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-gold" onClick={speichern} disabled={busy || !objId || num(wert) <= 0}>
            <Save size={14} /> {busy ? "Speichert …" : "Einschätzung speichern"}
          </button>
          {fehler && <span role="alert" style={{ fontSize: 12, color: "var(--red)" }}>{fehler}</span>}
          {hinweis && !fehler && <span role="status" style={{ fontSize: 12, color: "var(--green)" }}>{hinweis}</span>}
        </div>
      </div>

      {/* Liste + Filter */}
      <div className="section" style={{ marginBottom: 0 }}>
        <div className="section-header">
          <div>
            <h3>Deine Einschätzungen</h3>
            <div className="section-sub">
              {gefiltert.length === 0 ? "Noch nichts festgehalten" : `${gefiltert.length} Eintrag${gefiltert.length === 1 ? "" : "e"}${filter === "alle" ? " über alle Objekte" : ""}`}
            </div>
          </div>
          {filterObjekte.length > 0 && (
            <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Nach Objekt filtern" style={{ maxWidth: 260 }}>
              <option value="alle">Alle Objekte</option>
              {filterObjekte.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
        </div>
        <div className="section-body">
          {gefiltert.length === 0 ? (
            <div className="empty">
              <TrendingUp className="empty-icon" size={32} color="var(--faint)" />
              <p>Halte oben deine erste Marktwert-Einschätzung fest — mit Datum, damit du die Entwicklung später vergleichen kannst.</p>
            </div>
          ) : (
            // .table-scroll wie bei den uebrigen Tabellen der App: fuenf
            // Spalten passen auf dem Telefon nicht nebeneinander, und ohne
            // eigenen Scroll-Bereich wuerde die Seite seitlich wandern statt
            // der Tabelle.
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Objekt</th>
                    <th>Herkunft</th>
                    <th style={{ textAlign: "right" }}>Marktwert</th>
                    <th style={{ textAlign: "right" }}>Δ</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {gefiltert.map((e) => {
                    const w = e.marktwert == null ? null : Number(e.marktwert);
                    const eigene = e.verfahren === "einschaetzung";
                    return (
                      <tr key={e.id}>
                        <td style={{ whiteSpace: "nowrap" }}>{fmtDatum(e.datum)}</td>
                        <td>{nameOf.get(e.immobilie_id) ?? "–"}</td>
                        <td style={{ color: "var(--muted)" }}>
                          {e.herkunft}
                          {e.notiz && <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>{e.notiz}</div>}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 600, whiteSpace: "nowrap" }}>{w == null ? "–" : eur(w)}</td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          {e.deltaProzent == null ? (
                            <span style={{ color: "var(--faint)" }}>–</span>
                          ) : (
                            <span className={`badge ${e.deltaProzent >= 0 ? "badge-green" : "badge-red"}`}>
                              {e.deltaProzent >= 0 ? "+" : ""}{e.deltaProzent.toLocaleString("de-DE")} %
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          {w != null && (
                            <button type="button" className="btn btn-ghost btn-sm" style={{ marginRight: 6 }} disabled={busy}
                              onClick={() => uebernehmen(e.immobilie_id, w, e.datum)} title="Als aktuellen Marktwert des Objekts setzen">
                              <Check size={13} /> Übernehmen
                            </button>
                          )}
                          {eigene && (
                            <button type="button" className="btn btn-ghost btn-sm" disabled={busy}
                              onClick={() => loeschen(e.id)} title="Einschätzung löschen">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 12 }}>
            Eigene Einschätzungen erscheinen auch in der Wertentwicklung des Objekts. „Übernehmen" setzt den Wert als aktuellen Marktwert —
            automatisch erzeugte Stände (Index, ImmoWertV) bleiben zum Vergleich stehen.
          </p>
        </div>
      </div>
    </div>
  );
}
