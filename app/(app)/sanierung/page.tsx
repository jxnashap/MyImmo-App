import SanierungsRechner from "@/components/SanierungsRechner";
import { KATALOG, KATALOG_STAND } from "@/lib/sanierung/katalog";

export const metadata = { title: "Sanierungsrechner — BuyImmo" };

// Sanierungsrechner (BuyImmo, 05.10.2026): Stufe 1 = Materialkosten von–bis, Arbeitszeit nach
// eigenem Stundensatz, eigene Posten. Keine Datenbank — der Entwurf liegt im Browser.
// Rechnung: lib/sanierung/rechner.ts, Preise und Verbrauch mit Quelle: lib/sanierung/katalog.ts.
export default function SanierungPage() {
  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-kicker">BuyImmo · Rechnen</div>
          <div className="topbar-title">Sanierungsrechner</div>
          <div className="topbar-sub">Räume ausmessen, anhaken was gemacht wird — Material von–bis, Arbeitszeit nach deinem Stundensatz</div>
        </div>
      </div>
      <hr className="topbar-rule" />
      <SanierungsRechner katalog={KATALOG} stand={KATALOG_STAND} />
    </div>
  );
}
