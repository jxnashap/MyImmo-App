// Schreibt einen Plan aus `planeMietaenderung()` (lib/sollAb.ts) in `miet_zeitraeume`.
// Serverseitig, mit dem Client des Aufrufers (RLS gilt). Keine "use server"-Datei.
//
// Reihenfolge ist Absicht — bricht ein Schritt ab, ist das Soll in jedem Zwischenstand
// richtig: (1) Lücken mit den ALTEN Werten (ändern nichts am Ergebnis), (2) alte Zeiträume
// beenden (davor fiel der Monat auf dieselben alten Felder zurück), (3) neuer Zeitraum.
// Erst danach ändert der Aufrufer die Felder am Mieter.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MietaenderungsPlan } from "@/lib/sollAb";

type Db = Pick<SupabaseClient, "from">;

export async function schreibeMietaenderung(
  db: Db,
  args: { userId: string; mieterId: string; propId: string | null; plan: MietaenderungsPlan },
): Promise<{ ok: true } | { error: string }> {
  const { userId, mieterId, propId, plan } = args;
  const zeile = <T extends object>(z: T) => ({ ...z, user_id: userId, mieter_id: mieterId, prop_id: propId });

  if (plan.luecken.length > 0) {
    const { error } = await db.from("miet_zeitraeume").insert(plan.luecken.map(zeile));
    if (error) return { error: "Die bisherige Miete konnte nicht festgehalten werden — nichts geändert." };
  }
  for (const b of plan.beenden) {
    const { error } = await db.from("miet_zeitraeume").update({ bis: b.bis }).eq("id", b.id).eq("user_id", userId);
    if (error) return { error: "Ein Miet-Zeitraum konnte nicht beendet werden — bitte erneut speichern." };
  }
  if (plan.ersetzen) {
    const { error } = await db.from("miet_zeitraeume").update(plan.ersetzen.betraege).eq("id", plan.ersetzen.id).eq("user_id", userId);
    if (error) return { error: "Der neue Miet-Zeitraum konnte nicht gespeichert werden." };
  } else if (plan.neu) {
    const { error } = await db.from("miet_zeitraeume").insert(zeile(plan.neu));
    if (error) return { error: "Der neue Miet-Zeitraum konnte nicht gespeichert werden." };
  }
  return { ok: true };
}
