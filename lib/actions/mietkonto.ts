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

  // Serverseitige Idempotenz: gleicher Mieter + gleiches Zahlungsdatum ist
  // schon gebucht (Doppelklick/doppelter Request) → nicht erneut anlegen.
  const { data: schonDa } = await supabase
    .from("einnahmen")
    .select("id")
    .eq("mieter_id", input.mieter_id)
    .eq("kategorie", "Miete")
    .eq("buchungsdatum", input.buchungsdatum)
    .limit(1);
  if (schonDa?.length) {
    revalidatePath("/mietkonto");
    return { ok: true };
  }

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

  // Serverseitige Idempotenz: bereits gebuchte (Mieter, Datum)-Paare überspringen
  // (Doppelklick/doppelter Request) — zusätzlich Dubletten innerhalb der Auswahl.
  const mieterIds = Array.from(new Set(gueltig.map((z) => z.mieter_id)));
  const daten = Array.from(new Set(gueltig.map((z) => z.buchungsdatum)));
  const { data: vorhandene } = await supabase
    .from("einnahmen")
    .select("mieter_id,buchungsdatum")
    .eq("kategorie", "Miete")
    .in("mieter_id", mieterIds)
    .in("buchungsdatum", daten);
  const gebucht = new Set((vorhandene ?? []).map((v) => `${v.mieter_id}|${v.buchungsdatum}`));

  const rows: Record<string, unknown>[] = [];
  for (const z of gueltig) {
    const key = `${z.mieter_id}|${z.buchungsdatum}`;
    if (gebucht.has(key)) continue;
    gebucht.add(key);
    rows.push({
      user_id: user.id,
      mieter_id: z.mieter_id,
      prop_id: z.prop_id,
      buchungsdatum: z.buchungsdatum,
      kategorie: "Miete",
      betrag: Number(z.betrag),
      beschreibung: "Mieteingang (Nacherfassung)",
      nk_anteil: z.nk_anteil != null && Number.isFinite(Number(z.nk_anteil)) ? Number(z.nk_anteil) : null,
      wiederkehrend: true,
    });
  }
  if (rows.length === 0) {
    revalidatePath("/mietkonto");
    return { ok: true, anzahl: 0 };
  }

  const { error } = await supabase.from("einnahmen").insert(rows);
  if (error) return { ok: false, anzahl: 0, error: "Buchen fehlgeschlagen." };

  revalidatePath("/mietkonto");
  revalidatePath("/cashflow");
  return { ok: true, anzahl: rows.length };
}
