import { timingSafeEqual } from "node:crypto";
import { blindIndex } from "@/lib/crypto/secure";

// Nachweis, dass jemand WIRKLICH über einen Passwort-vergessen-Link kam.
//
// WARUM DAS NÖTIG IST
// Die Seite `/auth/passwort-neu` setzt ein neues Passwort, OHNE das alte zu
// verlangen — das ist ihr Zweck. Damit ist sie aber genau die Lücke, die
// `lib/passwortWechsel.ts` bewusst geschlossen hat: Wer eine fremde offene
// Sitzung vorfindet (geliehenes Notebook, nicht abgemeldetes Handy), könnte
// sie aufrufen und den Inhaber aussperren.
//
// Deshalb reicht „ist angemeldet" hier NICHT. Es braucht den Beleg, dass
// unmittelbar zuvor ein Reset-Token eingelöst wurde. Den stellt die Route
// `/auth/passwort` aus, nachdem Supabase den Token bestätigt hat.
//
// WARUM EIN EIGENER NACHWEIS UND NICHT `amr` AUS DEM JWT
// Supabase schreibt die Anmeldemethode in `amr` — naheliegend wäre, dort auf
// „recovery" zu prüfen. Welchen Bezeichner Supabase dafür genau setzt, ist
// aber nicht dokumentiert und hier nicht überprüfbar (dazu bräuchte es eine
// echte Reset-Mail). Auf eine unbelegte Annahme lässt sich keine Schranke
// bauen: Rät man falsch, ist die Seite entweder für alle gesperrt oder für
// alle offen. Der eigene Nachweis ist dagegen vollständig prüfbar.
//
// Der Wert ist an den Nutzer gebunden und läuft ab. Er ist KEIN Ersatz für die
// Sitzung — beides muss stimmen.

/** Fünf Minuten. Lang genug zum Tippen, kurz genug gegen den offenen Rechner. */
export const NACHWEIS_SEKUNDEN = 5 * 60;

export const NACHWEIS_COOKIE = "mi_pwreset";

const signatur = (userId: string, exp: number): string =>
  blindIndex(`passwort-reset:${userId}:${exp}`);

/** Nachweis ausstellen — nur nach erfolgreicher Token-Prüfung durch Supabase. */
export function stelleNachweisAus(
  userId: string,
  jetztSekunden: number = Math.floor(Date.now() / 1000),
): string {
  const exp = jetztSekunden + NACHWEIS_SEKUNDEN;
  return `${exp}.${signatur(userId, exp)}`;
}

/**
 * Nachweis prüfen. Fail-closed: Alles, was nicht eindeutig gültig ist, gilt als
 * ungültig — fehlender Wert, kaputtes Format, abgelaufen, falsche Signatur,
 * anderer Nutzer.
 */
export function nachweisGueltig(
  wert: string | null | undefined,
  userId: string | null | undefined,
  jetztSekunden: number = Math.floor(Date.now() / 1000),
): boolean {
  if (!wert || !userId) return false;
  const punkt = wert.indexOf(".");
  if (punkt <= 0) return false;

  const exp = Number(wert.slice(0, punkt));
  if (!Number.isSafeInteger(exp) || exp <= jetztSekunden) return false;

  const gegeben = wert.slice(punkt + 1);
  let erwartet: string;
  try {
    erwartet = signatur(userId, exp);
  } catch {
    // Ohne DATA_ENCRYPTION_KEY lässt sich nicht signieren. Dann gilt kein
    // Nachweis — die Seite verweigert, statt ungeprüft zu öffnen.
    return false;
  }

  // Zeitkonstanter Vergleich: Ein `===` über Hex verrät über die Laufzeit,
  // wie viele Zeichen stimmen, und macht das Raten Zeichen für Zeichen möglich.
  const a = Buffer.from(gegeben, "utf8");
  const b = Buffer.from(erwartet, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
