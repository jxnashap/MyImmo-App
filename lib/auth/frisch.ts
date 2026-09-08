import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FRISCH_SEKUNDEN, mussMfaNachholen, sitzungFrisch } from "@/lib/auth/sitzung";

// Serverseitige Prüfung vor sensiblen Aktionen (Vollexport, Kontolöschung,
// Bank-Freigabe): Ist die Anmeldung frisch, und — falls das Konto einen
// zweiten Faktor hat — wurde er in dieser Sitzung bestätigt?
//
// Rückgabe statt Ausnahme, damit Actions und Routen es je nach Kanal
// beantworten können (JSON 403, Rückgabewert mit `reauth: true`).

export type FrischErgebnis = { ok: true } | { ok: false; grund: "reauth" | "mfa" };

export async function pruefeFrischeAnmeldung(
  supabase: SupabaseClient,
  maxSekunden: number = FRISCH_SEKUNDEN,
): Promise<FrischErgebnis> {
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (mussMfaNachholen(aal)) return { ok: false, grund: "mfa" };

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!sitzungFrisch(session?.access_token, maxSekunden)) return { ok: false, grund: "reauth" };
  return { ok: true };
}

/** Einheitlicher Meldungstext für die Oberfläche. */
export const REAUTH_MELDUNG =
  "Bitte bestätige zuerst deine Anmeldung — diese Aktion verlangt eine frische Anmeldung.";
