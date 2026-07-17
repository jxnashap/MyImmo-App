import VerkaufAssistent from "@/components/VerkaufAssistent";

export const metadata = { title: "Verkauf-Assistent — MyImmo" };

// Verkauf-Assistent: Ablaufschema von der Wertermittlung bis zur Übergabe.
export default function VerkaufPage() {
  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-title">Verkauf-Assistent</div>
          <div className="topbar-sub">Vom Wert bis zur Übergabe — mit Spekulationssteuer- und Netto-Erlös-Check</div>
        </div>
      </div>
      <VerkaufAssistent />
    </div>
  );
}
