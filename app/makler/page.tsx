// Makler-Ordner (buyer-level): Käufer-Checkliste + Upload/Abhaken/Fortschritt.
// Nicht objektabhängig — pro Nutzer. Gegenstück zum Bank-/Beleihungsordner.
import { createClient } from "@/lib/supabase/server";
import MaklerOrdner from "@/components/MaklerOrdner";
import type { MaklerDok } from "@/lib/makler";

export const dynamic = "force-dynamic";

export default async function MaklerPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Existenz der Selbstauskunft prüfen (für den „Aus MyImmo erzeugen"-Button) —
  // ohne den verschlüsselten Blob zu entschlüsseln.
  const [{ data: docs }, { data: sa }] = await Promise.all([
    supabase.from("makler_dokumente").select("item_key,status,notiz,datum,datei_name,datei_type,datei_size"),
    user
      ? supabase.from("selbstauskunft").select("user_id").eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "8px 0 40px" }}>
      <MaklerOrdner initialDocs={(docs ?? []) as MaklerDok[]} hatSelbstauskunft={!!sa} />
    </div>
  );
}
