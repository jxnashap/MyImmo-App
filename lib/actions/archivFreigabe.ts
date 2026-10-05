"use server";

// Belege fürs Mieterportal freigeben/zurückziehen (§ 556 Abs. 4 BGB).
// Archiv-DOKUMENTE gehen seit 02.10.2026 über lib/actions/zustellung.ts an eine Person.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { belegReichweite } from "@/lib/mieterZugang";
import { heuteBerlin } from "@/lib/zeitraum";

/** Beleg einer Kostenbuchung im Mieterportal freigeben/zurückziehen
 *  (§ 556 Abs. 4 BGB Belegeinsicht). */
export async function setzeBelegFreigabe(kostenId: string, freigabe: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { data, error } = await supabase
    .from("kosten")
    .update({ mieter_freigabe: freigabe })
    .eq("id", kostenId)
    .eq("user_id", user.id)
    .select("id,prop_id,buchungsdatum")
    .maybeSingle();
  if (error || !data) return { error: "Freigabe konnte nicht geändert werden." };
  revalidatePath("/cashflow");
  revalidatePath("/portal");
  if (!freigabe) return { ok: true, sichtbarFuer: 0 };

  // S7: Wem wird der Beleg jetzt angezeigt? Die Freigabe gilt bereits — scheitert die
  // Zählung, sagen wir das, statt eine Zahl zu erfinden.
  const beleg = data as { prop_id: string | null; buchungsdatum: string | null };
  if (!beleg.prop_id) return { ok: true, sichtbarFuer: 0 };
  const [m, z] = await Promise.all([
    supabase.from("mieter").select("id,prop_id,mietbeginn,mietende").eq("user_id", user.id).eq("prop_id", beleg.prop_id),
    supabase.from("mieter_zugaenge").select("mieter_id,user_id").eq("vermieter_id", user.id).eq("prop_id", beleg.prop_id),
  ]);
  if (m.error || z.error) return { ok: true, sichtbarFuer: null };
  return { ok: true, sichtbarFuer: belegReichweite(beleg, m.data ?? [], z.data ?? [], heuteBerlin()) };
}
