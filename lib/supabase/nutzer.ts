import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Der angemeldete Nutzer — EINMAL je Anfrage geprüft (Phase 5, zweiter Hebel).
//
// Layout und Seite riefen `supabase.auth.getUser()` jeweils selbst auf. Das
// ist ein Netzaufruf zu Supabase Auth, und weil die Seite erst rendert, wenn
// das Layout fertig ist, liefen beide hintereinander. `cache()` aus React gilt
// je SERVER-ANFRAGE: Innerhalb einer Anfrage liefert der zweite Aufruf das
// Ergebnis des ersten, zwischen zwei Anfragen (zwei Nutzern) wird nichts
// geteilt.
//
// `getUser()` bleibt die Prüfung — es fragt Supabase und verlässt sich nicht
// auf das Cookie allein (anders als `getSession()`).
//
// Nicht für Server-Actions und Route-Handler gedacht: Dort greift `cache()`
// nicht, der Aufruf funktioniert, spart aber nichts.
export const aktuellerNutzer = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
