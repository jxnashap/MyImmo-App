"use server";

// Belege fürs Mieterportal freigeben/zurückziehen (§ 556 Abs. 4 BGB).
// Archiv-DOKUMENTE gehen seit 02.10.2026 über lib/actions/zustellung.ts an eine Person.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: "Freigabe konnte nicht geändert werden." };
  revalidatePath("/cashflow");
  revalidatePath("/portal");
  return { ok: true };
}
