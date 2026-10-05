// EIN Lader für die BuyImmo-Seiten Kommandozentrale (/aufbau) und Fahrplan (/fahrplan) — damit
// beide dieselben Abfragen und dieselbe Lesart haben (z. B. „Selbstauskunft vorhanden“ in der
// Demo). Jede Abfrage filtert ausdrücklich auf das eigene Konto; RLS ist die zweite Linie.
// Nur lesend, nur für die Anzeige.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AufbauKredit, AufbauObjekt } from "@/lib/aufbau";
import { istDemoKonto } from "@/lib/demo";
import { vollmachtStatus } from "@/lib/vertreter";

export type Kaufpruefung = { id: string; name: string; summary: Record<string, number> | null; created_at: string };

export type AufbauDaten = {
  objekte: AufbauObjekt[];
  kredite: AufbauKredit[];
  kaufpruefungen: Kaufpruefung[];
  makler: { item_key: string; status: string | null }[];
  hatSelbstauskunft: boolean;
  vertreterGueltig: boolean;
};

export async function ladeAufbauDaten(
  db: SupabaseClient,
  user: { id: string; email?: string | null } | null,
  heute: string,
): Promise<AufbauDaten> {
  const uid = user?.id ?? "";
  const [{ data: props }, { data: kred }, { data: kalk }, { data: makler }, { data: sa }, { data: vert }] = await Promise.all([
    db.from("properties").select("id,bezeichnung,wert,kaufpreis").eq("user_id", uid),
    db.from("kredite").select("prop_id,betrag,restschuld,monatsrate,zinssatz,grundschuld").eq("user_id", uid),
    db.from("kalkulationen").select("id,name,summary,created_at").eq("user_id", uid).order("created_at", { ascending: false }),
    db.from("makler_dokumente").select("item_key,status").eq("user_id", uid),
    db.from("selbstauskunft").select("user_id").eq("user_id", uid).maybeSingle(),
    db.from("vertreter").select("gueltig_bis,widerrufen_am").eq("user_id", uid),
  ]);

  return {
    objekte: (props ?? []) as AufbauObjekt[],
    kredite: (kred ?? []) as AufbauKredit[],
    kaufpruefungen: (kalk ?? []) as Kaufpruefung[],
    makler: (makler ?? []) as { item_key: string; status: string | null }[],
    // In der Demo steht im Kauf-Assistenten eine Beispiel-Selbstauskunft (lib/kauf/selbstauskunft.ts) —
    // hier dasselbe Bild, sonst widersprächen sich die Seiten.
    hatSelbstauskunft: !!sa || istDemoKonto(user?.email),
    // Dieselbe Auswahl wie im Kauf-Assistenten: gültig oder bald ablaufend.
    vertreterGueltig: ((vert ?? []) as { gueltig_bis: string | null; widerrufen_am: string | null }[]).some((v) => {
      const s = vollmachtStatus(v, heute);
      return s === "gueltig" || s === "laeuft_ab";
    }),
  };
}
