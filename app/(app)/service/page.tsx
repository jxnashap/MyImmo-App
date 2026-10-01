// Service-Portal (Rolle "service"): schlanke Shell wie das Mieterportal —
// erhaltene Aufträge der verknüpften Vermieter abarbeiten.
//
// Daten und Darstellung liegen seit dem 01.10.2026 in
// lib/servicePortalDaten.ts und components/ServicePortalAnsicht.tsx —
// dieselben, die der Demo-Vermieter unter „Ansicht Service" sieht.
import { createClient } from "@/lib/supabase/server";
import { aktuellerNutzer } from "@/lib/supabase/nutzer";
import { ladeServicePortalDaten } from "@/lib/servicePortalDaten";
import { istDemoKonto } from "@/lib/demo";
import ServicePortalAnsicht from "@/components/ServicePortalAnsicht";

export default async function ServicePortalPage() {
  const supabase = await createClient();
  const user = await aktuellerNutzer();
  const daten = await ladeServicePortalDaten(supabase, { art: "service", serviceUserId: user!.id });

  // Demo-Hausmeister: Formulare ausfüllbar, nichts wird gesendet (statt
  // gesperrter Felder und eines Fehlers der Schreibsperre beim Absenden).
  return <ServicePortalAnsicht daten={daten} kopfzeile={user?.email} vorschau={istDemoKonto(user?.email)} />;
}
