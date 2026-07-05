"use client";

// CO₂-Kostenaufteilung (CO2KostAufG): Eingaben von der Brennstoffrechnung,
// live berechnete Stufe (10-teilige Farbleiste) + Vermieter-/Mieteranteil.
// Reine Anzeige — gebucht wird hier nichts.

import { useMemo, useState } from "react";
import { co2Aufteilung, CO2_STUFEN, CO2_PREIS } from "@/lib/co2";
import { eur2 } from "@/lib/format";

// Farbverlauf grün → rot über die 10 Stufen.
const STUFEN_FARBEN = [
  "#3fae6a", "#5fb75f", "#84bf53", "#aac648", "#cfc93e",
  "#d9b038", "#dd9133", "#de712e", "#d94f2a", "#c93326",
];

export default function Co2Rechner({ defaultFlaeche }: { defaultFlaeche?: number | null }) {
  const jetzt = new Date().getFullYear();
  const [co2Kg, setCo2Kg] = useState("");
  const [kosten, setKosten] = useState("");
  const [flaeche, setFlaeche] = useState(
    defaultFlaeche && defaultFlaeche > 0 ? String(defaultFlaeche) : "",
  );
  const [jahr, setJahr] = useState(String(jetzt - 1)); // Abrechnung meist fürs Vorjahr
  const [gewerbe, setGewerbe] = useState(false);

  const kg = Number(co2Kg.replace(",", "."));
  const m2 = Number(flaeche.replace(",", "."));
  const kostenNum = kosten.trim() === "" ? null : Number(kosten.replace(",", "."));
  const bereit = Number.isFinite(kg) && kg > 0 && Number.isFinite(m2) && m2 > 0;

  const ergebnis = useMemo(() => {
    if (!bereit) return null;
    return co2Aufteilung({
      co2Kg: kg,
      co2Kosten: kostenNum != null && Number.isFinite(kostenNum) ? kostenNum : null,
      flaeche: m2,
      jahr: Number(jahr),
      gewerbe,
    });
  }, [bereit, kg, kostenNum, m2, jahr, gewerbe]);

  const geschaetzt = ergebnis != null && (kostenNum == null || !Number.isFinite(kostenNum));

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

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <label style={feld(130)}>
          <span>CO₂-Menge (kg) *</span>
          <input type="number" step="0.01" min="0" style={inputStil} value={co2Kg} onChange={(e) => setCo2Kg(e.target.value)} placeholder="z. B. 4000" />
        </label>
        <label style={feld(130)}>
          <span>CO₂-Kosten (€, optional)</span>
          <input type="number" step="0.01" min="0" style={inputStil} value={kosten} onChange={(e) => setKosten(e.target.value)} placeholder="leer = schätzen" />
        </label>
        <label style={feld(140)}>
          <span>Beheizte Wohnfläche (m²) *</span>
          <input type="number" step="0.01" min="0" style={inputStil} value={flaeche} onChange={(e) => setFlaeche(e.target.value)} />
        </label>
        <label style={feld(90)}>
          <span>Jahr</span>
          <select style={inputStil} value={jahr} onChange={(e) => setJahr(e.target.value)}>
            {Object.keys(CO2_PREIS).map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--muted)", marginBottom: 8, cursor: "pointer" }}>
          <input type="checkbox" checked={gewerbe} onChange={(e) => setGewerbe(e.target.checked)} />
          Gewerbe (50/50)
        </label>
      </div>

      {!ergebnis ? (
        <p style={{ color: "var(--faint)", fontSize: 12, margin: "4px 0 10px" }}>
          CO₂-Menge und Wohnfläche eingeben — beides steht auf der Brennstoff- bzw. Wärmerechnung.
        </p>
      ) : (
        <>
          {/* Stufenleiste grün → rot */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 3 }}>
              {CO2_STUFEN.map((s, i) => {
                const aktiv = !gewerbe && i === ergebnis.stufeIndex;
                return (
                  <div key={i} style={{ flex: 1, textAlign: "center" }}>
                    <div
                      style={{
                        height: aktiv ? 16 : 8,
                        borderRadius: 4,
                        background: STUFEN_FARBEN[i],
                        opacity: gewerbe ? 0.25 : aktiv ? 1 : 0.35,
                        outline: aktiv ? "2px solid var(--text)" : "none",
                        outlineOffset: 1,
                        transition: "all .15s ease",
                      }}
                    />
                    <div style={{ fontSize: 9.5, color: aktiv ? "var(--text)" : "var(--faint)", marginTop: 4, fontWeight: aktiv ? 600 : 400 }}>
                      {s.max == null ? `≥${s.min}` : `${s.min}–${s.max}`}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 2 }}>
              kg CO₂ / m² · Jahr {gewerbe ? "— bei Gewerbe gilt pauschal 50/50" : ""}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div className="glass-card" style={{ padding: "10px 14px", minWidth: 150 }}>
              <div style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px" }}>Spez. Ausstoß</div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>{String(ergebnis.spez).replace(".", ",")} kg/m²·a</div>
            </div>
            <div className="glass-card" style={{ padding: "10px 14px", minWidth: 150 }}>
              <div style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px" }}>CO₂-Kosten gesamt</div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>
                {eur2(ergebnis.kostenGesamt)}
                {geschaetzt && (
                  <span style={{ fontSize: 10.5, color: "var(--gold)", marginLeft: 6 }}>
                    geschätzt ({CO2_PREIS[Number(jahr)] ?? "—"} €/t)
                  </span>
                )}
              </div>
            </div>
            <div className="glass-card" style={{ padding: "10px 14px", minWidth: 150 }}>
              <div style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px" }}>Ihr Anteil (Vermieter)</div>
              <div style={{ fontSize: 17, fontWeight: 600, color: "var(--red)" }}>
                {eur2(ergebnis.vermieterAnteil)} <span style={{ fontSize: 12, color: "var(--muted)" }}>({ergebnis.vermieterProzent} %)</span>
              </div>
            </div>
            <div className="glass-card" style={{ padding: "10px 14px", minWidth: 150 }}>
              <div style={{ fontSize: 10.5, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".5px" }}>Umlegbar auf Mieter</div>
              <div style={{ fontSize: 17, fontWeight: 600, color: "var(--green)" }}>
                {eur2(ergebnis.mieterAnteil)} <span style={{ fontSize: 12, color: "var(--muted)" }}>({ergebnis.mieterProzent} %)</span>
              </div>
            </div>
          </div>
        </>
      )}

      <p style={{ fontSize: 11, color: "var(--muted)", margin: "12px 0 0" }}>
        CO₂-Menge und -Kosten stehen auf der Brennstoff- bzw. Wärmelieferrechnung. Bei
        Selbstversorgung der Mieter (z. B. Gasetagenheizung) müssen diese ihren
        Erstattungsanspruch innerhalb von 12 Monaten nach Rechnungserhalt geltend machen.
      </p>
      <p style={{ fontSize: 10.5, color: "var(--faint)", margin: "4px 0 0" }}>
        Vereinfachte Berechnung nach CO2KostAufG — keine Steuer- oder Rechtsberatung.
      </p>
    </div>
  );
}
