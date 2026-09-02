"use server";

// Mietkonto: einen erwarteten Mieteingang bestätigen → legt EINE Einnahme an.
// Bewusst OHNE redirect (die Bestätigungs-Animation läuft clientseitig weiter).
// Buchungsdatum = tatsächlicher Zufluss (§ 11 EStG), vom Nutzer editierbar.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { zuJahrMonat } from "@/lib/mietkonto";

export type MietkontoResult = {
  ok: boolean;
  error?: string;
  /** true = es wurde NICHTS gebucht, weil dieser Miet-Monat schon erfasst war. */
  uebersprungen?: boolean;
};

/**
 * Idempotenz-Schlüssel einer Miet-Buchung.
 *
 * Entscheidend ist der MIET-MONAT, nicht das Zahlungsdatum: Zahlt ein Mieter am
 * 05.07. sowohl die Juni- als auch die Julimiete nach, sind das zwei Buchungen
 * mit demselben Datum — mit dem alten Schlüssel (Mieter + Datum) wurde die
 * zweite stillschweigend verworfen und trotzdem Erfolg gemeldet. Das Geld fehlte
 * danach in Cashflow und Anlage V.
 *
 * Fehlt der Miet-Monat, bleibt das Buchungsdatum der Schlüssel — dann gibt es
 * nichts Besseres, und der Doppelklick-Schutz greift weiterhin.
 */
function buchungsSchluessel(mieterId: string, buchungsdatum: string, sollMonat: string | null): string {
  // Altbuchungen (manuell oder ueber die Bank erfasst) haben kein `soll_monat`.
  // Frueher bekamen sie einen `d:<datum>`-Schluessel und kollidierten deshalb
  // NIE mit einer neuen Buchung fuer denselben Monat — der Dublettenschutz lief
  // fuer genau diese Zeilen ins Leere. Ueberall sonst in der App gilt
  // `soll_monat ?? zuJahrMonat(buchungsdatum)`; hier jetzt auch.
  return `${mieterId}|${sollMonat ?? zuJahrMonat(buchungsdatum) ?? `d:${buchungsdatum}`}`;
}

export async function bestaetigeMieteingang(input: {
  mieter_id: string;
  prop_id: string | null;
  buchungsdatum: string; // YYYY-MM-DD (Zufluss)
  betrag: number;
  nk_anteil: number | null;
  soll_monat?: string | null; // YYYY-MM — zugeordneter Miet-Monat
}): Promise<MietkontoResult> {
  const supabase = await createClient();
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

  const sollMonat = /^\d{4}-\d{2}$/.test(input.soll_monat ?? "") ? input.soll_monat! : null;

  // Serverseitige Idempotenz über den Miet-Monat (siehe buchungsSchluessel).
  const { data: bestand } = await supabase
    .from("einnahmen")
    .select("buchungsdatum,soll_monat")
    .eq("mieter_id", input.mieter_id)
    .eq("kategorie", "Miete");
  const schluessel = buchungsSchluessel(input.mieter_id, input.buchungsdatum, sollMonat);
  const schonDa = (bestand ?? []).some(
    (e) => buchungsSchluessel(input.mieter_id, e.buchungsdatum, e.soll_monat ?? null) === schluessel,
  );
  if (schonDa) {
    revalidatePath("/mietkonto");
    return {
      ok: false,
      uebersprungen: true,
      error: sollMonat
        ? `Für ${sollMonat} ist bereits ein Mieteingang gebucht — es wurde nichts angelegt.`
        : "Für dieses Datum ist bereits ein Mieteingang gebucht — es wurde nichts angelegt.",
    };
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
    soll_monat: sollMonat,
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
  soll_monat?: string | null; // YYYY-MM
};

// Nacherfassung: mehrere Mieteingänge in einem Rutsch buchen (Insert-Array).
export async function bestaetigeMehrere(
  zeilen: BatchZeile[],
): Promise<{ ok: boolean; anzahl: number; error?: string }> {
  const supabase = await createClient();
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

  // Serverseitige Idempotenz je Miet-Monat (siehe buchungsSchluessel) —
  // zusätzlich Dubletten innerhalb der Auswahl.
  const mieterIds = Array.from(new Set(gueltig.map((z) => z.mieter_id)));

  // Nur die betroffenen Monate laden, nicht die komplette Miethistorie.
  // Vorher lief die Abfrage ohne jede Eingrenzung; PostgREST liefert hoechstens
  // `db-max-rows` Zeilen, bei langer Historie fehlten also aeltere Buchungen im
  // Dublettenschutz — und die Nacherfassung legte sie ein zweites Mal an.
  const monate = Array.from(
    new Set(
      gueltig.map((z) =>
        /^\d{4}-\d{2}$/.test(z.soll_monat ?? "") ? z.soll_monat! : zuJahrMonat(z.buchungsdatum) ?? "",
      ),
    ),
  ).filter(Boolean).sort();
  const vonDatum = `${monate[0]}-01`;
  const bisDatum = `${monate[monate.length - 1]}-31`;

  const [{ data: mitMonat }, { data: ohneMonat }] = await Promise.all([
    supabase
      .from("einnahmen")
      .select("mieter_id,buchungsdatum,soll_monat")
      .eq("kategorie", "Miete")
      .in("mieter_id", mieterIds)
      .in("soll_monat", monate),
    // Altzeilen ohne soll_monat werden ueber ihr Buchungsdatum zugeordnet.
    supabase
      .from("einnahmen")
      .select("mieter_id,buchungsdatum,soll_monat")
      .eq("kategorie", "Miete")
      .in("mieter_id", mieterIds)
      .is("soll_monat", null)
      .gte("buchungsdatum", vonDatum)
      .lte("buchungsdatum", bisDatum),
  ]);
  const gebucht = new Set(
    [...(mitMonat ?? []), ...(ohneMonat ?? [])].map((v) =>
      buchungsSchluessel(v.mieter_id, v.buchungsdatum, v.soll_monat ?? null),
    ),
  );

  const rows: Record<string, unknown>[] = [];
  for (const z of gueltig) {
    const sm = /^\d{4}-\d{2}$/.test(z.soll_monat ?? "") ? z.soll_monat! : null;
    const key = buchungsSchluessel(z.mieter_id, z.buchungsdatum, sm);
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
      soll_monat: sm,
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
