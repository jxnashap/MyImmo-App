import SanierungsRechner, { type Ansicht } from "@/components/SanierungsRechner";
import { KATALOG, KATALOG_STAND } from "@/lib/sanierung/katalog";
import { heuteBerlin } from "@/lib/zeitraum";

export const metadata = { title: "Sanierungsrechner — BuyImmo" };

// Sanierungsrechner (BuyImmo, 05.10.2026) mit Guide (Stufe B): Schritt für Schritt, Übersicht und
// Ergebnis über EINEM Entwurf — Material von–bis, Handwerker- und Fachbetrieb-Preise mit Quelle,
// Arbeitszeit nach eigenem Stundensatz, eigene Posten. Keine Datenbank — der Entwurf liegt im Browser.
// Förderung: lib/sanierung/foerderung.ts — der Stichtag kommt vom Server (die Heizungsgrenze sinkt
// ab 2027 halbjährlich; keine Ortszeit im Browser).
// Rechnung: lib/sanierung/auswertung.ts, Preise mit Quelle: lib/sanierung/katalog.ts + arbeiten.ts.
// `?ansicht=uebersicht|ergebnis` öffnet direkt diese Ansicht (sonst die zuletzt benutzte).
const ANSICHTEN: Ansicht[] = ["guide", "uebersicht", "ergebnis"];

export default async function SanierungPage({ searchParams }: { searchParams: Promise<{ ansicht?: string | string[] }> }) {
  const { ansicht } = await searchParams;
  const start = typeof ansicht === "string" && (ANSICHTEN as string[]).includes(ansicht) ? (ansicht as Ansicht) : undefined;
  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-kicker">BuyImmo · Rechnen</div>
          <div className="topbar-title">Sanierungsrechner</div>
          <div className="topbar-sub">Schritt für Schritt von der Wohnung zur Kostenaufstellung und zum Einkaufszettel</div>
        </div>
      </div>
      <hr className="topbar-rule" />
      <SanierungsRechner katalog={KATALOG} stand={KATALOG_STAND} heute={heuteBerlin()} ansicht={start} />
    </div>
  );
}
