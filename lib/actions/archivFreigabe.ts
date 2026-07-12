"use server";

// Etappe 3: Archiv-Dokumente gezielt fürs Mieterportal freigeben/zurückziehen.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setzeMieterFreigabe(notizId: string, freigabe: boolean) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  const { data, error } = await supabase
    .from("notizen")
    .update({ mieter_freigabe: freigabe })
    .eq("id", notizId)
    .eq("user_id", user.id)
    .select("mieter_id")
    .maybeSingle();
  if (error || !data) return { error: "Freigabe konnte nicht geändert werden." };

  if (data.mieter_id) revalidatePath(`/tenants/${data.mieter_id}`);
  revalidatePath("/portal");
  revalidatePath("/archiv");
  return { ok: true };
}
