"use client";

import { useEffect, useState } from "react";
import { fmt, fmtE, pct, CP_STORAGE_KEY, type CpData } from "@/lib/kalk";

function Spalte({ titel, zeilen }: { titel: string; zeilen: [string, string, string?][] }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--muted)", marginBottom: 10 }}>{titel}</div>
      {zeilen.map(([l, v, c], i) => (
        <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid var(--line)", fontSize: 12, display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--muted)" }}>{l}</span>
          <strong style={{ color: c ?? "var(--text)" }}>{v}</strong>
        </div>
      ))}
    </div>
  );
}

export default function Bankgespraech() {
  const [d, setD] = useState<CpData | null>(null);
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CP_STORAGE_KEY);
      if (raw) setD(JSON.parse(raw) as CpData);
    } catch { /* ignore */ }
    setGeladen(true);
  }, []);

  if (!geladen) return null;

  if (!d || !d.kp) {
    return (
      <div className="section">
        <div className="section-body">
          <div className="empty">
            <div className="empty-icon">🏦</div>
            <h4>Fülle zuerst das Cockpit aus</h4>
            <p>Die Übersicht übernimmt automatisch die Zahlen aus deiner letzten Cockpit-Kalkulation.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="section" id="bank-print">
      <div className="section-body">
        <div style={{ fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 600, marginBottom: 16, color: "var(--gold)" }}>
          Investitionsübersicht für das Bankgespräch
        </div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 20 }}>{d.adresse || "Adresse nicht angegeben"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <Spalte titel="Investition" zeilen={[
            ["Kaufpreis", fmtE(d.kp)],
            ["Preis/m²", fmtE(d.qm) + "/m²"],
            ["Kaufnebenkosten", fmtE(d.nk)],
            ["Gesamtinvestition", fmtE(d.gesamtInvest)],
          ]} />
          <Spalte titel="Finanzierung" zeilen={[
            ["Hauptdarlehen", fmtE(d.d1Summe)],
            ["Weiteres Darlehen", fmtE(d.d2Summe)],
            ["Eigenkapital", fmtE(d.eigenkapital)],
            ["Rate gesamt", fmtE(d.gesRate) + "/Mo"],
          ]} />
          <Spalte titel="Rentabilität" zeilen={[
            ["Nettokaltmiete", fmtE(d.kaltmiete) + "/Mo"],
            ["Bruttomietrendite", pct(d.brutto)],
            ["Kaufpreisfaktor", d.faktor > 0 ? fmt(d.faktor, 1) + "x" : "–"],
            ["Cashflow n.St.", fmtE(d.cfNetto) + "/Mo", d.cfNetto < 0 ? "var(--red)" : "var(--text)"],
          ]} />
        </div>
        <div style={{ marginTop: 16, padding: "10px 14px", background: "var(--bg3)", borderRadius: 7, fontSize: 11, color: "var(--muted)" }}>
          Hinweis: Diese Übersicht basiert auf den Eingaben im Cockpit. Keine Gewähr für die Richtigkeit der Angaben. Kein Ersatz für Rechts-, Steuer- oder Finanzberatung.
        </div>
      </div>
    </div>
  );
}
