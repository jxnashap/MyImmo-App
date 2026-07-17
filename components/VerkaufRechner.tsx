"use client";
import { useMemo, useState } from "react";
import { ShieldCheck, TriangleAlert, Info } from "lucide-react";
import { berechneVerkauf } from "@/lib/verkauf";
import { datum as fmtDatum } from "@/lib/format";

const eur = (n: number) => "€ " + Math.round(n).toLocaleString("de-DE");
const num = (s: string) => parseFloat(s.replace(",", ".")) || 0;

export default function VerkaufRechner() {
  const [vp, setVp] = useState("");
  const [kaufdatum, setKaufdatum] = useState("");
  const [kp, setKp] = useState("");
  const [knk, setKnk] = useState("");
  const [afa, setAfa] = useState("");
  const [vk, setVk] = useState("");
  const [rest, setRest] = useState("");
  const [vfe, setVfe] = useState("");
  const [satz, setSatz] = useState("42");

  const r = useMemo(() => {
    if (!num(vp)) return null;
    return berechneVerkauf({
      verkaufspreis: num(vp), kaufdatum: kaufdatum || null, kaufpreis: num(kp),
      kaufnebenkosten: num(knk), afaKumuliert: num(afa), verkaufskosten: num(vk),
      restschuld: num(rest), vorfaelligkeit: num(vfe), steuersatz: num(satz),
    });
  }, [vp, kaufdatum, kp, knk, afa, vk, rest, vfe, satz]);

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 320px", display: "grid", gap: 10 }}>
        <div className="form-row">
          <div className="form-group"><label>Voraussichtl. Verkaufspreis (€)</label><input value={vp} onChange={(e) => setVp(e.target.value)} inputMode="decimal" /></div>
          <div className="form-group"><label>Kaufdatum (Notarvertrag)</label><input type="date" value={kaufdatum} onChange={(e) => setKaufdatum(e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>damaliger Kaufpreis (€)</label><input value={kp} onChange={(e) => setKp(e.target.value)} inputMode="decimal" /></div>
          <div className="form-group"><label>damalige Kaufnebenkosten (€)</label><input value={knk} onChange={(e) => setKnk(e.target.value)} inputMode="decimal" /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>bisher genutzte AfA (€)</label><input value={afa} onChange={(e) => setAfa(e.target.value)} inputMode="decimal" placeholder="erhöht den Gewinn" /></div>
          <div className="form-group"><label>Verkaufskosten (Makler/Notar) (€)</label><input value={vk} onChange={(e) => setVk(e.target.value)} inputMode="decimal" /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>Restschuld Darlehen (€)</label><input value={rest} onChange={(e) => setRest(e.target.value)} inputMode="decimal" /></div>
          <div className="form-group"><label>Vorfälligkeitsentschädigung (€)</label><input value={vfe} onChange={(e) => setVfe(e.target.value)} inputMode="decimal" /></div>
        </div>
        <div className="form-group" style={{ maxWidth: 220 }}><label>persönl. Steuersatz (%)</label><input value={satz} onChange={(e) => setSatz(e.target.value)} inputMode="decimal" /></div>
      </div>

      <div style={{ flex: "1 1 280px", minWidth: 260 }}>
        <div className="section" style={{ marginBottom: 0 }}>
          <div className="section-body">
            {!r ? (
              <p style={{ fontSize: 13, color: "var(--faint)" }}>Verkaufspreis eingeben für die Berechnung.</p>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  {r.spekulationsfrei ? (
                    <span className="badge badge-green"><ShieldCheck size={12} style={{ verticalAlign: "-1px" }} /> Spekulationsfrist abgelaufen — steuerfrei</span>
                  ) : (
                    <span className="badge badge-amber"><TriangleAlert size={12} style={{ verticalAlign: "-1px" }} /> Innerhalb der 10-Jahres-Frist</span>
                  )}
                </div>
                {r.steuerfreiAb && !r.spekulationsfrei && (
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>Steuerfrei ab: <strong>{fmtDatum(r.steuerfreiAb)}</strong></div>
                )}
                {!r.spekulationsfrei && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                      <span style={{ color: "var(--muted)" }}>Veräußerungsgewinn</span><span style={{ fontWeight: 600 }}>{eur(r.veraeusserungsgewinn)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                      <span style={{ color: "var(--muted)" }}>Spekulationssteuer</span><span style={{ fontWeight: 600, color: "var(--red)" }}>−{eur(r.spekulationssteuer)}</span>
                    </div>
                  </>
                )}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
                  <div style={{ fontSize: 11.5, color: "var(--muted)" }}>Netto-Erlös nach Tilgung, Kosten &amp; Steuer</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: r.nettoErloes >= 0 ? "var(--green)" : "var(--red)" }}>{eur(r.nettoErloes)}</div>
                </div>
                <div style={{ marginTop: 12, fontSize: 11, color: "var(--faint)", display: "flex", gap: 7 }}>
                  <Info size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>Überschlägige Rechnung, keine Steuerberatung. § 23 EStG kennt Ausnahmen (z. B. Eigennutzung im Verkaufsjahr + 2 Vorjahren = steuerfrei). Bei Verkauf mehrerer Objekte in kurzer Zeit droht der gewerbliche Grundstückshandel („Drei-Objekt-Grenze").</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
