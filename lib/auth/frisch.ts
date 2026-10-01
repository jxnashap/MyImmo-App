import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FRISCH_SEKUNDEN, aalStandAus, mussMfaNachholen, sitzungFrisch } from "@/lib/auth/sitzung";

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
  // Faktorstatus vom SERVER (`getUser`), nicht aus dem Cookie — siehe `aalStandAus`.
  // Fail-closed: Antwortet der Auth-Server nicht, gilt die Anmeldung als nicht frisch.
  const [{ data: { user }, error }, { data: { session } }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);
  if (error || !user) return { ok: false, grund: "reauth" };
  if (mussMfaNachholen(aalStandAus(user.factors, session?.access_token))) return { ok: false, grund: "mfa" };
  if (!sitzungFrisch(session?.access_token, maxSekunden)) return { ok: false, grund: "reauth" };
  return { ok: true };
}

/** Einheitlicher Meldungstext für die Oberfläche. */
export const REAUTH_MELDUNG =
  "Bitte bestätige zuerst deine Anmeldung — diese Aktion verlangt eine frische Anmeldung.";
