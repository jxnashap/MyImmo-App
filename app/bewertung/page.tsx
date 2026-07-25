import BewertungAssistent from "@/components/BewertungAssistent";

export const metadata = { title: "Marktwert schätzen — MyImmo" };

export default function BewertungPage() {
  return (
    <div className="fade-up">
      <div className="topbar" style={{ alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".16em", color: "var(--gold)", fontWeight: 600, marginBottom: 10 }}>Kalkulator · Marktwert</div>
          <div className="topbar-title">Marktwert-Schätzer</div>
          <div className="topbar-sub">Objekt selbst bewerten nach ImmoWertV — Ertrags- oder Sachwert</div>
        </div>
      </div>
      <BewertungAssistent />
    </div>
  );
}
