// Makler-Ordner (buyer-level): Käufer-Checkliste + Upload/Abhaken/Fortschritt.
// Nicht objektabhängig — pro Nutzer. Gegenstück zum Bank-/Beleihungsordner.
import { createClient } from "@/lib/supabase/server";
import MaklerOrdner from "@/components/MaklerOrdner";
import type { MaklerDok } from "@/lib/makler";

export const dynamic = "force-dynamic";

export default async function MaklerPage() {
  const supabase = createClient();
  const { data: docs } = await supabase
    .from("makler_dokumente")
    .select("item_key,status,notiz,datum,datei_name,datei_type,datei_size");

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "8px 0 40px" }}>
      <MaklerOrdner initialDocs={(docs ?? []) as MaklerDok[]} />
    </div>
  );
}
