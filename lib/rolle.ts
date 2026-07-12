// Nutzer-Rollen (Businessplan Kap. 14). Konten ohne Eintrag in
// nutzer_rollen sind Vermieter — so bleiben alle Bestandskonten unverändert.
import type { SupabaseClient } from "@supabase/supabase-js";

export type Rolle = "vermieter" | "mieter" | "service" | "hausverwaltung";

export async function getRolle(supabase: SupabaseClient, userId: string): Promise<Rolle> {
  const { data } = await supabase
    .from("nutzer_rollen")
    .select("rolle")
    .eq("user_id", userId)
    .maybeSingle();
  return ((data?.rolle as Rolle | undefined) ?? "vermieter");
}
