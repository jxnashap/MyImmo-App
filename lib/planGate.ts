import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  billingAktiv,
  darfFeature,
  effektiverPlan,
  einheitenLimit,
  getAbo,
  zaehleEinheiten,
  PLAN_NAMEN,
  FEATURE_AB_PLAN,
  type Feature,
} from "@/lib/plan";

// Serverseitige Tarif-Schranken für Server-Actions und Route-Handler.
//
// WARUM DIESE DATEI EXISTIERT
// `lib/plan.ts` hatte die komplette Tarif-Matrix — aber `darfFeature()` und
// `einheitenLimit()` wurden am 04.09.2026 an NULL Stellen der App aufgerufen.
// Die Logik war gebaut, getestet und nirgends angeschlossen; `BILLING_ENFORCED=true`
// wäre wirkungslos geblieben (kassieren, ohne zu beschränken).
//
// DIE ENTSCHEIDENDE EIGENSCHAFT: Solange `BILLING_ENFORCED` nicht "true" ist,
// kehren beide Funktionen SOFORT zurück — ohne Datenbankabfrage, ohne Prüfung.
// Im Early Access kosten die Schranken damit nicht eine einzige Anfrage und
// können das Verhalten nicht verändern. Das ist kein Nebeneffekt, sondern der
// Grund, warum sie sich heute gefahrlos überall einbauen lassen.
//
// Bewusst NICHT hier: die Client-Seite. Ein ausgegrauter Knopf ist Komfort,
// keine Schranke — die Durchsetzung gehört auf den Server, wo sie niemand
// umgehen kann. Die Oberfläche darf später folgen.

/** Ist das Feature für den angemeldeten Nutzer freigeschaltet? */
export async function darfFeatureJetzt(
  supabase: SupabaseClient,
  feature: Feature,
): Promise<boolean> {
  if (!billingAktiv()) return true; // Early Access: keine Abfrage, alles frei
  return darfFeature(await getAbo(supabase), feature);
}

/** Tarifname, der das Feature enthält — für die Meldung an den Nutzer. */
export function benoetigterTarif(feature: Feature): string {
  return PLAN_NAMEN[FEATURE_AB_PLAN[feature]];
}

/**
 * Meldung, wenn ein Feature gesperrt ist — oder `null`, wenn es frei ist.
 * Für Actions, die `{ error }` zurückgeben.
 */
export async function featureSperre(
  supabase: SupabaseClient,
  feature: Feature,
): Promise<string | null> {
  if (await darfFeatureJetzt(supabase, feature)) return null;
  return `Diese Funktion ist ab Tarif „${benoetigterTarif(feature)}" verfügbar. Deinen Tarif findest du unter Einstellungen → Abo.`;
}

export type EinheitenPruefung = {
  erlaubt: boolean;
  belegt: number;
  limit: number;
  meldung: string | null;
};

/**
 * Darf ein weiteres Objekt mit `zusatz` Einheiten angelegt werden?
 *
 * Gezählt wird die Summe über ALLE Objekte (mindestens 1 je Objekt) — so ist
 * das Limit in `lib/plan.ts` definiert und so steht es auf der Preisseite
 * („bis 5 Einheiten"), nicht „bis 5 Objekte".
 */
export async function pruefeEinheiten(
  supabase: SupabaseClient,
  zusatz: number = 1,
): Promise<EinheitenPruefung> {
  if (!billingAktiv()) {
    return { erlaubt: true, belegt: 0, limit: Number.POSITIVE_INFINITY, meldung: null };
  }
  const abo = await getAbo(supabase);
  const limit = einheitenLimit(abo);
  const belegt = await zaehleEinheiten(supabase);
  const erlaubt = belegt + Math.max(1, zusatz) <= limit;
  return {
    erlaubt,
    belegt,
    limit,
    meldung: erlaubt
      ? null
      : `Dein Tarif „${PLAN_NAMEN[effektiverPlan(abo)]}" umfasst ${limit} Einheit${limit === 1 ? "" : "en"}; belegt sind ${belegt}. Unter Einstellungen → Abo kannst du wechseln.`,
  };
}
