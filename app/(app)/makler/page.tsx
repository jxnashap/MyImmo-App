// Makler-Ordner (buyer-level): Käufer-Checkliste + Upload/Abhaken/Fortschritt.
// Nicht objektabhängig — pro Nutzer. Gegenstück zum Bank-/Beleihungsordner.
import { createClient } from "@/lib/supabase/server";
import { aktuellerNutzer } from "@/lib/supabase/nutzer";
import MaklerOrdner from "@/components/MaklerOrdner";
import type { MaklerDok } from "@/lib/makler";
import type { MaklerFreigabe } from "@/lib/actions/makler";
import { ABRUF_SPALTEN, type Abruf } from "@/lib/freigabeAbrufe";

export const dynamic = "force-dynamic";

export default async function MaklerPage() {
  const supabase = await createClient();
  const user = await aktuellerNutzer();

  // Existenz der Selbstauskunft prüfen (für den „Aus MyImmo erzeugen"-Button) —
  // ohne den verschlüsselten Blob zu entschlüsseln.
  const [{ data: docs }, { data: sa }, { data: freigaben }, { data: abrufe }] = await Promise.all([
    supabase.from("makler_dokumente").select("item_key,status,notiz,datum,datei_name,datei_type,datei_size"),
    user
      ? supabase.from("selbstauskunft").select("user_id").eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    // Makler-Links + Abruf-Protokoll (05.10.2026). RLS: nur eigene; der Filter steht trotzdem da.
    user
      ? supabase.from("makler_freigaben").select("token,item_keys,ablauf,aktiv,created_at,empfaenger_email")
          .eq("user_id", user.id).order("created_at", { ascending: false }).limit(10)
      : Promise.resolve({ data: [] }),
    user
      ? supabase.from("freigabe_abrufe").select(ABRUF_SPALTEN)
          .eq("user_id", user.id).eq("art", "makler").order("abgerufen_am", { ascending: false }).limit(200)
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "8px 0 40px" }}>
      <MaklerOrdner
        initialDocs={(docs ?? []) as MaklerDok[]}
        hatSelbstauskunft={!!sa}
        freigaben={(freigaben ?? []) as MaklerFreigabe[]}
        abrufe={(abrufe ?? []) as Abruf[]}
        jetzt={new Date().toISOString()}
      />
    </div>
  );
}
