import Link from "next/link";
import PropertyForm from "@/components/PropertyForm";
import { createProperty } from "@/lib/actions/properties";
import { createClient } from "@/lib/supabase/server";
import { aktuellerNutzer } from "@/lib/supabase/nutzer";
import { objektAusKaufpruefung } from "@/lib/kauf/objektAusKaufpruefung";

// Paket E (06.10.2026): `?aus=<id>` übernimmt eine eigene Kaufprüfung aus BuyImmo als Vorgabe.
// Bereits übernommene Kaufprüfungen werden nicht ein zweites Mal vorbelegt — sonst entstünde
// dasselbe Objekt doppelt.
export default async function NewPropertyPage(props: { searchParams: Promise<{ aus?: string }> }) {
  const { aus } = await props.searchParams;
  let vorbelegung: ReturnType<typeof objektAusKaufpruefung> | undefined;
  let schonUebernommen: string | null = null;
  let kalkName: string | null = null;
  if (aus) {
    const supabase = await createClient();
    const user = await aktuellerNutzer();
    const { data: k } = await supabase
      .from("kalkulationen")
      .select("id,name,data,uebernommen_prop_id")
      .eq("id", aus)
      .eq("user_id", user?.id ?? "")
      .maybeSingle();
    if (k?.uebernommen_prop_id) schonUebernommen = k.uebernommen_prop_id as string;
    else if (k) {
      vorbelegung = objektAusKaufpruefung(k.name as string | null, k.data as Record<string, string> | null);
      kalkName = (k.name as string | null) ?? null;
    }
  }

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={aus ? "/abschluss" : "/properties"} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px", whiteSpace: "nowrap", flexShrink: 0 }}>← Zurück</Link>
          <div><div className="topbar-title">Neues Objekt</div></div>
        </div>
        {/* Paket D: Tour und Start-Checkliste empfehlen den KI-Import — die Seite selbst hatte keinen Weg dorthin. */}
        {!vorbelegung && <Link href="/properties/import" className="btn btn-ghost" style={{ fontSize: 12 }}>Aus Exposé importieren</Link>}
      </div>
      {schonUebernommen && (
        <div className="vorbelegt-hinweis">
          Diese Kaufprüfung ist schon als Objekt angelegt. <Link href={`/properties/${schonUebernommen}`}>Zum Objekt</Link>
        </div>
      )}
      {vorbelegung && (
        <div className="vorbelegt-hinweis">
          Vorbelegt aus deiner Kaufprüfung{kalkName ? ` „${kalkName}“` : ""}. Bitte prüfen und das Kaufdatum laut Kaufvertrag
          ergänzen — die Zahlen der Prüfung waren Annahmen vor dem Kauf.
        </div>
      )}
      <PropertyForm
        action={createProperty}
        submitLabel="Anlegen"
        vorbelegung={vorbelegung}
        ausKalkulation={vorbelegung ? aus : undefined}
      />
    </div>
  );
}
