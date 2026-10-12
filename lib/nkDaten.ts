import "server-only";
import { createClient } from "@/lib/supabase/server";
import { zuJahrMonat, type MietkontoZeitraum } from "@/lib/mietkonto";
import type { NkVorauszahlungInput } from "@/lib/nk";
import { alleZeilen } from "@/lib/db/auswertung";

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
  const supabase = await createClient();

  // B08 (11.10.2026): vollständig oder gar nicht. Eine gescheiterte Abfrage ergab vorher „keine
  // Vorauszahlung“ — die Abrechnung wies dann eine zu hohe Nachzahlung aus, ohne jeden Hinweis.
  const [einnahmen, zeitraeume] = await Promise.all([
    alleZeilen<{ nk_anteil: number | null; buchungsdatum: string; soll_monat: string | null }>(
      supabase, "einnahmen", "nk_anteil,buchungsdatum,soll_monat", (q) => q.eq("mieter_id", mieterId).eq("kategorie", "Miete"),
    ),
    alleZeilen<MietkontoZeitraum>(
      supabase, "miet_zeitraeume", "von,bis,kaltmiete,nk_vorauszahlung,stellplatz_miete", (q) => q.eq("mieter_id", mieterId),
    ),
  ]);

  // Betrag UND Monatsabdeckung erfassen. `nk_anteil` ist optional — ohne die
  // Zählung der abgedeckten Monate gälte eine Teilsumme als vollständige
  // Vorauszahlung (siehe vorauszahlungFuerJahr).
  let gebucht = 0;
  const monate = new Set<string>();
  for (const e of einnahmen) {
    const anteil = Number(e.nk_anteil);
    if (!Number.isFinite(anteil) || anteil <= 0) continue;
    const ym = e.soll_monat ?? zuJahrMonat(e.buchungsdatum);
    if (!ym || Number(ym.slice(0, 4)) !== jahr) continue;
    gebucht += anteil;
    monate.add(ym);
  }

  return {
    gebucht: gebucht > 0 ? gebucht : null,
    gebuchteMonate: monate.size,
    zeitraeume,
  };
}
