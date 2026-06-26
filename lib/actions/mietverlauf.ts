"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validierePerioden, type Periode } from "@/lib/wiederkehr";

// Speichert die Mietverlauf-Zeiträume eines Mieters (Replace-all). Validiert
// Lückenlosigkeit/Überschneidungsfreiheit. Bereits gebuchte Vergangenheit
// bleibt unverändert (nur künftige/ungebuchte Termine nutzen die neuen Beträge).
export async function saveMietverlauf(
  mieterId: string,
  perioden: Periode[],
): Promise<{ ok: boolean; error?: string }> {
  const check = validierePerioden(perioden);
  if (!check.ok) return { ok: false, error: check.error };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const { error: delErr } = await supabase.from("mietverlauf").delete().eq("mieter_id", mieterId);
  if (delErr) return { ok: false, error: "Speichern fehlgeschlagen." };

  if (perioden.length) {
    const rows = perioden.map((p) => ({
      user_id: user.id,
      mieter_id: mieterId,
      von: p.von,
      bis: p.bis,
      betrag: p.betrag,
    }));
    const { error } = await supabase.from("mietverlauf").insert(rows);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/einnahmen");
  revalidatePath("/");
  return { ok: true };
}
