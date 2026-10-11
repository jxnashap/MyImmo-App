"use server";

// Mietkonto: einen erwarteten Mieteingang bestätigen → legt EINE Einnahme an.
// Bewusst OHNE redirect (die Bestätigungs-Animation läuft clientseitig weiter).
// Buchungsdatum = tatsächlicher Zufluss (§ 11 EStG), vom Nutzer editierbar.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { monatLabel, zuJahrMonat, type MietkontoMieter, type MietkontoZeitraum } from "@/lib/mietkonto";
import { monatBezahlt, monatsStand, nkAnteilFuer, verteileZahlung, type GebuchteMiete } from "@/lib/mietZahlung";
import { DatenUnvollstaendig, ladeAlle, stapel } from "@/lib/db/ladeAlle";
import { heuteBerlin } from "@/lib/zeitraum";

export type MietkontoResult = {
  ok: boolean;
  error?: string;
  /** true = es wurde NICHTS gebucht (Monat schon bezahlt bzw. derselbe Vorgang schon gebucht). */
  uebersprungen?: boolean;
  /** Ausgewiesene Überzahlung dieses Vorgangs (B10). */
  ueberzahlung?: number;
};

// ---------------------------------------------------------------------------------------------
// B07/B09/B10 (Prüfstand 11.10.2026)
//
// Jede Mietbuchung trägt eine ZAHLUNGSKENNUNG (`einnahmen.zahlung_ref`, eindeutig je Konto,
// Migration 20261011110000). Sie beschreibt den Geschäftsvorgang, nicht den Monat:
//   · „m:<vorgang>“   — Bestätigung im Mietkonto; `vorgang` erzeugt der Browser EINMAL je Bestätigung
//                       (Doppelklick, Zeitüberlauf, erneutes Absenden → dieselbe Kennung)
//   · „ka:<hash>[#YYYY-MM]“ — Zeile aus dem Kontoauszug (Prüfsumme über Datum, Betrag, Zweck, Name,
//                       IBAN); eine Sammelzahlung wird je Monat mit „#YYYY-MM“ verteilt
//   · „n:<mieter>|<YYYY-MM>“ — Nacherfassung eines ganzen Monats
// Die Datenbank lässt jede Kennung nur EINMAL zu (`upsert … ignoreDuplicates`): Ein paralleler oder
// wiederholter Aufruf bucht nichts doppelt — auch nicht, wenn zwei Anfragen gleichzeitig ankommen.
// Verschiedene Zahlungen im selben Monat (Teilzahlungen) haben verschiedene Kennungen und sind erlaubt.
//
// Soll, NK-Anteil und Verteilung rechnet der SERVER aus Vertrag + bestehenden Buchungen
// (lib/mietZahlung.ts) — Werte aus dem Browser (nk_anteil, prop_id) werden nicht übernommen.
// ---------------------------------------------------------------------------------------------

type MieterDaten = {
  mieter: MietkontoMieter & { id: string; prop_id: string | null };
  zeitraeume: MietkontoZeitraum[];
  buchungen: (GebuchteMiete & { zahlung_ref: string | null })[];
};

const KEIN_BUCHEN = "Bestehende Buchungen konnten nicht geprüft werden — es wurde nichts angelegt. Bitte erneut versuchen.";

/** Vertrag, Miet-Zeiträume und gebuchte Mieten der genannten (EIGENEN) Mieter — vollständig. */
async function ladeMieterDaten(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  mieterIds: string[],
): Promise<Map<string, MieterDaten>> {
  const aus = new Map<string, MieterDaten>();
  for (const teil of stapel(mieterIds)) {
    const { data: mieter, error } = await supabase
      .from("mieter")
      .select("id,prop_id,kaltmiete,nk_vorauszahlung,stellplatz_miete,mietbeginn,mietende,minderungen")
      .eq("user_id", userId)
      .in("id", teil);
    if (error) throw new DatenUnvollstaendig("mieter", error.message);
    const zeitraeume = await ladeAlle<MietkontoZeitraum & { mieter_id: string }>("miet_zeitraeume", (von, bis) =>
      supabase.from("miet_zeitraeume").select("id,mieter_id,von,bis,kaltmiete,nk_vorauszahlung,stellplatz_miete")
        .eq("user_id", userId).in("mieter_id", teil).order("id").range(von, bis));
    const buchungen = await ladeAlle<GebuchteMiete & { mieter_id: string; zahlung_ref: string | null }>("einnahmen", (von, bis) =>
      supabase.from("einnahmen").select("id,mieter_id,soll_monat,buchungsdatum,betrag,nk_anteil,zahlung_ref")
        .eq("user_id", userId).eq("kategorie", "Miete").in("mieter_id", teil).order("id").range(von, bis));
    for (const m of (mieter ?? []) as MieterDaten["mieter"][]) {
      aus.set(m.id, {
        mieter: m,
        zeitraeume: zeitraeume.filter((z) => z.mieter_id === m.id),
        buchungen: buchungen.filter((b) => b.mieter_id === m.id),
      });
    }
  }
  return aus;
}

/** Fügt Mietbuchungen ein; eine schon vorhandene Zahlungskennung wird übersprungen (nicht doppelt). */
async function buchen(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: Record<string, unknown>[],
): Promise<{ ok: true; neu: Set<string> } | { ok: false }> {
  if (rows.length === 0) return { ok: true, neu: new Set() };
  const { data, error } = await supabase
    .from("einnahmen")
    .upsert(rows, { onConflict: "user_id,zahlung_ref", ignoreDuplicates: true })
    .select("zahlung_ref");
  if (error) return { ok: false };
  return { ok: true, neu: new Set(((data ?? []) as { zahlung_ref: string }[]).map((r) => r.zahlung_ref)) };
}

const IST_MONAT = /^\d{4}-\d{2}$/;
const IST_DATUM = /^\d{4}-\d{2}-\d{2}$/;
const IST_VORGANG = /^[A-Za-z0-9-]{8,80}$/;

export async function bestaetigeMieteingang(input: {
  mieter_id: string;
  prop_id?: string | null;
  buchungsdatum: string; // YYYY-MM-DD (Zufluss, § 11 EStG)
  betrag: number;
  nk_anteil?: number | null; // wird nicht übernommen — der Server rechnet (B09)
  soll_monat?: string | null; // YYYY-MM — zugeordneter Miet-Monat
  /** Kennung DIESER Bestätigung — vom Browser einmal erzeugt, bei Wiederholung gleich (B07). */
  vorgang?: string | null;
  /** Bewusst eine weitere Zahlung für einen schon bezahlten Monat (Überzahlung, B10). */
  weitere?: boolean;
}): Promise<MietkontoResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  const betrag = Number(input.betrag);
  if (!Number.isFinite(betrag) || betrag <= 0)
    return { ok: false, error: "Betrag muss größer als 0 sein." };
  if (!IST_DATUM.test(input.buchungsdatum))
    return { ok: false, error: "Bitte ein gültiges Eingangsdatum wählen." };
  const monat = IST_MONAT.test(input.soll_monat ?? "") ? input.soll_monat! : zuJahrMonat(input.buchungsdatum)!;

  let daten: MieterDaten | undefined;
  try {
    daten = (await ladeMieterDaten(supabase, user.id, [input.mieter_id])).get(input.mieter_id);
  } catch {
    return { ok: false, error: KEIN_BUCHEN };
  }
  if (!daten) return { ok: false, error: "Mieter nicht gefunden." };

  const stand = monatsStand(daten.mieter, daten.zeitraeume, daten.buchungen, monat);
  if (monatBezahlt(stand) && !input.weitere) {
    revalidatePath("/mietkonto");
    return { ok: false, uebersprungen: true, error: `${monatLabel(monat)} ist bereits vollständig bezahlt — es wurde nichts angelegt.` };
  }
  // Ohne Kennung (alter Client): Datum + Betrag + Monat beschreiben den Vorgang — ein erneutes
  // Absenden derselben Angaben bucht dann ebenfalls nicht doppelt.
  const ref = IST_VORGANG.test(input.vorgang ?? "")
    ? `m:${input.vorgang}`
    : `m:${input.mieter_id}|${monat}|${input.buchungsdatum}|${betrag.toFixed(2)}`;
  const ueberzahlung = Math.max(0, Math.round((betrag - Math.max(0, stand.rest)) * 100) / 100);

  const r = await buchen(supabase, [{
    user_id: user.id,
    mieter_id: input.mieter_id,
    prop_id: daten.mieter.prop_id,
    buchungsdatum: input.buchungsdatum,
    kategorie: "Miete",
    betrag,
    beschreibung: "Mieteingang",
    nk_anteil: nkAnteilFuer(stand, betrag),
    wiederkehrend: true,
    soll_monat: monat,
    zahlung_ref: ref,
  }]);
  if (!r.ok) return { ok: false, error: "Buchen fehlgeschlagen." };
  revalidatePath("/mietkonto");
  revalidatePath("/cashflow");
  if (!r.neu.has(ref)) return { ok: true, uebersprungen: true };
  return ueberzahlung > 0 ? { ok: true, ueberzahlung } : { ok: true };
}

export type BatchZeile = {
  mieter_id: string;
  prop_id?: string | null;
  buchungsdatum: string; // YYYY-MM-DD
  betrag: number;
  nk_anteil?: number | null; // wird nicht übernommen — der Server rechnet (B09)
  soll_monat?: string | null; // YYYY-MM
  /** Nur Kontoauszug: Prüfsumme der Bankzeile — derselbe Umsatz wird nie zweimal gebucht. */
  vorgang?: string | null;
};

export type BatchErgebnis = { ok: boolean; anzahl: number; uebersprungen?: number; ueberzahlung?: number; error?: string };

/**
 * Mehrere Mieteingänge in EINEM Schritt (eine Anweisung = atomar).
 *   · quelle „nacherfassung“: ganze Monate; ein Monat, für den schon etwas gebucht ist, wird nicht
 *     erneut vorgeschlagen und nicht gebucht (Kennung „n:<mieter>|<monat>“).
 *   · quelle „kontoauszug“: je Bankzeile EIN Vorgang; Teilzahlungen sind erlaubt, eine Sammelzahlung
 *     wird auf offene Folgemonate verteilt, der Rest als Überzahlung ausgewiesen.
 */
export async function bestaetigeMehrere(
  zeilen: BatchZeile[],
  quelle: "nacherfassung" | "kontoauszug" = "nacherfassung",
): Promise<BatchErgebnis> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, anzahl: 0, error: "Nicht angemeldet." };

  const gueltig = zeilen.filter(
    (z) =>
      z.mieter_id &&
      IST_DATUM.test(z.buchungsdatum) &&
      Number.isFinite(Number(z.betrag)) &&
      Number(z.betrag) > 0 &&
      (quelle === "nacherfassung" || IST_VORGANG.test(z.vorgang ?? "")),
  );
  if (gueltig.length === 0) return { ok: false, anzahl: 0, error: "Keine gültigen Zeilen ausgewählt." };
  if (gueltig.length > 600) return { ok: false, anzahl: 0, error: "Zu viele Zeilen auf einmal (max. 600)." };

  let daten: Map<string, MieterDaten>;
  try {
    daten = await ladeMieterDaten(supabase, user.id, Array.from(new Set(gueltig.map((z) => z.mieter_id))));
  } catch {
    return { ok: false, anzahl: 0, error: KEIN_BUCHEN };
  }

  const heuteMonat = heuteBerlin().slice(0, 7);
  const rows: Record<string, unknown>[] = [];
  const vorgaenge = new Set<string>();
  let ueberzahlung = 0;
  let uebersprungen = 0;

  for (const z of gueltig) {
    const d = daten.get(z.mieter_id);
    if (!d) { uebersprungen++; continue; } // fremder oder gelöschter Mieter
    const monat = IST_MONAT.test(z.soll_monat ?? "") ? z.soll_monat! : zuJahrMonat(z.buchungsdatum)!;
    // Buchungen dieses Aufrufs zählen für die folgenden Zeilen mit (zwei Teilzahlungen im selben Auszug).
    const standFuer = (ym: string) => monatsStand(d.mieter, d.zeitraeume, d.buchungen, ym);
    const basis = {
      user_id: user.id, mieter_id: z.mieter_id, prop_id: d.mieter.prop_id, buchungsdatum: z.buchungsdatum,
      kategorie: "Miete", wiederkehrend: true,
    };
    if (quelle === "nacherfassung") {
      const s = standFuer(monat);
      if (s.gezahlt > 0) { uebersprungen++; continue; } // ganzer Monat — schon etwas gebucht → nicht vorschlagen
      const ref = `n:${z.mieter_id}|${monat}`;
      if (vorgaenge.has(ref)) { uebersprungen++; continue; }
      vorgaenge.add(ref);
      const betrag = Number(z.betrag);
      rows.push({ ...basis, betrag, beschreibung: "Mieteingang (Nacherfassung)", nk_anteil: nkAnteilFuer(s, betrag), soll_monat: monat, zahlung_ref: ref });
      d.buchungen.push({ soll_monat: monat, buchungsdatum: z.buchungsdatum, betrag, nk_anteil: nkAnteilFuer(s, betrag), zahlung_ref: ref });
      continue;
    }
    const kopf = `ka:${z.vorgang}`;
    if (vorgaenge.has(kopf) || d.buchungen.some((b) => b.zahlung_ref === kopf || b.zahlung_ref?.startsWith(`${kopf}#`))) {
      uebersprungen++;
      continue;
    }
    vorgaenge.add(kopf);
    const v = verteileZahlung(Number(z.betrag), monat, heuteMonat < monat ? monat : heuteMonat, standFuer);
    ueberzahlung += v.ueberzahlung;
    v.teile.forEach((t, i) => {
      const ref = v.teile.length === 1 ? kopf : `${kopf}#${t.jahrMonat}`;
      rows.push({
        ...basis, betrag: t.betrag, nk_anteil: t.nk, soll_monat: t.jahrMonat, zahlung_ref: ref,
        beschreibung: v.teile.length > 1 ? `Mieteingang (Kontoauszug, Teil ${i + 1}/${v.teile.length})` : "Mieteingang (Kontoauszug)",
      });
      d.buchungen.push({ soll_monat: t.jahrMonat, buchungsdatum: z.buchungsdatum, betrag: t.betrag, nk_anteil: t.nk, zahlung_ref: ref });
    });
  }

  const r = await buchen(supabase, rows);
  if (!r.ok) return { ok: false, anzahl: 0, error: "Buchen fehlgeschlagen." };
  revalidatePath("/mietkonto");
  revalidatePath("/cashflow");
  const neu = r.neu.size;
  return {
    ok: true,
    anzahl: neu,
    ...(uebersprungen + (rows.length - neu) > 0 ? { uebersprungen: uebersprungen + (rows.length - neu) } : {}),
    ...(ueberzahlung > 0 ? { ueberzahlung: Math.round(ueberzahlung * 100) / 100 } : {}),
  };
}
