"use client";

// Wiederkehrende Buchungen verwalten: Vorlagen anlegen (Einnahme/Kosten,
// Zyklus, Zeitraum), aktiv/pausiert schalten, und je Vorlage die noch offenen
// Buchungen mit Vorschau erzeugen (rückwirkend bis 10 Jahre). Die Engine läuft
// clientseitig für die Vorschau; gebucht wird per Server-Action.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { eur2, datum } from "@/lib/format";
import { faelligeDaten, offeneDaten, ZYKLEN, ZYKLUS_LABEL, type Zyklus } from "@/lib/wiederkehr";
import {
  createVorlage,
  setVorlageAktiv,
  deleteVorlage,
  erzeugeBuchungen,
} from "@/lib/actions/wiederkehr";
import { useToast } from "@/components/Toast";
import type { WiederkehrVorlage } from "@/lib/types";

const KOSTEN_KAT = ["Reparatur", "Instandhaltung", "Verwaltung", "Versicherung", "Grundsteuer", "Hausgeld / WEG", "Makler", "Sonstiges"];
const EINNAHME_KAT = ["Miete", "Nebenkostenabrechnung", "Sonstiges"];

type VorlageMitStatus = WiederkehrVorlage & { gebuchteDaten: string[] };

export default function WiederkehrManager({
  vorlagen,
  propNamen,
  mieterNamen,
  properties,
  mieter,
}: {
  vorlagen: VorlageMitStatus[];
  propNamen: Record<string, string>;
  mieterNamen: Record<string, string>;
  properties: { id: string; bezeichnung: string }[];
  mieter: { id: string; name: string; prop_id: string | null }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();

  // Neue-Vorlage-Formular
  const [art, setArt] = useState<"kosten" | "einnahme">("kosten");
  const [kategorie, setKategorie] = useState("");
  const [betrag, setBetrag] = useState("");
  const [zyklus, setZyklus] = useState<Zyklus>("monatlich");
  const [startDatum, setStartDatum] = useState("");
  const [endeDatum, setEndeDatum] = useState("");
  const [propId, setPropId] = useState("");
  const [mieterId, setMieterId] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [adding, startAdd] = useTransition();

  const katListe = art === "einnahme" ? EINNAHME_KAT : KOSTEN_KAT;

  const anlegen = () => {
    const fd = new FormData();
    fd.set("art", art);
    fd.set("kategorie", kategorie);
    fd.set("betrag", betrag);
    fd.set("zyklus", zyklus);
    fd.set("start_datum", startDatum);
    fd.set("ende_datum", endeDatum);
    fd.set("prop_id", propId);
    fd.set("mieter_id", mieterId);
    fd.set("beschreibung", beschreibung);
    startAdd(async () => {
      const res = await createVorlage(fd);
      if (res.ok) {
        toast("Vorlage angelegt ✓");
        setKategorie(""); setBetrag(""); setStartDatum(""); setEndeDatum("");
        setPropId(""); setMieterId(""); setBeschreibung("");
        router.refresh();
      } else {
        toast(res.error ?? "Speichern fehlgeschlagen.");
      }
    });
  };

  const erzeugen = (v: VorlageMitStatus) => {
    start(async () => {
      const res = await erzeugeBuchungen(v.id);
      if (res.ok) {
        toast(res.anzahl > 0 ? `${res.anzahl} Buchung${res.anzahl === 1 ? "" : "en"} erzeugt ✓` : "Nichts Offenes zu erzeugen.");
        router.refresh();
      } else {
        toast(res.error ?? "Erzeugen fehlgeschlagen.");
      }
    });
  };

  const umschalten = (v: VorlageMitStatus) => {
    start(async () => {
      const res = await setVorlageAktiv(v.id, !v.aktiv);
      if (res.ok) router.refresh();
      else toast(res.error ?? "Fehler.");
    });
  };

  const loeschen = (v: VorlageMitStatus) => {
    if (!confirm("Vorlage löschen? Bereits erzeugte Buchungen bleiben erhalten.")) return;
    start(async () => {
      const res = await deleteVorlage(v.id);
      if (res.ok) { toast("Vorlage gelöscht ✓"); router.refresh(); }
      else toast(res.error ?? "Löschen fehlgeschlagen.");
    });
  };

  const inputStil: React.CSSProperties = {
    background: "var(--bg3)", border: "1px solid var(--line2)", color: "var(--text)",
    borderRadius: 7, padding: "8px 10px", fontSize: 13, width: "100%",
  };
  const feld = (breite: number | string): React.CSSProperties => ({
    display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "var(--muted)", width: breite,
  });

  const mieterFuerObjekt = propId ? mieter.filter((m) => m.prop_id === propId) : mieter;

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Wiederkehrende Buchungen</div>
          <div className="topbar-sub">
            Mieten, Grundsteuer, Müll & Co. einmal anlegen — MyImmo erzeugt die Buchungen im Zyklus, rückwirkend bis 10 Jahre.
          </div>
        </div>
      </div>

      {/* Neue Vorlage */}
      <div className="section mb-20">
        <div className="section-header"><h3>Neue Vorlage</h3></div>
        <div className="section-body">
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
            <label style={feld(130)}>
              <span>Art</span>
              <select style={inputStil} value={art} onChange={(e) => { setArt(e.target.value as "kosten" | "einnahme"); setKategorie(""); }}>
                <option value="kosten">Ausgabe / Kosten</option>
                <option value="einnahme">Einnahme</option>
              </select>
            </label>
            <label style={feld(170)}>
              <span>Kategorie *</span>
              <select style={inputStil} value={kategorie} onChange={(e) => setKategorie(e.target.value)}>
                <option value="">— wählen —</option>
                {katListe.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
            <label style={feld(110)}>
              <span>Betrag (€) *</span>
              <input type="number" step="0.01" min="0" style={inputStil} value={betrag} onChange={(e) => setBetrag(e.target.value)} />
            </label>
            <label style={feld(140)}>
              <span>Zyklus *</span>
              <select style={inputStil} value={zyklus} onChange={(e) => setZyklus(e.target.value as Zyklus)}>
                {ZYKLEN.map((z) => <option key={z} value={z}>{ZYKLUS_LABEL[z]}</option>)}
              </select>
            </label>
            <label style={feld(140)}>
              <span>Erster Termin *</span>
              <input type="date" style={inputStil} value={startDatum} onChange={(e) => setStartDatum(e.target.value)} />
            </label>
            <label style={feld(140)}>
              <span>Ende (leer = läuft)</span>
              <input type="date" style={inputStil} value={endeDatum} onChange={(e) => setEndeDatum(e.target.value)} />
            </label>
            <label style={feld(180)}>
              <span>Objekt (optional)</span>
              <select style={inputStil} value={propId} onChange={(e) => { setPropId(e.target.value); setMieterId(""); }}>
                <option value="">—</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.bezeichnung}</option>)}
              </select>
            </label>
            <label style={feld(180)}>
              <span>Mieter (optional)</span>
              <select style={inputStil} value={mieterId} onChange={(e) => setMieterId(e.target.value)}>
                <option value="">—</option>
                {mieterFuerObjekt.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <label style={feld(220)}>
              <span>Beschreibung (optional)</span>
              <input type="text" style={inputStil} value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} placeholder="z. B. Grundsteuer Q1" />
            </label>
            <button className="btn btn-gold" disabled={adding} onClick={anlegen} style={{ marginBottom: 1 }}>
              {adding ? "Speichert…" : "＋ Vorlage"}
            </button>
          </div>
          <p style={{ fontSize: 11, color: "var(--faint)", marginTop: 10 }}>
            Das Datum ist der tatsächliche Zahltag (§ 11 EStG). Beim Erzeugen wird für jeden fälligen Termin eine
            Buchung angelegt — bereits erzeugte Termine werden übersprungen. Ohne Gewähr, keine Steuerberatung.
          </p>
        </div>
      </div>

      {/* Vorlagen-Liste */}
      <div className="section" style={{ marginBottom: 0 }}>
        <div className="section-header"><h3>Vorlagen ({vorlagen.length})</h3></div>
        <div className="section-body">
          {vorlagen.length === 0 ? (
            <div className="empty" style={{ padding: 28 }}>
              <div className="empty-icon">🔁</div>
              <p>Noch keine wiederkehrenden Buchungen. Lege z. B. „Grundsteuer · jährlich" oder „Müllabfuhr · vierteljährlich" an.</p>
            </div>
          ) : (
            vorlagen.map((v) => {
              const faellig = faelligeDaten({ zyklus: v.zyklus, start_datum: v.start_datum, ende_datum: v.ende_datum });
              const offen = offeneDaten(faellig, v.gebuchteDaten).length;
              const objekt = v.prop_id ? propNamen[v.prop_id] : null;
              const mName = v.mieter_id ? mieterNamen[v.mieter_id] : null;
              return (
                <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 0", borderBottom: "1px solid var(--line)", opacity: v.aktiv ? 1 : 0.55 }}>
                  <span className={`badge ${v.art === "einnahme" ? "badge-green" : "badge-red"}`}>
                    {v.art === "einnahme" ? "Einnahme" : "Kosten"}
                  </span>
                  <div style={{ minWidth: 150, flex: "1 1 180px" }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{v.kategorie}</div>
                    <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                      {[objekt, mName, v.beschreibung].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14, minWidth: 90, textAlign: "right" }}>{eur2(v.betrag ?? 0)}</div>
                  <span className="badge badge-teal">{ZYKLUS_LABEL[v.zyklus as Zyklus] ?? v.zyklus}</span>
                  <span style={{ fontSize: 11.5, color: "var(--muted)", minWidth: 150 }}>
                    ab {datum(v.start_datum)}{v.ende_datum ? ` – ${datum(v.ende_datum)}` : " · laufend"}
                  </span>
                  <span style={{ fontSize: 12, color: offen > 0 ? "var(--gold)" : "var(--faint)", minWidth: 100 }}>
                    {v.gebuchteDaten.length} gebucht{offen > 0 ? ` · ${offen} offen` : ""}
                  </span>
                  <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                    <button className="btn btn-gold" style={{ fontSize: 12 }} disabled={offen === 0} onClick={() => erzeugen(v)}>
                      {offen > 0 ? `${offen} erzeugen` : "aktuell"}
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => umschalten(v)} title={v.aktiv ? "Pausieren" : "Aktivieren"}>
                      {v.aktiv ? "⏸" : "▶"}
                    </button>
                    <button className="delete-btn" title="Vorlage löschen" onClick={() => loeschen(v)}>✕</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
