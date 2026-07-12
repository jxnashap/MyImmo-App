// Freischaltungs-Gate: prüft, ob ein Konto zugelassen ist (Consent + Zugang).
// Konten ohne Eintrag in konto_freischaltung sind NICHT freigeschaltet und
// werden zum Willkommens-/Consent-Schritt geleitet (schließt Google-Signup-Lücke).
import type { SupabaseClient } from "@supabase/supabase-js";

export async function istFreigeschaltet(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("konto_freischaltung")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  // Fail-closed: bei Fehler NICHT durchlassen (Sicherheit vor Komfort).
  if (error) return false;
  return !!data;
}
