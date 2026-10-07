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
import { bestandAusMyImmo, mitBestand } from "@/lib/kauf/selbstauskunftBestand";
import { mitGeltendenBetraegen } from "@/lib/sollAb";

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

  // Bestand in MyImmo für den Abgleich mit der Selbstauskunft (Audit 07.10.2026, B21):
  // dieselben Regeln wie Dashboard (Soll-Kaltmiete) und /kredite (Raten, Restschuld).
  const heute = heuteBerlin();
  const [{ data: kRows }, { data: pRows }, { data: mRows }, { data: zRows }] = await Promise.all([
    supabase.from("kredite").select("betrag,restschuld,monatsrate,zinssatz"),
    supabase.from("properties").select("id,typ,miete"),
    supabase.from("mieter").select("id,prop_id,kaltmiete,stellplatz_miete,mietbeginn,mietende"),
    supabase.from("miet_zeitraeume").select("*"),
  ]);
  const mieterJetzt = mitGeltendenBetraegen((mRows ?? []) as { id: string; prop_id: string | null }[], (zRows ?? []) as never[], heute.slice(0, 7));
  const bestand = bestandAusMyImmo(kRows ?? [], pRows ?? [], mieterJetzt, heute);

  // In der Demo steht ein fester Beispielstand statt des leeren Formulars —
  // die Selbstauskunft liegt verschluesselt in der DB und kann dort nicht
  // vorbelegt werden. Kredite und Mieten kommen dort aus dem Demo-Bestand — vorher
  // widersprach das Bankdokument dem eigenen Konto (180 € Raten bei 4.490 €).
  const auskunft = demo ? mitBestand(DEMO_SELBSTAUSKUNFT, bestand) : selbstauskunft;

  // Vertreter für den Kreditantrag: nur gültige Vollmachten zur Auswahl (Server prüft erneut).
  const { data: vRows } = await supabase
    .from("vertreter").select("id,vorname,nachname,gueltig_bis,widerrufen_am").order("created_at");
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
        bestand={bestand.darlehen > 0 || bestand.kaltmiete > 0 ? bestand : null}
        demo={demo}
        vertreter={vertreter}
      />
    </div>
  );
}
