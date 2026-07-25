import { createClient } from "@/lib/supabase/server";
import type { Kalkulation } from "@/lib/types";
import KaufAssistent from "@/components/KaufAssistent";
import KaufRadar, { type RadarKandidat } from "@/components/kauf/KaufRadar";
import { ladeSelbstauskunft } from "@/lib/actions/selbstauskunft";

export const metadata = { title: "Kauf-Assistent — MyImmo" };
export const dynamic = "force-dynamic";

// Kauf-Assistent: geführter Ablauf inkl. eingebettetem Objekt-Rechner
// (früher „Cockpit"/„Roter Faden"). Die gespeicherten Kalkulationen und die
// Selbstauskunft werden hier serverseitig geladen und an den Client-Stepper
// übergeben.
export default async function KaufPage() {
  const supabase = createClient();
  const { data: rows } = await supabase
    .from("kalkulationen")
    .select("*")
    .order("created_at", { ascending: false });
  const selbstauskunft = await ladeSelbstauskunft();

  // Kauf-Radar (Design-Handoff): gespeicherte Kalkulationen → Deal-Score-Karten.
  // Nur Objekte mit Kaufpreis UND Kaltmiete sind score-bar (Vermietungsfall).
  const zahl = (s: string | undefined) => {
    const n = Number((s ?? "").replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const kandidaten: RadarKandidat[] = ((rows ?? []) as Kalkulation[])
    .filter((k) => (k.summary?.kp ?? 0) > 0 && (k.summary?.kaltmiete ?? 0) > 0)
    .map((k) => ({
      id: k.id,
      name: k.name,
      preis: k.summary.kp,
      miete: k.summary.kaltmiete,
      flaeche: zahl(k.data?.flaeche),
      lage: k.data?.radar_lage != null ? Number(k.data.radar_lage) : null,
      zustand: k.data?.radar_zustand != null ? Number(k.data.radar_zustand) : null,
    }));

  return (
    <div className="fade-up">
      <div className="topbar" style={{ alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".16em", color: "var(--gold)", fontWeight: 600, marginBottom: 10 }}>Kalkulator · Kauf-Radar</div>
          <div className="topbar-title">Objekte prüfen</div>
          <div className="topbar-sub">Jedes Objekt bekommt einen Deal-Score aus harten Fakten — Rendite, Cashflow, Lage, Zustand</div>
        </div>
      </div>
      <KaufRadar kandidaten={kandidaten} />
      <div style={{ height: 1, background: "var(--line)", margin: "8px 0 26px" }} />
      <div className="topbar" style={{ marginBottom: 14 }}>
        <div>
          <div className="topbar-title" style={{ fontSize: 18 }}>Kauf-Assistent</div>
          <div className="topbar-sub">Vom gefundenen Objekt bis zur Finanzierungsanfrage — Schritt für Schritt</div>
        </div>
      </div>
      <KaufAssistent gespeichert={(rows ?? []) as Kalkulation[]} selbstauskunft={selbstauskunft} />
    </div>
  );
}
