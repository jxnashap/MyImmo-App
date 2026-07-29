import type { SupabaseClient } from "@supabase/supabase-js";
import { pruefePasswort } from "@/lib/passwort";

// Passwortwechsel mit Bestätigung des AKTUELLEN Passworts.
//
// Vorher rief die App direkt `updateUser({ password })` auf. Wer eine fremde,
// offene Sitzung erwischt — geliehenes Notebook, nicht abgemeldetes Handy,
// gestohlenes Session-Cookie — konnte damit in zwei Klicks das Passwort setzen
// und den rechtmäßigen Inhaber aussperren. Genau davor schützt Supabases
// Schalter „Require current password when updating"; der ließ sich aber nicht
// aktivieren, weil die App das aktuelle Passwort gar nicht mitgeschickt hat.
//
// Beide Passwortformulare (Vermieter-Einstellungen und Mieter-/Service-Konto)
// nutzen jetzt diese eine Funktion.

export type WechselErgebnis = { ok: true } | { ok: false; fehler: string };

/**
 * @param istGoogle true = Konto meldet sich über Google an und hat (noch) kein
 *   Passwort. Dann gibt es nichts zu bestätigen — es wird eines gesetzt.
 */
export async function wechslePasswort(
  supabase: SupabaseClient,
  opts: {
    email: string;
    aktuell: string;
    neu: string;
    wiederholung: string;
    istGoogle?: boolean;
  },
): Promise<WechselErgebnis> {
  const regelFehler = pruefePasswort(opts.neu);
  if (regelFehler) return { ok: false, fehler: regelFehler };
  if (opts.neu !== opts.wiederholung) {
    return { ok: false, fehler: "Die beiden Passwörter stimmen nicht überein." };
  }
  if (opts.aktuell && opts.aktuell === opts.neu) {
    return { ok: false, fehler: "Das neue Passwort ist mit dem alten identisch." };
  }

  if (!opts.istGoogle) {
    if (!opts.aktuell) {
      return { ok: false, fehler: "Bitte zur Bestätigung das aktuelle Passwort eingeben." };
    }
    // Bestätigung über einen echten Anmeldeversuch: Nur wer das aktuelle
    // Passwort kennt, kommt hier vorbei. Erfolgreich heißt zugleich, dass die
    // Sitzung frisch ist — genau das, was Supabase für „Secure password
    // change" verlangt.
    const { error } = await supabase.auth.signInWithPassword({
      email: opts.email,
      password: opts.aktuell,
    });
    if (error) {
      return {
        ok: false,
        fehler:
          "Das aktuelle Passwort stimmt nicht. Wenn du dich mit Google anmeldest, " +
          "hast du kein Passwort — nutze in dem Fall „Passwort vergessen“ auf der Anmeldeseite.",
      };
    }
  }

  const { error } = await supabase.auth.updateUser({ password: opts.neu });
  if (error) {
    return { ok: false, fehler: "Passwort konnte nicht geändert werden. Bitte erneut versuchen." };
  }
  return { ok: true };
}
