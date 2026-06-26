"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { eur2 } from "@/lib/format";
import { monateImJahr } from "@/lib/nk";
import {
  berechneUmlage,
  type UmlageSchluessel,
  type UmlageZeile,
  type VerteilenErgebnis,
} from "@/lib/umlage";
import { verteileNebenkosten } from "@/lib/actions/umlage";
import { useToast } from "@/components/Toast";

type MieterIn = {
  id: string;
  name: string;
  einheit: string | null;
  flaeche: number | null;
  mietbeginn: string | null;
  mietende: string | null;
};
type ZeileUI = { bezeichnung: string; betrag: string; schluessel: UmlageSchluessel };

const VORLAGEN = [
  "Grundsteuer",
  "Müllabfuhr",
  "Wasser / Abwasser",
  "Gebäudeversicherung",
  "Allgemeinstrom",
  "Hausmeister",
  "Aufzug",
  "Gartenpflege",
  "Straßenreinigung",
  "Schornsteinfeger",
  "Heizung",
];

// Fünf häufigste Betriebskosten als Startvorschlag (nur Werte eintragen).
const DEFAULT_ZEILEN: ZeileUI[] = [
  { bezeichnung: "Grundsteuer", betrag: "", schluessel: "flaeche" },
  { bezeichnung: "Wasser / Abwasser", betrag: "", schluessel: "flaeche" },
  { bezeichnung: "Müllabfuhr", betrag: "", schluessel: "flaeche" },
  { bezeichnung: "Gebäudeversicherung", betrag: "", schluessel: "flaeche" },
  { bezeichnung: "Allgemeinstrom", betrag: "", schluessel: "flaeche" },
];

const num = (s: string) => {
  const v = parseFloat(s.replace(",", "."));
  return Number.isFinite(v) ? v : 0;
};

export default function UmlageAssistent({
  propId,
  propName,
  propFlaeche,
  mieter,
  jahrDefault,
}: {
  propId: string;
  propName: string;
  propFlaeche: number | null;
  mieter: MieterIn[];
  jahrDefault: number;
}) {
  const aktuell = new Date().getFullYear();
  const jahre = [aktuell, aktuell - 1, aktuell - 2, aktuell - 3, aktuell - 4];

  const [jahr, setJahr] = useState(jahrDefault);
  const [zeitanteilig, setZeitanteilig] = useState(true);
  const [flaeche, setFlaeche] = useState<Record<string, string>>(
    Object.fromEntries(mieter.map((m) => [m.id, m.flaeche != null ? String(m.flaeche) : ""])),
  );
  const [zeilen, setZeilen] = useState<ZeileUI[]>(DEFAULT_ZEILEN);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [ergebnis, setErgebnis] = useState<VerteilenErgebnis | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrInfo, setOcrInfo] = useState<string | null>(null);

  // Pointer-basiertes Verschieben (Maus + Finger)
  const rowsRef = useRef<(HTMLTableRowElement | null)[]>([]);
  const dragFrom = useRef<number | null>(null);
  const toast = useToast();

  // belegte Monate je Mieter für das gewählte Jahr
  const monateMap = Object.fromEntries(
    mieter.map((m) => [m.id, monateImJahr(jahr, m.mietbeginn, m.mietende).monate]),
  );

  // --- Live-Berechnung (identisch zur Server-Action) ---
  const mieterCalc = mieter.map((m) => ({
    id: m.id,
    name: m.name,
    flaeche: num(flaeche[m.id] ?? ""),
    monate: monateMap[m.id],
  }));
  const zeilenCalc: UmlageZeile[] = zeilen.map((z) => ({
    bezeichnung: z.bezeichnung.trim(),
    betrag: num(z.betrag),
    schluessel: z.schluessel,
  }));
  const aktive = zeilenCalc.filter((z) => z.bezeichnung !== "" && z.betrag > 0);
  const calc = berechneUmlage(aktive, mieterCalc, {
    zeitanteilig,
    referenzFlaeche: propFlaeche ?? 0,
  });
  const fehlendeFlaeche = mieterCalc.some((m) => m.flaeche <= 0);
  const gesamtEingabe = aktive.reduce((s, z) => s + z.betrag, 0);

  function setZeile(i: number, patch: Partial<ZeileUI>) {
    setZeilen((zs) => zs.map((z, k) => (k === i ? { ...z, ...patch } : z)));
    setStatus("idle");
  }
  function addZeile(bez = "") {
    setZeilen((zs) => [...zs, { bezeichnung: bez, betrag: "", schluessel: "flaeche" }]);
  }
  function removeZeile(i: number) {
    setZeilen((zs) => zs.filter((_, k) => k !== i));
  }
  function move(from: number, to: number) {
    if (to < 0 || to >= zeilen.length || from === to) return;
    setZeilen((zs) => {
      const a = zs.slice();
      const [it] = a.splice(from, 1);
      a.splice(to, 0, it);
      return a;
    });
    setStatus("idle");
  }

  // Greifpunkt: Drag mit Maus oder Finger, Zeilen werden live umsortiert.
  function onHandleDown(e: React.PointerEvent, i: number) {
    e.preventDefault();
    dragFrom.current = i;
    setDragIdx(i);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onHandleMove(e: React.PointerEvent) {
    if (dragFrom.current == null) return;
    const y = e.clientY;
    const rows = rowsRef.current;
    let target = dragFrom.current;
    for (let k = 0; k < rows.length; k++) {
      const r = rows[k];
      if (!r) continue;
      const rect = r.getBoundingClientRect();
      if (y >= rect.top && y <= rect.bottom) {
        target = k;
        break;
      }
    }
    if (target !== dragFrom.current) {
      move(dragFrom.current, target);
      dragFrom.current = target;
      setDragIdx(target);
    }
  }
  function onHandleUp(e: React.PointerEvent) {
    dragFrom.current = null;
    setDragIdx(null);
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  }

  // NK-Abrechnung hochladen → Positionen automatisch in die Tabelle eintragen.
  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setOcrError(null);
    setOcrInfo(null);
    setOcrLoading(true);
    try {
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const isPdf = file.type === "application/pdf";
      const resp = await fetch("/api/nk-ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: base64, mediaType: file.type, isPdf }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setOcrError(json.error || "Fehler beim Auslesen.");
        return;
      }
      const list = (json.positionen ?? []).filter((p: { name?: string }) => p && p.name) as {
        name: string;
        betrag: number;
      }[];
      if (list.length === 0) {
        setOcrError("Keine umlagefähigen Positionen erkannt.");
        return;
      }
      const neue: ZeileUI[] = list.map((p) => ({
        bezeichnung: p.name.trim(),
        betrag: Number.isFinite(p.betrag) ? String(p.betrag).replace(".", ",") : "",
        schluessel: "flaeche",
      }));
      setZeilen((zs) => {
        const behalten = zs.filter((z) => z.bezeichnung.trim() !== "" || z.betrag.trim() !== "");
        const vorhanden = new Set(behalten.map((z) => z.bezeichnung.trim().toLowerCase()));
        const ergaenzt = neue.filter((z) => !vorhanden.has(z.bezeichnung.toLowerCase()));
        return [...behalten, ...ergaenzt];
      });
      setOcrInfo(`${list.length} Position(en) übernommen — bitte Beträge & Schlüssel prüfen.`);
      setStatus("idle");
      toast(`${list.length} Position(en) aus der Abrechnung übernommen.`, "success");
    } catch (err) {
      setOcrError(`Fehler: ${(err as Error).message}`);
      toast("Auslesen fehlgeschlagen.", "error");
    } finally {
      setOcrLoading(false);
    }
  }

  async function speichern() {
    setStatus("saving");
    try {
      const res = await verteileNebenkosten({
        propId,
        jahr,
        zeitanteilig,
        zeilen: zeilenCalc,
        mieter: mieterCalc.map((m) => ({ id: m.id, flaeche: m.flaeche })),
      });
      setErgebnis(res);
      setStatus(res.ok ? "done" : "error");
      if (res.ok) toast(`Verteilt: ${res.mieter} Mieter, ${res.positionen} Positionen.`, "success");
      else toast(`Fehler: ${res.fehler ?? "unbekannt"}`, "error");
    } catch (e) {
      setErgebnis({ ok: false, positionen: 0, mieter: 0, gesamt: 0, nichtUmgelegt: 0, fehler: String(e) });
      setStatus("error");
      toast("Speichern fehlgeschlagen.", "error");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* m² je Mieter */}
      <div className="section" style={{ marginBottom: 0 }}>
        <div className="section-header">
          <h3>Wohnfläche je Mieter (m²)</h3>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            Gesamt: <strong className="gold">{calc.totalFlaeche.toLocaleString("de-DE")} m²</strong>
            {propFlaeche ? ` · Objekt: ${propFlaeche.toLocaleString("de-DE")} m²` : ""}
          </span>
        </div>
        <div className="section-body">
          {mieter.length === 0 ? (
            <div style={{ color: "var(--faint)", fontSize: 12 }}>
              Diesem Objekt sind noch keine Mieter zugeordnet.
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {mieter.map((m) => {
                const anteil = calc.perMieter.find((p) => p.id === m.id);
                const monate = monateMap[m.id];
                return (
                  <div
                    key={m.id}
                    style={{
                      flex: "1 1 200px",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      padding: "10px 12px",
                      background: "var(--bg3)",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600 }}>
                      {m.name}
                      {m.einheit && <span style={{ color: "var(--muted)", fontWeight: 400 }}> · {m.einheit}</span>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <input
                        type="number"
                        step="0.01"
                        className="input"
                        style={{ width: 100 }}
                        value={flaeche[m.id] ?? ""}
                        onChange={(e) => {
                          setFlaeche((f) => ({ ...f, [m.id]: e.target.value }));
                          setStatus("idle");
                        }}
                        placeholder="m²"
                      />
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>
                        {anteil ? anteil.anteilProzent.toFixed(1) : "0"}%
                      </span>
                    </div>
                    {zeitanteilig && (
                      <div style={{ fontSize: 11, color: monate < 12 ? "var(--amber)" : "var(--muted)", marginTop: 4 }}>
                        {monate}/12 Monate belegt ({jahr})
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {fehlendeFlaeche && mieter.length > 0 && (
            <div style={{ fontSize: 11, color: "var(--amber)", marginTop: 10 }}>
              Hinweis: Mindestens ein Mieter hat keine Fläche — Positionen nach „Fläche" lassen sich erst nach Eingabe der m² korrekt verteilen.
            </div>
          )}
        </div>
      </div>

      {/* Kostenpositionen */}
      <div className="section" style={{ marginBottom: 0 }}>
        <div className="section-header">
          <h3>Gesamtkosten {propName}</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>Abrechnungsjahr</span>
            <select
              className="input"
              value={jahr}
              onChange={(e) => {
                setJahr(Number(e.target.value));
                setStatus("idle");
              }}
            >
              {jahre.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="section-body">
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--muted)", marginBottom: 12, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={zeitanteilig}
              onChange={(e) => {
                setZeitanteilig(e.target.checked);
                setStatus("idle");
              }}
            />
            Zeitanteilig nach belegten Monaten verteilen (für unterjährige Mieterwechsel)
          </label>
          {zeitanteilig && !propFlaeche && (
            <div style={{ fontSize: 11, color: "var(--amber)", marginBottom: 10 }}>
              Tipp: Hinterlege die <strong>Gesamtwohnfläche des Objekts</strong> (Objekt bearbeiten), damit die zeitanteilige Verteilung bei Mieterwechsel exakt rechnet.
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 12,
              paddingBottom: 12,
              borderBottom: "1px solid var(--line)",
            }}
          >
            <label className="btn btn-ghost" style={{ fontSize: 12, cursor: ocrLoading ? "wait" : "pointer", display: "inline-flex" }}>
              {ocrLoading ? "⏳ Claude liest aus…" : "📄 NK-Abrechnung hochladen (Positionen auslesen)"}
              <input
                type="file"
                accept="application/pdf,image/*"
                onChange={onUpload}
                disabled={ocrLoading}
                style={{ display: "none" }}
              />
            </label>
            <span style={{ fontSize: 11, color: "var(--faint)" }}>
              PDF/Bild der Hausverwaltung — die erkannten Positionen werden unten eingetragen.
            </span>
          </div>
          {ocrError && (
            <div style={{ fontSize: 12, color: "var(--red)", background: "var(--red-dim)", border: "1px solid rgba(224,92,75,0.4)", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
              ⚠️ {ocrError}
            </div>
          )}
          {ocrInfo && (
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>✓ {ocrInfo}</div>
          )}

          <table style={{ fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ width: 24 }}></th>
                <th style={{ width: "42%" }}>Position</th>
                <th style={{ width: "22%" }}>Gesamtbetrag (€)</th>
                <th style={{ width: "24%" }}>Verteilung</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {zeilen.map((z, i) => (
                <tr
                  key={i}
                  ref={(el) => {
                    rowsRef.current[i] = el;
                  }}
                  style={{
                    opacity: dragIdx === i ? 0.5 : 1,
                    background: dragIdx === i ? "var(--bg3)" : undefined,
                  }}
                >
                  <td>
                    <span
                      onPointerDown={(e) => onHandleDown(e, i)}
                      onPointerMove={onHandleMove}
                      onPointerUp={onHandleUp}
                      onPointerCancel={onHandleUp}
                      title="Ziehen zum Umsortieren (Maus oder Finger)"
                      style={{
                        cursor: "grab",
                        color: "var(--faint)",
                        userSelect: "none",
                        touchAction: "none",
                        fontSize: 16,
                        display: "inline-block",
                        padding: "4px 2px",
                      }}
                    >
                      ⠿
                    </span>
                  </td>
                  <td style={{ paddingRight: 8 }}>
                    <input
                      className="input"
                      style={{ width: "100%" }}
                      list="umlage-vorlagen"
                      value={z.bezeichnung}
                      onChange={(e) => setZeile(i, { bezeichnung: e.target.value })}
                      placeholder="z. B. Grundsteuer"
                    />
                  </td>
                  <td style={{ paddingRight: 8 }}>
                    <input
                      className="input"
                      style={{ width: "100%" }}
                      type="number"
                      step="0.01"
                      value={z.betrag}
                      onChange={(e) => setZeile(i, { betrag: e.target.value })}
                      placeholder="0,00"
                    />
                  </td>
                  <td style={{ paddingRight: 8 }}>
                    <select
                      className="input"
                      style={{ width: "100%" }}
                      value={z.schluessel}
                      onChange={(e) => setZeile(i, { schluessel: e.target.value as UmlageSchluessel })}
                    >
                      <option value="flaeche">nach Fläche (m²)</option>
                      <option value="gleich">gleichmäßig je Einheit</option>
                    </select>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button type="button" className="delete-btn" title="nach oben" onClick={() => move(i, i - 1)} disabled={i === 0}>
                      ▲
                    </button>
                    <button type="button" className="delete-btn" title="nach unten" onClick={() => move(i, i + 1)} disabled={i === zeilen.length - 1}>
                      ▼
                    </button>
                    <button type="button" className="delete-btn" title="Position entfernen" onClick={() => removeZeile(i)}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="umlage-vorlagen">
            {VORLAGEN.map((v) => (
              <option key={v} value={v} />
            ))}
          </datalist>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12, alignItems: "center" }}>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => addZeile()}>
              ＋ Position
            </button>
            <span style={{ fontSize: 11, color: "var(--faint)" }}>Schnellauswahl:</span>
            {VORLAGEN.slice(0, 8).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => addZeile(v)}
                style={{
                  fontSize: 11,
                  padding: "3px 8px",
                  borderRadius: 6,
                  border: "1px solid var(--line2)",
                  background: "var(--bg3)",
                  color: "var(--muted)",
                  cursor: "pointer",
                }}
              >
                + {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Vorschau-Matrix */}
      <div className="section" style={{ marginBottom: 0 }}>
        <div className="section-header">
          <h3>Vorschau der Verteilung</h3>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            Eingabe gesamt: <strong>{eur2(gesamtEingabe)}</strong>
          </span>
        </div>
        <div className="section-body">
          {aktive.length === 0 || mieter.length === 0 ? (
            <div style={{ color: "var(--faint)", fontSize: 12 }}>
              {mieter.length === 0
                ? "Keine Mieter vorhanden."
                : "Trage oben mindestens eine Position mit Betrag ein."}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ fontSize: 12, minWidth: 480 }}>
                <thead>
                  <tr>
                    <th>Position</th>
                    <th>Schlüssel</th>
                    {calc.perMieter.map((m) => (
                      <th key={m.id} style={{ textAlign: "right" }}>
                        {m.name}
                      </th>
                    ))}
                    <th style={{ textAlign: "right" }}>Umgelegt</th>
                  </tr>
                </thead>
                <tbody>
                  {aktive.map((z, j) => (
                    <tr key={j}>
                      <td style={{ fontWeight: 500 }}>{z.bezeichnung}</td>
                      <td style={{ color: "var(--muted)" }}>{z.schluessel === "gleich" ? "Einheit" : "Fläche"}</td>
                      {calc.perMieter.map((m) => (
                        <td key={m.id} style={{ textAlign: "right" }}>
                          {eur2(m.positionen[j]?.betrag ?? 0)}
                        </td>
                      ))}
                      <td style={{ textAlign: "right", fontWeight: 600 }}>{eur2(calc.zeilenSummen[j] ?? 0)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ fontWeight: 700 }} colSpan={2}>
                      Summe je Mieter
                    </td>
                    {calc.perMieter.map((m) => (
                      <td key={m.id} style={{ textAlign: "right", fontWeight: 700, color: "var(--gold)" }}>
                        {eur2(m.summe)}
                      </td>
                    ))}
                    <td style={{ textAlign: "right", fontWeight: 700 }}>{eur2(calc.gesamt)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          {calc.nichtUmgelegt > 0.005 && (
            <div style={{ fontSize: 11, color: "var(--amber)", marginTop: 10 }}>
              Nicht umgelegt (Leerstand / unterjährig): <strong>{eur2(calc.nichtUmgelegt)}</strong> — dieser Anteil
              entfällt auf nicht belegte Zeiten und wird nicht auf die Mieter verteilt.
            </div>
          )}
        </div>
      </div>

      {/* Aktion */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn btn-gold"
          onClick={speichern}
          disabled={status === "saving" || aktive.length === 0 || mieter.length === 0}
        >
          {status === "saving" ? "Speichert…" : "💾 Verteilen & in NK-Abrechnungen übernehmen"}
        </button>
        <span style={{ fontSize: 11, color: "var(--muted)", maxWidth: 380 }}>
          Überschreibt nur die zuvor automatisch verteilten Positionen ({jahr}). Manuell angelegte Positionen bleiben erhalten.
        </span>
      </div>

      {status === "done" && ergebnis?.ok && (
        <div
          style={{
            background: "var(--green-dim)",
            border: "1px solid rgba(76,175,125,0.3)",
            borderRadius: 8,
            padding: "12px 14px",
            fontSize: 13,
          }}
        >
          ✓ {eur2(ergebnis.gesamt)} auf {ergebnis.mieter} Mieter verteilt ({ergebnis.positionen} Positionen für {jahr}).
          {ergebnis.nichtUmgelegt > 0.005 ? ` ${eur2(ergebnis.nichtUmgelegt)} nicht umgelegt (Leerstand).` : ""}{" "}
          Jede NK-Abrechnung übernimmt die Werte automatisch.{" "}
          <Link href={`/properties/${propId}`} className="gold hover:underline">
            Zurück zum Objekt
          </Link>
        </div>
      )}
      {status === "error" && (
        <div
          style={{
            background: "var(--red-dim)",
            border: "1px solid rgba(224,92,75,0.3)",
            borderRadius: 8,
            padding: "12px 14px",
            fontSize: 13,
            color: "var(--red)",
          }}
        >
          Fehler beim Speichern: {ergebnis?.fehler ?? "unbekannt"}
        </div>
      )}
    </div>
  );
}
