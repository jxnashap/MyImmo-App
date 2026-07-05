"use client";

// Eingabe-Panel „CO₂-Kostenaufteilung" auf der NK-Seite (nicht im Druck/PDF —
// dort erscheint der berechnete Block). Autosave onBlur wie im
// PositionsManager; nach dem Speichern rendert der Brief per refresh neu.

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { co2Aufteilung, CO2_STUFEN } from "@/lib/co2";
import { eur2 } from "@/lib/format";
import { speichereNkCo2, loescheNkCo2, bucheCo2Vermieteranteil } from "@/lib/actions/nkco2";
import { useToast } from "@/components/Toast";

export type NkCo2Row = {
  co2_kg: number | null;
  co2_kosten: number | null;
  flaeche: number | null;
  gewerbe: boolean | null;
} | null;

const s = (n: number | null | undefined) => (n != null ? String(n) : "");

export default function NkCo2Panel({
  mieterId,
  jahr,
  gespeichert,
  defaultFlaeche,
}: {
  mieterId: string;
  jahr: number;
  gespeichert: NkCo2Row;
  defaultFlaeche: number | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [, startSave] = useTransition();
  const [buchen, startBuchen] = useTransition();

  const [kg, setKg] = useState(s(gespeichert?.co2_kg));
  const [kosten, setKosten] = useState(s(gespeichert?.co2_kosten));
  const [flaeche, setFlaeche] = useState(
    gespeichert?.flaeche != null ? String(gespeichert.flaeche) : s(defaultFlaeche),
  );
  const [gewerbe, setGewerbe] = useState(!!gespeichert?.gewerbe);
  useEffect(() => {
    setKg(s(gespeichert?.co2_kg));
    setKosten(s(gespeichert?.co2_kosten));
    setFlaeche(gespeichert?.flaeche != null ? String(gespeichert.flaeche) : s(defaultFlaeche));
    setGewerbe(!!gespeichert?.gewerbe);
  }, [gespeichert, defaultFlaeche]);

  const num = (v: string) => {
    const n = Number(v.replace(",", "."));
    return v.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
  };

  const vorschau = useMemo(() => {
    const k = num(kg);
    const m2 = num(flaeche);
    if (!k || !m2) return null;
    return co2Aufteilung({ co2Kg: k, co2Kosten: num(kosten), flaeche: m2, jahr, gewerbe });
  }, [kg, kosten, flaeche, jahr, gewerbe]);

  const speichere = (patch?: { gewerbe?: boolean }) => {
    const fd = new FormData();
    fd.set("co2_kg", kg);
    fd.set("co2_kosten", kosten);
    fd.set("flaeche", flaeche);
    if (patch?.gewerbe ?? gewerbe) fd.set("gewerbe", "on");
    startSave(async () => {
      const res = await speichereNkCo2(mieterId, jahr, fd);
      toast(res.ok ? "CO₂-Daten gespeichert ✓" : res.error ?? "Speichern fehlgeschlagen.");
      if (res.ok) router.refresh();
    });
  };

  const entfernen = () => {
    setKg("");
    setKosten("");
    setGewerbe(false);
    startSave(async () => {
      const res = await loescheNkCo2(mieterId, jahr);
      toast(res.ok ? "CO₂-Block entfernt ✓" : res.error ?? "Löschen fehlgeschlagen.");
      if (res.ok) router.refresh();
    });
  };

  const alsKostenBuchen = () => {
    startBuchen(async () => {
      const res = await bucheCo2Vermieteranteil(mieterId, jahr);
      toast(
        res.ok
          ? `${eur2(res.betrag ?? 0)} als Kosten gebucht ✓`
          : res.error ?? "Buchen fehlgeschlagen.",
      );
      if (res.ok) router.refresh();
    });
  };

  const inputStil: React.CSSProperties = {
    background: "var(--bg3)",
    border: "1px solid var(--line2)",
    color: "var(--text)",
    borderRadius: 7,
    padding: "7px 9px",
    fontSize: 12.5,
    width: "100%",
  };
  const feld = (breite: number): React.CSSProperties => ({
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 11,
    color: "var(--muted)",
    width: breite,
  });

  const stufe = vorschau ? CO2_STUFEN[vorschau.stufeIndex] : null;

  return (
    <div
      className="no-print"
      style={{ maxWidth: "210mm", margin: "0 auto 14px", background: "var(--bg2)", border: "1px solid var(--line)", borderRadius: 10, padding: "14px 16px" }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>CO₂-Kostenaufteilung (CO2KostAufG)</div>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          optional — Werte von der Brennstoffrechnung; erscheint in Abrechnung + PDF
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <label style={feld(120)}>
          <span>CO₂-Menge (kg)</span>
          <input type="number" step="0.01" min="0" style={inputStil} value={kg} onChange={(e) => setKg(e.target.value)} onBlur={() => speichere()} placeholder="z. B. 4000" />
        </label>
        <label style={feld(140)}>
          <span>CO₂-Kosten (€, leer = schätzen)</span>
          <input type="number" step="0.01" min="0" style={inputStil} value={kosten} onChange={(e) => setKosten(e.target.value)} onBlur={() => speichere()} />
        </label>
        <label style={feld(130)}>
          <span>Beheizte Wohnfläche (m²)</span>
          <input type="number" step="0.01" min="0" style={inputStil} value={flaeche} onChange={(e) => setFlaeche(e.target.value)} onBlur={() => speichere()} />
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--muted)", marginBottom: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={gewerbe}
            onChange={(e) => {
              setGewerbe(e.target.checked);
              speichere({ gewerbe: e.target.checked });
            }}
          />
          Gewerbe (50/50)
        </label>
        {gespeichert && (
          <button type="button" className="btn btn-ghost" style={{ fontSize: 11.5, marginBottom: 2 }} onClick={entfernen}>
            Block entfernen
          </button>
        )}
      </div>

      {vorschau && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 10, fontSize: 12 }}>
          <span style={{ color: "var(--muted)" }}>
            {String(vorschau.spez).replace(".", ",")} kg/m²·a
            {stufe && !gewerbe && (
              <> · Stufe {stufe.max == null ? `ab ${stufe.min}` : `${stufe.min}–${stufe.max}`}</>
            )}
            {" "}→ Mieter {vorschau.mieterProzent} % / Vermieter {vorschau.vermieterProzent} %
          </span>
          <span>
            Gutschrift Mieter: <strong style={{ color: "var(--green)" }}>{eur2(vorschau.vermieterAnteil)}</strong>
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: 11.5 }}
            disabled={buchen || vorschau.vermieterAnteil <= 0}
            onClick={alsKostenBuchen}
            title="Legt eine Kosten-Buchung an (Werbungskosten / Anlage V)"
          >
            {buchen ? "Bucht…" : "Vermieteranteil als Kosten buchen"}
          </button>
        </div>
      )}
    </div>
  );
}
