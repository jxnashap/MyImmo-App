"use server";

// Mietkonto: einen erwarteten Mieteingang bestätigen → legt EINE Einnahme an.
// Bewusst OHNE redirect (die Bestätigungs-Animation läuft clientseitig weiter).
// Buchungsdatum = tatsächlicher Zufluss (§ 11 EStG), vom Nutzer editierbar.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type MietkontoResult = { ok: boolean; error?: string };

export async function bestaetigeMieteingang(input: {
  mieter_id: string;
  prop_id: string | null;
  buchungsdatum: string; // YYYY-MM-DD (Zufluss)
  betrag: number;
  nk_anteil: number | null;
}): Promise<MietkontoResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const betrag = Number(input.betrag);
  if (!Number.isFinite(betrag) || betrag <= 0)
    return { ok: false, error: "Betrag muss größer als 0 sein." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.buchungsdatum))
    return { ok: false, error: "Bitte ein gültiges Eingangsdatum wählen." };

  const nk = input.nk_anteil != null && Number.isFinite(Number(input.nk_anteil))
    ? Number(input.nk_anteil)
    : null;

  const { error } = await supabase.from("einnahmen").insert({
    user_id: user.id,
    mieter_id: input.mieter_id,
    prop_id: input.prop_id,
    buchungsdatum: input.buchungsdatum,
    kategorie: "Miete",
    betrag,
    beschreibung: "Mieteingang",
    nk_anteil: nk,
    wiederkehrend: true,
  });
  if (error) return { ok: false, error: "Buchen fehlgeschlagen." };

  revalidatePath("/mietkonto");
  revalidatePath("/cashflow");
  return { ok: true };
}

export type BatchZeile = {
  mieter_id: string;
  prop_id: string | null;
  buchungsdatum: string; // YYYY-MM-DD
  betrag: number;
  nk_anteil: number | null;
};

// Nacherfassung: mehrere Mieteingänge in einem Rutsch buchen (Insert-Array).
export async function bestaetigeMehrere(
  zeilen: BatchZeile[],
): Promise<{ ok: boolean; anzahl: number; error?: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, anzahl: 0, error: "Nicht angemeldet." };

  const gueltig = zeilen.filter(
    (z) =>
      z.mieter_id &&
      /^\d{4}-\d{2}-\d{2}$/.test(z.buchungsdatum) &&
      Number.isFinite(Number(z.betrag)) &&
      Number(z.betrag) > 0,
  );
  if (gueltig.length === 0) return { ok: false, anzahl: 0, error: "Keine gültigen Zeilen ausgewählt." };
  if (gueltig.length > 600) return { ok: false, anzahl: 0, error: "Zu viele Zeilen auf einmal (max. 600)." };

  const rows = gueltig.map((z) => ({
    user_id: user.id,
    mieter_id: z.mieter_id,
    prop_id: z.prop_id,
    buchungsdatum: z.buchungsdatum,
    kategorie: "Miete",
    betrag: Number(z.betrag),
    beschreibung: "Mieteingang (Nacherfassung)",
    nk_anteil: z.nk_anteil != null && Number.isFinite(Number(z.nk_anteil)) ? Number(z.nk_anteil) : null,
    wiederkehrend: true,
  }));

  const { error } = await supabase.from("einnahmen").insert(rows);
  if (error) return { ok: false, anzahl: 0, error: "Buchen fehlgeschlagen." };

  revalidatePath("/mietkonto");
  revalidatePath("/cashflow");
  return { ok: true, anzahl: rows.length };
}
