"use client";

import { useMemo, useState } from "react";
import { Printer, Download } from "lucide-react";
import { eur2 } from "@/lib/format";
import type { Einnahme, Kosten, Kredit, Property } from "@/lib/types";
import {
  AFA_DEFAULT,
  ANLAGE_V_POSITIONEN,
  berechneAnlageV,
  wertVon,
  type AnlageVObjekt,
} from "@/lib/anlageV";

export default function AnlageVExport({
  properties,
  einnahmen,
  kosten,
  kredite,
}: {
  properties: Property[];
  einnahmen: Einnahme[];
  kosten: Kosten[];
  kredite: Kredit[];
}) {
  const aktuell = new Date().getFullYear();
  const jahre = [aktuell, aktuell - 1, aktuell - 2, aktuell - 3, aktuell - 4];

  const [jahr, setJahr] = useState(aktuell - 1);
  const [gebaeudeAnteil, setGebaeudeAnteil] = useState(String(AFA_DEFAULT.gebaeudeAnteil));
  const [satz, setSatz] = useState(String(AFA_DEFAULT.satz));

  const erg = useMemo(
    () =>
      berechneAnlageV(jahr, properties, einnahmen, kosten, kredite, {
        gebaeudeAnteil: parseFloat(gebaeudeAnteil.replace(",", ".")) || 0,
        satz: parseFloat(satz.replace(",", ".")) || 0,
      }),
    [jahr, properties, einnahmen, kosten, kredite, gebaeudeAnteil, satz],
  );

  const spalten = [...erg.objekte, erg.gesamt];
  const einnahmePos = ANLAGE_V_POSITIONEN.filter((p) => p.bereich === "einnahme");
  const wkPos = ANLAGE_V_POSITIONEN.filter((p) => p.bereich === "wk");

  function exportCsv() {
    const sep = ";";
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const nr = (n: number) => n.toFixed(2).replace(".", ",");
    const lines: string[] = [];
    lines.push(["Objekt", "Bereich", "Position", "Betrag (EUR)"].map(esc).join(sep));
    for (const o of erg.objekte) {
      for (const p of einnahmePos) lines.push([o.name, "Einnahme", p.label, nr(wertVon(o, p.key))].map(esc).join(sep));
      lines.push([o.name, "Einnahme", "Summe Einnahmen", nr(o.einnahmen.summe)].map(esc).join(sep));
      for (const p of wkPos) lines.push([o.name, "Werbungskosten", p.label, nr(wertVon(o, p.key))].map(esc).join(sep));
      lines.push([o.name, "Werbungskosten", "Summe Werbungskosten", nr(o.werbungskosten.summe)].map(esc).join(sep));
      lines.push([o.name, "Ergebnis", "Überschuss / Verlust", nr(o.ueberschuss)].map(esc).join(sep));
    }
    lines.push([erg.gesamt.name, "Ergebnis", "Überschuss / Verlust gesamt", nr(erg.gesamt.ueberschuss)].map(esc).join(sep));

    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Anlage-V_${jahr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const num = (o: AnlageVObjekt, key: string, gesamt: boolean) => (
    <td
      key={o.propId ?? "gesamt"}
      style={{ textAlign: "right", whiteSpace: "nowrap", fontWeight: gesamt ? 700 : 400, background: gesamt ? "var(--bg3)" : undefined }}
    >
      {eur2(wertVon(o, key))}
    </td>
  );

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title"><span style={{ color: "var(--gold)", fontWeight: 700, marginRight: 4 }}>§</span> Steuer — Anlage V</div>
          <div className="topbar-sub">Einkünfte aus Vermietung & Verpachtung je Objekt — aus deinen Buchungen</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={() => window.print()} style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Printer size={14} /> Drucken
          </button>
          <button type="button" className="btn btn-gold" onClick={exportCsv} style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Download size={14} /> CSV-Export
          </button>
        </div>
      </div>

      {/* Steuerjahr + AfA */}
      <div className="section no-print">
        <div className="section-header"><h3>Einstellungen</h3></div>
        <div className="section-body" style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "flex-end" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Steuerjahr</label>
            <select className="input" value={jahr} onChange={(e) => setJahr(Number(e.target.value))}>
              {jahre.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>Gebäudeanteil (%)</label>
            <input className="input" type="number" step="1" value={gebaeudeAnteil} onChange={(e) => setGebaeudeAnteil(e.target.value)} style={{ width: 120 }} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label>AfA-Satz (% p.a.)</label>
            <input className="input" type="number" step="0.5" value={satz} onChange={(e) => setSatz(e.target.value)} style={{ width: 120 }} />
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)", maxWidth: 360, lineHeight: 1.5 }}>
            AfA = Kaufpreis × Gebäudeanteil × Satz. Typisch: 2 % (Baujahr ab 1925), 2,5 % (älter), 3 % (Neubau ab 2023). Anpassen, falls dein Bescheid abweicht.
          </div>
        </div>
      </div>

      {erg.objekte.length === 0 ? (
        <div className="empty"><div className="empty-icon">🧾</div><p>Keine Einnahmen oder Kosten für {jahr} gebucht.</p></div>
      ) : (
        <>
          {/* Gesamt-Kennzahlen */}
          <div className="grid-3 mb-20">
            <KennzahlCard label="Einnahmen gesamt" value={eur2(erg.gesamt.einnahmen.summe)} color="var(--green)" />
            <KennzahlCard label="Werbungskosten gesamt" value={eur2(erg.gesamt.werbungskosten.summe)} color="var(--red)" />
            <KennzahlCard
              label={erg.gesamt.ueberschuss >= 0 ? "Überschuss (Einkünfte)" : "Verlust"}
              value={eur2(erg.gesamt.ueberschuss)}
              color={erg.gesamt.ueberschuss >= 0 ? "var(--gold)" : "var(--red)"}
            />
          </div>

          {/* Aufstellung */}
          <div className="section">
            <div className="section-header">
              <h3>Aufstellung {jahr}</h3>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>{erg.objekte.length} Objekt(e)</span>
            </div>
            <div className="section-body" style={{ overflowX: "auto" }}>
              <table style={{ fontSize: 12, minWidth: 520 }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 220 }}>Position</th>
                    {spalten.map((o) => (
                      <th key={o.propId ?? "gesamt"} style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {o.propId === null && o.name.startsWith("Gesamt") ? "Gesamt" : o.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr><td colSpan={spalten.length + 1} style={{ fontWeight: 700, color: "var(--green)", paddingTop: 8 }}>Einnahmen</td></tr>
                  {einnahmePos.map((p) => (
                    <tr key={p.key}>
                      <td style={{ paddingLeft: 12, color: "var(--muted)" }}>{p.label}</td>
                      {spalten.map((o) => num(o, p.key, o === erg.gesamt))}
                    </tr>
                  ))}
                  <tr>
                    <td style={{ fontWeight: 600 }}>Summe Einnahmen</td>
                    {spalten.map((o) => (
                      <td key={o.propId ?? "g"} style={{ textAlign: "right", fontWeight: 700, background: o === erg.gesamt ? "var(--bg3)" : undefined }}>{eur2(o.einnahmen.summe)}</td>
                    ))}
                  </tr>

                  <tr><td colSpan={spalten.length + 1} style={{ fontWeight: 700, color: "var(--red)", paddingTop: 10 }}>Werbungskosten</td></tr>
                  {wkPos.map((p) => (
                    <tr key={p.key}>
                      <td style={{ paddingLeft: 12, color: "var(--muted)" }}>{p.label}</td>
                      {spalten.map((o) => num(o, p.key, o === erg.gesamt))}
                    </tr>
                  ))}
                  <tr>
                    <td style={{ fontWeight: 600 }}>Summe Werbungskosten</td>
                    {spalten.map((o) => (
                      <td key={o.propId ?? "g"} style={{ textAlign: "right", fontWeight: 700, background: o === erg.gesamt ? "var(--bg3)" : undefined }}>{eur2(o.werbungskosten.summe)}</td>
                    ))}
                  </tr>

                  <tr style={{ borderTop: "2px solid var(--line2)" }}>
                    <td style={{ fontWeight: 700 }}>Überschuss / Verlust</td>
                    {spalten.map((o) => (
                      <td key={o.propId ?? "g"} style={{ textAlign: "right", fontWeight: 700, color: o.ueberschuss >= 0 ? "var(--gold)" : "var(--red)", background: o === erg.gesamt ? "var(--bg3)" : undefined }}>
                        {eur2(o.ueberschuss)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 14, lineHeight: 1.6 }}>
            Hinweis: Diese Aufstellung ist eine Hilfestellung zur Anlage V und ersetzt keine Steuerberatung.
            Schuldzinsen sind aus aktueller Restschuld × Zinssatz geschätzt; Kautionen gelten als durchlaufende Posten und sind nicht enthalten.
          </div>
        </>
      )}
    </div>
  );
}

function KennzahlCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="card">
      <div className="card-body">
        <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
      </div>
    </div>
  );
}
