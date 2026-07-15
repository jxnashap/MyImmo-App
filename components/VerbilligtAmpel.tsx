// Ampel verbilligte Vermietung (§ 21 Abs. 2 EStG) — reine Anzeige.
import { euro } from "@/lib/format";
import { berechneVerbilligt, type VerbilligtInput } from "@/lib/steuer/verbilligt";
import { Gauge } from "lucide-react";

export default function VerbilligtAmpel({ input }: { input: VerbilligtInput }) {
  const e = berechneVerbilligt(input);

  if (e.status === "inaktiv") {
    return (
      <div className="section">
        <div className="section-header"><h3><Gauge size={15} style={{ verticalAlign: "-2px" }} /> Verbilligte Vermietung (Steuer)</h3></div>
        <div className="section-body" style={{ fontSize: 12.5, color: "var(--muted)" }}>{e.hinweis}</div>
      </div>
    );
  }

  const farbe = e.status === "rot" ? "var(--red)" : e.status === "gelb" ? "var(--gold)" : "var(--green)";
  const badge = e.status === "rot" ? "badge-red" : e.status === "gelb" ? "badge-gold" : "badge-green";
  const label = e.status === "rot" ? "unter 50 %" : e.status === "gelb" ? "50–66 %" : "≥ 66 %";
  const balken = Math.min(100, e.prozent);

  return (
    <div className="section" style={{ borderColor: e.status !== "gruen" ? farbe : undefined }}>
      <div className="section-header">
        <h3><Gauge size={15} style={{ verticalAlign: "-2px", color: farbe }} /> Verbilligte Vermietung (Steuer)</h3>
        <span className={`badge ${badge}`}>{label}</span>
      </div>
      <div className="section-body">
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
          <span style={{ color: "var(--muted)" }}>Ist-Warmmiete / ortsüblich</span>
          <span style={{ fontWeight: 600 }}>{euro(e.istWarm)} / {euro(e.vergleichWarm)}</span>
        </div>
        <div style={{ position: "relative", height: 8, borderRadius: 5, background: "var(--line)", overflow: "hidden" }}>
          <div style={{ width: `${balken}%`, height: "100%", background: farbe, transition: "width .3s" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--faint)", marginTop: 5 }}>
          <span>{e.prozent.toLocaleString("de-DE", { maximumFractionDigits: 1 })} % der ortsüblichen Warmmiete</span>
          <span>Schwellen 50 % / 66 %</span>
        </div>
        <p style={{ fontSize: 12, color: e.status === "gruen" ? "var(--muted)" : farbe, marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
          {e.hinweis}
        </p>
        <p style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 8, marginBottom: 0 }}>
          Basis: ortsübliche Vergleichsmiete (€/m²) × Fläche, jeweils zzgl. NK-Vorauszahlung. Näherung, keine Steuerberatung.
        </p>
      </div>
    </div>
  );
}
