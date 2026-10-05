// Mieterportal: Wohnung + Vertragsdaten, Anliegen (mit Anhängen) und
// Dokument-Anfragen — umgeschaltet über die Glass-Toolbar oben in der
// Mitte (Businessplan Kap. 14 "Das Mieterportal").
//
// Daten und Darstellung liegen seit dem 01.10.2026 in `lib/portalDaten.ts`
// und `components/PortalAnsicht.tsx` — dieselben, die der Vermieter in der
// Vorschau unter /anliegen?tab=vorschau sieht. Hier bleibt nur der Rahmen.
import { createClient } from "@/lib/supabase/server";
import { aktuellerNutzer } from "@/lib/supabase/nutzer";
import { ladePortalDaten } from "@/lib/portalDaten";
import PortalAnsicht, { portalTab } from "@/components/PortalAnsicht";

export default async function PortalPage(
  props: {
    searchParams: Promise<{ tab?: string; vorgang?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const tab = portalTab(searchParams.tab);

  const supabase = await createClient();
  const user = await aktuellerNutzer();
  const daten = await ladePortalDaten(supabase, { art: "mieter", mieterUserId: user!.id });

  return (
    <PortalAnsicht
      daten={daten}
      tab={tab}
      hrefFuer={(t) => `/portal?tab=${t}`}
      kopfzeile={user?.email}
      vorgang={searchParams.vorgang ?? null}
    />
  );
}
