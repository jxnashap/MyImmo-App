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

/**
 * Darf dieses Konto Vermieter-Auswertungen (Exporte, Berichte) abrufen?
 *
 * `getRolle` ist fail-open (kein Eintrag = Vermieter, damit Bestandskonten
 * unverändert bleiben). Für die Exporte ist das tragbar, weil dort zusätzlich
 * jede Abfrage explizit auf `user_id` filtert — die Rollenprüfung ist die
 * zweite Linie, nicht die einzige.
 */
export async function istVermieterKonto(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const rolle = await getRolle(supabase, userId);
  return rolle === "vermieter" || rolle === "hausverwaltung";
}
