import { createClient } from "@/lib/supabase/server";
import { aktuellerNutzer } from "@/lib/supabase/nutzer";
import type { Kalkulation } from "@/lib/types";
import KaufAssistent from "@/components/KaufAssistent";
import { ladeSelbstauskunft } from "@/lib/actions/selbstauskunft";
import { istDemoKonto } from "@/lib/demo";
import { DEMO_SELBSTAUSKUNFT } from "@/lib/kauf/selbstauskunft";
import { vollmachtStatus, vertreterName } from "@/lib/vertreter";
import { heuteBerlin } from "@/lib/zeitraum";
import { redirect } from "next/navigation";
import { SANIERUNG_PARAM, kaufLinkMitSanierung, sanierungAusParam } from "@/lib/sanierung/uebergabe";
import WegKopf from "@/components/aufbau/WegKopf";

export const metadata = { title: "Finanzierung — BuyImmo" };
export const dynamic = "force-dynamic";

// Kauf-Assistent: geführter Ablauf inkl. eingebettetem Objekt-Rechner
// (früher „Cockpit"/„Roter Faden"). Die gespeicherten Kalkulationen und die
// Selbstauskunft werden hier serverseitig geladen und an den Client-Stepper
// übergeben.
export default async function KaufPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Alte Links aus dem Sanierungsrechner (`/kauf?sanierung=…`): Der Objekt-Rechner ist seit dem Umbau
  // (06.10.2026) Schritt 1 unter /vergleich — dorthin, mit demselben (streng gelesenen) Betrag.
  const sanierungStart = sanierungAusParam((await props.searchParams)[SANIERUNG_PARAM]);
  if (sanierungStart != null) redirect(kaufLinkMitSanierung(sanierungStart));
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("kalkulationen")
    .select("*")
    .order("created_at", { ascending: false });
  const selbstauskunft = await ladeSelbstauskunft();
  const user = await aktuellerNutzer();
  const demo = istDemoKonto(user?.email);
  // In der Demo steht ein fester Beispielstand statt des leeren Formulars —
  // die Selbstauskunft liegt verschluesselt in der DB und kann dort nicht
  // vorbelegt werden.
  const auskunft = demo ? DEMO_SELBSTAUSKUNFT : selbstauskunft;

  // Vertreter für den Kreditantrag: nur gültige Vollmachten zur Auswahl (Server prüft erneut).
  const { data: vRows } = await supabase
    .from("vertreter").select("id,vorname,nachname,gueltig_bis,widerrufen_am").order("created_at");
  const heute = heuteBerlin();
  const vertreter = ((vRows ?? []) as { id: string; vorname: string | null; nachname: string; gueltig_bis: string | null; widerrufen_am: string | null }[])
    .filter((v) => { const s = vollmachtStatus(v, heute); return s === "gueltig" || s === "laeuft_ab"; })
    .map((v) => ({ id: v.id, name: vertreterName(v) }));

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-kicker">BuyImmo · Schritt 3</div>
          <div className="topbar-title">Finanzierung</div>
          <div className="topbar-sub">Vom gewählten Objekt bis zur Finanzierungsanfrage — Kauf-Assistent</div>
        </div>
      </div>
      <hr className="topbar-rule" />
      <WegKopf schritt="finanzieren" />
      <KaufAssistent
        gespeichert={(rows ?? []) as Kalkulation[]}
        selbstauskunft={auskunft}
        demo={demo}
        vertreter={vertreter}
      />
    </div>
  );
}
