import { createClient } from "@/lib/supabase/server";
import { aktuellerNutzer } from "@/lib/supabase/nutzer";
import { istDemoKonto } from "@/lib/demo";
import type { Kalkulation } from "@/lib/types";
import ObjektRechner from "@/components/kauf/ObjektRechner";
import WegKopf from "@/components/aufbau/WegKopf";
import { SANIERUNG_PARAM, sanierungAusParam } from "@/lib/sanierung/uebergabe";

export const metadata = { title: "Objekte vergleichen — BuyImmo" };
export const dynamic = "force-dynamic";

// Kaufweg Schritt 1 (Umbau 06.10.2026, Vorgabe Jonas): „fünf interessante, die man selber gut findet,
// eintragen … einmal durchrechnen, Mietrendite und und und. Dann muss man die Objekte vergleichen
// können.“ Der Objekt-Rechner lag vorher in Schritt 1 des Kauf-Assistenten — jetzt eigene Seite mit
// dem Vergleich darunter. `?sanierung=<Euro>&objekt=<id>` kommt aus dem Sanierungs-Guide: Der Betrag
// gehört zu der Kaufprüfung, für die die Besichtigung lief.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function VergleichPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await props.searchParams;
  const sanierungStart = sanierungAusParam(sp[SANIERUNG_PARAM]);
  const objektRoh = Array.isArray(sp.objekt) ? sp.objekt[0] : sp.objekt;
  const startObjektId = typeof objektRoh === "string" && UUID.test(objektRoh) ? objektRoh : null;

  const supabase = await createClient();
  const user = await aktuellerNutzer();
  const { data: rows } = await supabase
    .from("kalkulationen")
    .select("*")
    .eq("user_id", user?.id ?? "")
    .order("created_at", { ascending: false });

  return (
    <div className="fade-up">
      <div className="topbar">
        <div>
          <div className="topbar-kicker">BuyImmo · Schritt 1</div>
          <div className="topbar-title">Objekte vergleichen</div>
          <div className="topbar-sub">Kandidaten eintragen, durchrechnen und nebeneinanderlegen</div>
        </div>
      </div>
      <hr className="topbar-rule" />
      <WegKopf schritt="vergleichen" />
      <ObjektRechner
        gespeichert={(rows ?? []) as Kalkulation[]}
        demo={istDemoKonto(user?.email)}
        sanierungStart={sanierungStart}
        startObjektId={startObjektId}
      />
    </div>
  );
}
