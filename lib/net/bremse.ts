import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { blindIndex } from "@/lib/crypto/secure";

// Zugriffsbremse fuer Server-Actions.
//
// Die DB-Funktion `rate_limit_pruefen` liest die Aufrufer-IP normalerweise
// selbst aus den PostgREST-Headern. Bei einer Server-Action geht der Aufruf
// aber aus der Vercel-Function heraus — dort waere die IP die des Servers, und
// alle Besucher landeten in einem gemeinsamen Zaehler. Deshalb wird die echte
// Besucher-IP hier ausgelesen und ausdruecklich mitgegeben.

/** IP des Besuchers aus den Proxy-Headern; erster Eintrag von x-forwarded-for. */
export async function besucherIp(): Promise<string> {
  const h = await headers();
  const kette = h.get("x-forwarded-for") ?? "";
  const erste = kette.split(",")[0]?.trim();
  return erste || h.get("x-real-ip") || "unbekannt";
}

let schonGewarnt = false;

/**
 * Die Kennung, unter der gezaehlt wird — NIE im Klartext.
 *
 * WARUM (08.09.2026, gemessen): Bis dahin wanderte die rohe Besucher-IP als
 * Teil des Schluessels in die Tabelle `zugriff_limit` und blieb dort liegen —
 * 29 Zeilen, alle mit IP im Klartext, die aelteste neun Tage alt, geloescht
 * wurde nie. Ueber `newsletter_adresse` waere zusaetzlich die E-Mail-Adresse
 * im Klartext gelandet. Fuer eine Bremse braucht es aber nur einen STABILEN
 * Schluessel, keinen lesbaren.
 *
 * HMAC, nicht einfaches Hashen: Ein SHA-256 ueber eine IPv4-Adresse ist in
 * Sekunden rueckrechenbar — es gibt nur rund vier Milliarden davon. Erst der
 * geheime Schluessel macht daraus etwas, das ein Datenbank-Leck nicht
 * preisgibt.
 *
 * Fehlt `DATA_ENCRYPTION_KEY`, wird auf SHA-256 zurueckgefallen: schwaecher
 * (siehe oben), aber immer noch besser als Klartext — und vor allem darf die
 * Bremse daran nicht scheitern. In der Produktion ist der Schluessel gesetzt.
 */
function kennzeichen(wert: string): string {
  try {
    return blindIndex(wert);
  } catch {
    if (!schonGewarnt) {
      schonGewarnt = true;
      console.warn(
        "Zugriffsbremse: DATA_ENCRYPTION_KEY fehlt — Kennungen werden nur gehasht, nicht mit HMAC geschuetzt.",
      );
    }
    return createHash("sha256").update(wert, "utf8").digest("hex");
  }
}

/**
 * Zaehlt einen Versuch und meldet, ob weitergemacht werden darf.
 *
 * Bewusst `false` statt einer Exception: die Aufrufer sind Formular-Actions,
 * die dem Nutzer eine Meldung zeigen sollen — kein Absturz.
 *
 * Faellt die Bremse selbst aus (DB nicht erreichbar, Env fehlt), wird
 * DURCHGELASSEN. Eine kaputte Bremse darf die Registrierung nicht blockieren;
 * sie ist eine zusaetzliche Huerde, nicht die Zugangskontrolle.
 */
export async function darfWeiter(
  aktion: string,
  max: number,
  sekunden: number,
  kennung?: string,
): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    // Ohne Service-Role-Key gibt es keine Bremse — dann lieber durchlassen als
    // die Registrierung lahmlegen (siehe oben).
    if (!supabase) return true;
    const { error } = await supabase.rpc("rate_limit_pruefen", {
      p_aktion: aktion,
      p_max: max,
      p_sekunden: sekunden,
      // Immer eine Kennung mitgeben — auch dann, wenn der Aufrufer keine
      // gesetzt hat. Sonst griffe der Rueckfall `anfrage_ip()` INNERHALB der
      // Datenbank, und der schreibt die IP wieder im Klartext.
      p_kennung: kennzeichen(kennung ?? (await besucherIp())),
    });
    // Die Funktion wirft beim Ueberschreiten — PostgREST macht daraus einen Fehler.
    return !error;
  } catch {
    return true;
  }
}

export const ZU_VIELE =
  "Zu viele Versuche. Bitte in einigen Minuten erneut versuchen.";
