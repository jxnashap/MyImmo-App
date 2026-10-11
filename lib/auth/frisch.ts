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
  // B01 (11.10.2026): Der Auth-Server prüft GENAU das Token, dessen `aal`/`amr` danach gelesen
  // werden (`getUser(token)`). Vorher liefen `getUser()` und `getSession()` parallel — erneuerte
  // eine der beiden die Sitzung, konnte das ausgewertete Token ein anderes sein als das geprüfte.
  // Fail-closed: Ohne Token oder ohne Antwort des Auth-Servers gilt die Anmeldung als nicht frisch.
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return { ok: false, grund: "reauth" };
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { ok: false, grund: "reauth" };
  if (mussMfaNachholen(aalStandAus(user.factors, token))) return { ok: false, grund: "mfa" };
  if (!sitzungFrisch(token, maxSekunden)) return { ok: false, grund: "reauth" };
  return { ok: true };
}

/** Einheitlicher Meldungstext für die Oberfläche. */
export const REAUTH_MELDUNG =
  "Bitte bestätige zuerst deine Anmeldung — diese Aktion verlangt eine frische Anmeldung.";
