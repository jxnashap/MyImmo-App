// Wohin nach Anmeldung, Abmeldung und Bestätigungslink (21.10.2026).
//
// WARUM ES DAS GIBT: Die Anmeldeseite stand nach jedem Abmelden auf „Vermieter“.
// Ein Mieter, der sich danach mit dem RICHTIGEN Passwort anmeldete, wurde wieder
// abgemeldet und las rot „… die Anmeldung hier ist für Vermieter gedacht“. Die
// Rolle steht aber in der Datenbank, und das Layout schickt jedes Konto ohnehin
// in seinen Bereich (`app/(app)/layout.tsx`). Die Rollenwahl auf der Seite
// entscheidet seitdem nur noch über die REGISTRIERUNG, nie über die Anmeldung.

/** Die Rollen, die eine eigene Startseite haben. Alles andere ist die volle App. */
const HEIM: Record<string, string> = { mieter: "/portal", service: "/service" };

/** Startseite eines Kontos nach seiner Rolle aus der Datenbank. */
export function heimVon(kontoRolle: string | null | undefined): string {
  return (kontoRolle && HEIM[kontoRolle]) || "/";
}

/**
 * Ziel nach erfolgreicher Anmeldung: Ein Deep-Link (schon geprüft, nur interne
 * Pfade) gewinnt, sonst die Startseite des Kontos. Führt der Deep-Link in einen
 * fremden Bereich, schickt das Layout weiter — hier wird nichts abgewiesen.
 */
export function zielNachAnmeldung(kontoRolle: string | null | undefined, next: string | null): string {
  return next || heimVon(kontoRolle);
}

/**
 * Anmeldeseite nach dem Abmelden — mit der Rolle, damit Mieter und Service-Partner
 * beim nächsten Mal „ihre“ Seite sehen. Nur die bekannten Werte; alles andere fällt
 * auf die schlichte Anmeldeseite.
 */
export function abmeldeZiel(rolle: unknown): string {
  return typeof rolle === "string" && rolle in HEIM ? `/login?rolle=${rolle}` : "/login";
}

/**
 * Ziel des Bestätigungslinks aus der Registrierungsmail. Ohne eigenes Ziel nahm
 * Supabase die Site URL — dort fing der Proxy den `code` als „Passwort vergessen“
 * ab und zeigte „Neues Passwort setzen“ bzw. „Link nur im selben Browser“.
 * `/auth/callback` ist vom Abfang ausgenommen und steht in der Weißliste.
 */
export function bestaetigungsZiel(origin: string, rolle: string): string {
  const p = new URLSearchParams({ bestaetigt: "1", next: heimVon(rolle) });
  if (rolle in HEIM) p.set("rolle", rolle);
  return `${origin}/auth/callback?${p.toString()}`;
}
