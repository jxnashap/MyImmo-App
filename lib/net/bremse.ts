import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

// Zugriffsbremse fuer Server-Actions.
//
// Die DB-Funktion `rate_limit_pruefen` liest die Aufrufer-IP normalerweise
// selbst aus den PostgREST-Headern. Bei einer Server-Action geht der Aufruf
// aber aus der Vercel-Function heraus — dort waere die IP die des Servers, und
// alle Besucher landeten in einem gemeinsamen Zaehler. Deshalb wird die echte
// Besucher-IP hier ausgelesen und ausdruecklich mitgegeben.

/** IP des Besuchers aus den Proxy-Headern; erster Eintrag von x-forwarded-for. */
export function besucherIp(): string {
  const h = headers();
  const kette = h.get("x-forwarded-for") ?? "";
  const erste = kette.split(",")[0]?.trim();
  return erste || h.get("x-real-ip") || "unbekannt";
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
      p_kennung: kennung ?? besucherIp(),
    });
    // Die Funktion wirft beim Ueberschreiten — PostgREST macht daraus einen Fehler.
    return !error;
  } catch {
    return true;
  }
}

export const ZU_VIELE =
  "Zu viele Versuche. Bitte in einigen Minuten erneut versuchen.";
