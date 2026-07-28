import "server-only";
import { createClient } from "@/lib/supabase/server";
import { zuJahrMonat, type MietkontoZeitraum } from "@/lib/mietkonto";
import type { NkVorauszahlungInput } from "@/lib/nk";

// Beschafft die Belege für die geleisteten NK-Vorauszahlungen eines Mieters.
// Wird von allen drei Stellen genutzt, die eine Abrechnung erzeugen (Seite,
// PDF-Download, Beleihungs-Mappe), damit dieselbe Abrechnung überall dieselbe
// Zahl trägt.
//
// Zuordnung zum Abrechnungsjahr über `soll_monat` (der Monat, für den gezahlt
// wurde), ersatzweise über das Buchungsdatum. Eine im Januar 2025 nachgezahlte
// Dezembermiete 2024 gehört in die Abrechnung 2024 — nicht 2025.

export async function ladeVorauszahlung(
  mieterId: string,
  jahr: number,
): Promise<NkVorauszahlungInput> {
  const supabase = createClient();

  const [{ data: einnahmen }, { data: zeitraeume }] = await Promise.all([
    supabase
      .from("einnahmen")
      .select("nk_anteil,buchungsdatum,soll_monat")
      .eq("mieter_id", mieterId)
      .eq("kategorie", "Miete"),
    supabase
      .from("miet_zeitraeume")
      .select("von,bis,kaltmiete,nk_vorauszahlung,stellplatz_miete")
      .eq("mieter_id", mieterId),
  ]);

  let gebucht = 0;
  for (const e of einnahmen ?? []) {
    const anteil = Number(e.nk_anteil);
    if (!Number.isFinite(anteil) || anteil <= 0) continue;
    const ym = e.soll_monat ?? zuJahrMonat(e.buchungsdatum);
    if (!ym || Number(ym.slice(0, 4)) !== jahr) continue;
    gebucht += anteil;
  }

  return {
    gebucht: gebucht > 0 ? gebucht : null,
    zeitraeume: (zeitraeume ?? []) as MietkontoZeitraum[],
  };
}
