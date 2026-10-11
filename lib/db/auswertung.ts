// Auswertungen laden: vollständig oder gar nicht (B08, Prüfstand 11.10.2026).
//
// BEFUND: Dashboard, Ein- & Ausgaben, Jahresbericht (Seite und PDF), DATEV- und Buchungs-Export sowie
// die Nebenkosten luden Buchungen ohne `.range()` und werteten `error` nicht aus. Ab 1.001 Buchungen
// fehlten die übrigen still (PostgREST-Grenze), und eine gescheiterte Abfrage sah aus wie „keine
// Buchungen“ — Cashflow, Jahresbericht oder Abrechnung erschienen vollständig, waren es aber nicht.
//
// REGEL: Eine Auswertung lädt ihre Grundlagen über `alleZeilen()`. Scheitert eine Seite, wirft sie
// `DatenUnvollstaendig` — die Seite zeigt dann die Fehlerkarte, eine Route antwortet 503. Zahlen aus
// einem Teilbestand werden nie angezeigt. Für Nebensachen (eine Aufgabenliste neben den Kennzahlen)
// gibt `vielleichtAlle()` stattdessen `null` zurück, und die Seite sagt, was fehlt.

import { DatenUnvollstaendig, ladeAlle } from "@/lib/db/ladeAlle";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Abfrage = ReturnType<ReturnType<SupabaseClient["from"]>["select"]>;
type Sortierung = { spalte: string; auf?: boolean };

/** Filter „nur Zeilen dieses Kontos“ — RLS ist die zweite Linie, nicht die einzige. */
export const nurKonto = (userId: string, spalte = "user_id") => (q: Abfrage) => q.eq(spalte, userId);

/**
 * Alle Zeilen einer Tabelle — geblättert, stabil sortiert (zuletzt nach dem Schlüssel), Fehler werfen.
 * `filter` hängt Bedingungen an (z. B. `q => q.eq("user_id", id)`); `schluessel` ist die eindeutige
 * Spalte, nach der zuletzt sortiert wird (Standard `id`).
 */
export function alleZeilen<T = Record<string, unknown>>(
  db: SupabaseClient,
  tabelle: string,
  spalten: string,
  filter: (q: Abfrage) => Abfrage = (q) => q,
  sortierung: Sortierung[] = [],
  schluessel = "id",
): Promise<T[]> {
  return ladeAlle<T>(tabelle, (von, bis) => {
    let q = filter(db.from(tabelle).select(spalten));
    for (const s of sortierung) q = q.order(s.spalte, { ascending: s.auf !== false });
    return q.order(schluessel, { ascending: true }).range(von, bis) as unknown as PromiseLike<{
      data: T[] | null;
      error: { message: string } | null;
    }>;
  });
}

/** Wie `alleZeilen`, aber ein Fehler ergibt `null` statt einer Ausnahme — für Nebensachen. */
export async function vielleichtAlle<T = Record<string, unknown>>(
  ...args: Parameters<typeof alleZeilen<T>>
): Promise<T[] | null> {
  try {
    return await alleZeilen<T>(...args);
  } catch (e) {
    if (e instanceof DatenUnvollstaendig) {
      console.warn(`[auswertung] ${e.message}`);
      return null;
    }
    throw e;
  }
}

/** Antwort einer Route, deren Grundlage nicht vollständig geladen werden konnte. */
export function unvollstaendigAntwort(e: unknown): Response {
  if (!(e instanceof DatenUnvollstaendig)) throw e;
  console.warn(`[auswertung] ${e.message}`);
  return new Response(
    "Die Daten konnten nicht vollständig geladen werden — es wurde nichts erzeugt, damit keine unvollständige Auswertung entsteht. Bitte in einer Minute erneut versuchen.",
    { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "60" } },
  );
}
