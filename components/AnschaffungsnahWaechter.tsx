// 15%-Wächter (§ 6 Abs. 1 Nr. 1a EStG) — Server-Komponente, reine Anzeige.
// Zeigt Fortschrittsbalken der Instandsetzungskosten gegen die 15 %-Grenze,
// Statusfarbe und Handlungshinweis. Rendert dezent, wenn inaktiv.
import { euro } from "@/lib/format";
import { ShieldCheck, ShieldAlert, TriangleAlert, Info } from "lucide-react";
import type { AnschaffungsnahErgebnis } from "@/lib/steuer/anschaffungsnah";

const MONATE_DE = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const deDatum = (iso: string) => {
  const [j, m, t] = iso.split("-").map(Number);
  return `${t}. ${MONATE_DE[(m ?? 1) - 1]} ${j}`;
};

export default function AnschaffungsnahWaechter({ e }: { e: AnschaffungsnahErgebnis }) {
  if (e.status === "inaktiv") {
    return (
      <div className="section" style={{ marginBottom: 0 }}>
        <div className="section-header"><h3><Info size={15} style={{ verticalAlign: "-2px" }} /> 15 %-Wächter (Steuer)</h3></div>
        <div className="section-body" style={{ fontSize: 12.5, color: "var(--muted)" }}>{e.hinweis}</div>
      </div>
    );
  }

  const farbe =
    e.status === "ueberschritten" ? "var(--red)" :
    e.status === "warnung" ? "var(--gold)" :
    e.status === "abgelaufen" ? "var(--muted)" : "var(--green)";
  const Icon =
    e.status === "ueberschritten" ? TriangleAlert :
    e.status === "warnung" ? ShieldAlert :
    e.status === "abgelaufen" ? Info : ShieldCheck;
  const badge =
    e.status === "ueberschritten" ? "badge-red" :
    e.status === "warnung" ? "badge-gold" :
    e.status === "abgelaufen" ? "badge-neutral" : "badge-green";
  const label =
    e.status === "ueberschritten" ? "Grenze überschritten" :
    e.status === "warnung" ? "Achtung" :
    e.status === "abgelaufen" ? "Frist abgelaufen" : "Sicher";

  const balken = Math.min(100, e.ausgeschoepftProzent);

  return (
    <div className="section" style={{ marginBottom: 0, borderColor: e.status === "ueberschritten" || e.status === "warnung" ? farbe : undefined }}>
      <div className="section-header">
        <h3><Icon size={15} style={{ verticalAlign: "-2px", color: farbe }} /> 15 %-Wächter (Steuer)</h3>
        <span className={`badge ${badge}`}>{label}</span>
      </div>
      <div className="section-body">
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6 }}>
          <span style={{ color: "var(--muted)" }}>Instandsetzung in 3 Jahren</span>
          <span style={{ fontWeight: 600 }}>{euro(e.kostenImFenster)} / {euro(e.grenze)}</span>
        </div>
        <div style={{ height: 8, borderRadius: 5, background: "var(--line)", overflow: "hidden" }}>
          <div style={{ width: `${balken}%`, height: "100%", background: farbe, transition: "width .3s" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--faint)", marginTop: 5 }}>
          <span>{e.ausgeschoepftProzent.toLocaleString("de-DE", { maximumFractionDigits: 1 })} % der Grenze</span>
          {e.fensterBis && (
            <span>
              {e.status === "abgelaufen"
                ? `Fenster endete ${deDatum(e.fensterBis)}`
                : `Fenster bis ${deDatum(e.fensterBis)} · noch ${e.monateVerbleibend} Mon.`}
            </span>
          )}
        </div>
        <p style={{ fontSize: 12, color: e.status === "ok" || e.status === "abgelaufen" ? "var(--muted)" : farbe, marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
          {e.hinweis}
        </p>
        <p style={{ fontSize: 10.5, color: "var(--faint)", marginTop: 8, marginBottom: 0 }}>
          Basis: Gebäude-Anschaffungskosten {euro(e.gebaeudeAK)} (Kaufpreis × Gebäudeanteil). Zählt Reparatur/Instandhaltung/Modernisierung.
          Ohne Netto-/USt-Trennung — Näherung, keine Steuerberatung.
        </p>
      </div>
    </div>
  );
}
