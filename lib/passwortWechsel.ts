import type { SupabaseClient } from "@supabase/supabase-js";
import { pruefePasswort } from "@/lib/passwort";

// Passwortwechsel mit Bestätigung des AKTUELLEN Passworts.
//
// Vorher rief die App direkt `updateUser({ password })` auf. Wer eine fremde,
// offene Sitzung erwischt — geliehenes Notebook, nicht abgemeldetes Handy,
// gestohlenes Session-Cookie — konnte damit in zwei Klicks das Passwort setzen
// und den rechtmäßigen Inhaber aussperren.
//
// ZWEI PRÜFUNGEN, ABSICHTLICH BEIDE (09.09.2026)
//   1. `signInWithPassword` mit dem alten Passwort. Das wirkt SOFORT, ohne
//      Dashboard-Schalter — und erzeugt nebenbei eine sekundenfrische Sitzung,
//      was Supabases „Secure password change" (24-Stunden-Regel) erfüllt.
//   2. `current_password` im `updateUser`-Aufruf. Das ist die einzige Prüfung,
//      die SERVERSEITIG greift — sie wirkt, sobald der Betreiber „Require
//      current password when updating" einschaltet, und schützt dann auch
//      gegen einen direkten API-Aufruf am Formular vorbei.
// Nur (1) wäre umgehbar (der Angreifer ruft die API direkt), nur (2) wäre bis
// zum Umlegen des Schalters wirkungslos. Deshalb beides.
//
// GOOGLE-KONTEN GEHÖREN NICHT HIERHER. Ein Konto ohne Passwort kann keines
// bestätigen. Für sie gibt es `sendePasswortMail()` weiter unten: Der Weg über
// die E-Mail erzeugt eine frische Sitzung und führt auf `/auth/passwort-neu`,
// wo ein Passwort ohne Bestätigung des alten gesetzt werden darf. Früher stand
// dafür ein `istGoogle`-Zweig hier drin, der die Bestätigung einfach übersprang
// — das hätte mit eingeschaltetem Schalter still versagt.

/** Ziel des „Passwort vergessen"-Links. Eine Stelle, damit Login und
 *  Einstellungen nicht auseinanderlaufen können. */
export const RESET_ZIEL = "/auth/passwort";

export type WechselErgebnis = { ok: true } | { ok: false; fehler: string };

export async function wechslePasswort(
  supabase: SupabaseClient,
  opts: { email: string; aktuell: string; neu: string; wiederholung: string },
): Promise<WechselErgebnis> {
  const regelFehler = pruefePasswort(opts.neu);
  if (regelFehler) return { ok: false, fehler: regelFehler };
  if (opts.neu !== opts.wiederholung) {
    return { ok: false, fehler: "Die beiden Passwörter stimmen nicht überein." };
  }
  if (opts.aktuell && opts.aktuell === opts.neu) {
    return { ok: false, fehler: "Das neue Passwort ist mit dem alten identisch." };
  }
  if (!opts.aktuell) {
    return { ok: false, fehler: "Bitte zur Bestätigung das aktuelle Passwort eingeben." };
  }

  // (1) Bestätigung über einen echten Anmeldeversuch.
  const { error: anmeldeFehler } = await supabase.auth.signInWithPassword({
    email: opts.email,
    password: opts.aktuell,
  });
  if (anmeldeFehler) {
    return {
      ok: false,
      fehler:
        "Das aktuelle Passwort stimmt nicht. Wenn du dich mit Google anmeldest, " +
        "hast du kein Passwort — nutze in dem Fall „Passwort vergessen“ auf der Anmeldeseite.",
    };
  }

  // (2) Serverseitige Bestätigung — greift, sobald der Schalter an ist.
  const { error } = await supabase.auth.updateUser({
    email: opts.email,
    current_password: opts.aktuell,
    password: opts.neu,
  });
  if (error) {
    return {
      ok: false,
      fehler: /pwned|leaked|compromis/i.test(error.message)
        ? "Dieses Passwort steht in einem bekannten Datenleck. Bitte wähle ein anderes."
        : "Passwort konnte nicht geändert werden. Bitte erneut versuchen.",
    };
  }
  return { ok: true };
}

/**
 * Passwort per E-Mail einrichten oder zurücksetzen.
 *
 * Der Weg für Google-Konten, die sich zusätzlich ein Passwort geben wollen —
 * und derselbe Weg wie „Passwort vergessen". Beides endet auf
 * `/auth/passwort-neu`.
 */
export async function sendePasswortMail(
  supabase: SupabaseClient,
  email: string,
): Promise<WechselErgebnis> {
  if (!email) return { ok: false, fehler: "Keine E-Mail-Adresse am Konto hinterlegt." };
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: typeof window !== "undefined" ? `${window.location.origin}${RESET_ZIEL}` : undefined,
  });
  return error
    ? { ok: false, fehler: "Die E-Mail konnte nicht verschickt werden. Bitte später erneut versuchen." }
    : { ok: true };
}
