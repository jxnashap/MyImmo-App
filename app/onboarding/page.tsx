import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import WillkommenWizard from "@/components/WillkommenWizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Erste Immobilie — MyImmo" };

// Willkommens-Assistent (Design-Handoff Phase 1): erstes Objekt (oder ein
// weiteres) in 4 Schritten anlegen — Objekt → Mietverhältnis → Kredit →
// Ergebnis mit gerechneten KPIs. Hinweis: /willkommen ist das Freischalt-Gate.
export default async function OnboardingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { count } = await supabase.from("properties").select("id", { count: "exact", head: true });

  return <WillkommenWizard ersteImmobilie={(count ?? 0) === 0} />;
}
