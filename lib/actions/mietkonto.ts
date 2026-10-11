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
import { TEILZAHLUNG_TOLERANZ } from "@/lib/mietStatus";
import { offeneMieten } from "@/lib/mietkonto";
import { erinnerungArchiviert, zahlungsBriefWahl, ERINNERUNG_TITEL_PRAEFIX, type ZahlungsBriefWahl } from "@/lib/mahnung";
import { eur2 } from "@/lib/format";

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
//   · „a:<mieter>|<YYYY-MM>“ — eine Zahlung, die einen OFFENEN Monat ausgleicht (Bestätigung oder
//                       Nacherfassung). Zwei Tabs, die denselben Monat gleichzeitig als bezahlt melden,
//                       erzeugen dieselbe Kennung — es bleibt bei EINER Buchung.
//   · „n:<mieter>|<YYYY-MM>“ — Nacherfassung mit einem Betrag unter dem Soll
//   Wurde im Monat schon etwas zurückgebucht (Rücklastschrift/Erstattung, Ablauf A), hängt an „a:“ und
//   „n:“ ein „|r<Anzahl>“ — sonst wäre der Monat nach einer Rücklastschrift nie wieder buchbar (die
//   alte Kennung existiert ja schon).
// Die Datenbank lässt jede Kennung nur EINMAL zu (`upsert … ignoreDuplicates`): Ein paralleler oder
// wiederholter Aufruf bucht nichts doppelt — auch nicht, wenn zwei Anfragen gleichzeitig ankommen.
// Verschiedene Zahlungen im selben Monat (Teilzahlungen) haben verschiedene Kennungen und sind erlaubt.
//
// Soll, NK-Anteil und Verteilung rechnet der SERVER aus Vertrag + bestehenden Buchungen
// (lib/mietZahlung.ts) — Werte aus dem Browser (nk_anteil, prop_id) werden nicht übernommen.
// ---------------------------------------------------------------------------------------------

type MieterDaten = {
  mieter: MietkontoMieter & { id: string; prop_id: string | null; vorname?: string | null; nachname?: string | null };
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
      .select("id,vorname,nachname,prop_id,kaltmiete,nk_vorauszahlung,stellplatz_miete,mietbeginn,mietende,minderungen")
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

/** Gleicht `betrag` den noch offenen Rest des Monats aus? (Nur, wenn überhaupt etwas offen ist.) */
function gleichtAus(stand: ReturnType<typeof monatsStand>, betrag: number): boolean {
  const offen = Math.max(0, stand.rest);
  return stand.soll != null && offen > TEILZAHLUNG_TOLERANZ && betrag >= offen - TEILZAHLUNG_TOLERANZ;
}

/**
 * Kennung „Monat ausgeglichen“: ohne Rückbuchung im Monat wie bisher, danach mit Zähler — eine
 * Rücklastschrift macht den Monat wieder offen, und der nächste Ausgleich ist ein neuer Vorgang.
 * Zwei gleichzeitige Bestätigungen sehen denselben Zähler → weiter nur EINE Buchung.
 */
function monatsKennung(praefix: "a" | "n", schluessel: string, buchungen: GebuchteMiete[], monat: string): string {
  const rueck = buchungen.filter((b) => (b.soll_monat ?? zuJahrMonat(b.buchungsdatum)) === monat && Number(b.betrag) < 0).length;
  return rueck > 0 ? `${praefix}:${schluessel}|r${rueck}` : `${praefix}:${schluessel}`;
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
  // Gleicht die Zahlung den offenen Monat aus, ist der MONAT die Kennung — zwei gleichzeitige
  // Bestätigungen (zwei Tabs) buchen ihn nur einmal. Eine Teilzahlung trägt die Kennung DIESER
  // Bestätigung; ohne Kennung (alter Client) beschreiben Datum + Betrag + Monat den Vorgang.
  const ref = gleichtAus(stand, betrag)
    ? monatsKennung("a", `${input.mieter_id}|${monat}`, daten.buchungen, monat)
    : IST_VORGANG.test(input.vorgang ?? "")
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
  /**
   * Nur Kontoauszug, Betrag NEGATIV: ein Ausgang an den Mieter (Ablauf A) — Rücklastschrift (der Monat
   * wird wieder offen) oder Erstattung einer Überzahlung. Ohne `art` sind nur positive Beträge gültig.
   */
  art?: "ruecklastschrift" | "erstattung" | null;
};

/** Ein Monat, der nach dem Abgleich noch offen ist — mit vorbereitetem Brief (nicht versendet). */
export type OffenNachAbgleich = {
  mieterId: string;
  name: string;
  jahrMonat: string;
  gesamt: number;
  gezahlt: number;
  rest: number;
  tageOffen: number;
  /** Nur bei überfälligen Monaten: Auswahl Zahlungserinnerung/Mahnung — öffnet einen ENTWURF. */
  wahl: ZahlungsBriefWahl | null;
};

export type BatchErgebnis = {
  ok: boolean;
  anzahl: number;
  uebersprungen?: number;
  ueberzahlung?: number;
  error?: string;
  /** Zeilen, die der Server nicht gebucht hat, mit Grund (z. B. Rückbuchung ohne passenden Eingang). */
  abgelehnt?: string[];
  /** Kontoauszug: für die betroffenen Mieter noch offene Monate (letzte 12) nach dem Buchen. */
  offen?: OffenNachAbgleich[];
};

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

  const istRueck = (z: BatchZeile) => quelle === "kontoauszug" && (z.art === "ruecklastschrift" || z.art === "erstattung");
  const gueltig = zeilen.filter(
    (z) =>
      z.mieter_id &&
      IST_DATUM.test(z.buchungsdatum) &&
      Number.isFinite(Number(z.betrag)) &&
      // Positiv = Eingang; negativ NUR als ausdrücklich gewählte Rückbuchung mit Mietmonat.
      (istRueck(z) ? Number(z.betrag) < 0 && IST_MONAT.test(z.soll_monat ?? "") : Number(z.betrag) > 0 && !z.art) &&
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
  const abgelehnt: string[] = [];
  const name = (d: MieterDaten) => [d.mieter.vorname, d.mieter.nachname].filter(Boolean).join(" ") || "Mieter";

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
      const schluessel = `${z.mieter_id}|${monat}`;
      if (vorgaenge.has(schluessel)) { uebersprungen++; continue; }
      vorgaenge.add(schluessel);
      const betrag = Number(z.betrag);
      const ref = monatsKennung(gleichtAus(s, betrag) ? "a" : "n", schluessel, d.buchungen, monat);
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
    if (istRueck(z)) {
      // Rückbuchung (Ablauf A): nie mehr zurück, als im Monat eingegangen bzw. überzahlt ist.
      const s = standFuer(monat);
      const betrag = Math.round(-Number(z.betrag) * 100) / 100;
      let nk: number;
      if (z.art === "ruecklastschrift") {
        if (betrag > s.gezahlt + TEILZAHLUNG_TOLERANZ) {
          abgelehnt.push(`${name(d)}, ${monatLabel(monat)}: Rücklastschrift ${eur2(betrag)} ist mehr als eingegangen (${eur2(s.gezahlt)}) — nicht gebucht.`);
          continue;
        }
        // Zurück geht derselbe Anteil an Nebenkosten, mit dem der Monat gebucht ist.
        nk = s.gezahlt > 0 ? Math.min(s.nkGezahlt, Math.round(((s.nkGezahlt * betrag) / s.gezahlt) * 100) / 100) : 0;
      } else {
        const ueber = Math.max(0, -s.rest);
        if (betrag > ueber + TEILZAHLUNG_TOLERANZ) {
          abgelehnt.push(`${name(d)}, ${monatLabel(monat)}: Erstattung ${eur2(betrag)}, überzahlt sind ${eur2(ueber)} — nicht gebucht. Kaution oder NK-Guthaben bitte unter Ein-/Ausgaben buchen.`);
          continue;
        }
        nk = s.soll ? Math.min(betrag, Math.max(0, Math.round((s.nkGezahlt - s.soll.nk) * 100) / 100)) : 0;
      }
      const row = {
        ...basis, betrag: -betrag, nk_anteil: nk > 0 ? -nk : null, soll_monat: monat, zahlung_ref: kopf,
        beschreibung: z.art === "ruecklastschrift" ? "Rücklastschrift (Kontoauszug)" : "Erstattung an Mieter (Kontoauszug)",
      };
      rows.push(row);
      d.buchungen.push({ soll_monat: monat, buchungsdatum: z.buchungsdatum, betrag: -betrag, nk_anteil: row.nk_anteil, zahlung_ref: kopf });
      continue;
    }
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
    ...(abgelehnt.length > 0 ? { abgelehnt } : {}),
    ...(quelle === "kontoauszug" ? { offen: await offenNachAbgleich(supabase, user.id, daten, name) } : {}),
  };
}

/**
 * Was nach dem Abgleich bei den betroffenen Mietern noch offen ist — aus Vertrag und den Buchungen
 * EINSCHLIESSLICH dieses Aufrufs (dieselbe Rechnung wie der Rückstands-Wächter: `offeneMieten`).
 * Für überfällige Monate liegt die Auswahl Zahlungserinnerung/Mahnung bei: Sie öffnet einen Entwurf
 * im Brief-Generator; versendet wird erst, was der Vermieter dort ausdrücklich freigibt.
 */
async function offenNachAbgleich(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  daten: Map<string, MieterDaten>,
  name: (d: MieterDaten) => string,
): Promise<OffenNachAbgleich[]> {
  const heute = heuteBerlin();
  const ids = Array.from(daten.keys());
  // Nur ein Hinweis unter „Mahnung“ — scheitert die Abfrage, fehlt der Hinweis, nicht der Vorschlag.
  const { data: erinnerungen } = ids.length
    ? await supabase.from("notizen").select("mieter_id,created_at").eq("user_id", userId).in("mieter_id", ids).ilike("titel", `${ERINNERUNG_TITEL_PRAEFIX}%`)
    : { data: [] };
  const aus: OffenNachAbgleich[] = [];
  for (const [id, d] of daten) {
    const buchungen = d.buchungen.map((b) => ({ ...b, kategorie: "Miete" }));
    for (const o of offeneMieten(d.mieter, d.zeitraeume, buchungen, heute)) {
      aus.push({
        mieterId: id, name: name(d), jahrMonat: o.jahrMonat, gesamt: o.gesamt, gezahlt: o.gezahlt, rest: o.rest, tageOffen: o.tageOffen,
        wahl: o.tageOffen > 0
          ? zahlungsBriefWahl({
              mieterId: id, mieterName: name(d), jahrMonat: o.jahrMonat, betrag: o.rest, heuteISO: heute,
              erinnerungArchiviert: erinnerungArchiviert((erinnerungen ?? []) as { mieter_id: string | null; created_at: string }[], id, o.faelligSeit),
            })
          : null,
      });
    }
  }
  return aus.sort((a, b) => b.tageOffen - a.tageOffen || a.name.localeCompare(b.name));
}
