// Mietkonto: Soll-Miete je Monat ermitteln und erwartete Monats-Einnahmen
// für einen Zeitraum (bis 10 Jahre zurück) als VORSCHLÄGE erzeugen — reine
// Funktionen ohne DB-Zugriff, gebucht wird an anderer Stelle.
//
// Steuerlicher Rahmen (§ 11 EStG, Zufluss-/Abflussprinzip): Es zählt der Tag
// des tatsächlichen Geldeingangs. standardDatum ist deshalb nur ein VORSCHLAG
// (1. des Monats) und beim Bestätigen editierbar. Keine Steuerberatung.

import { TEILZAHLUNG_TOLERANZ, dritterWerktag, mieteBezahlt, mietFaelligkeit } from "@/lib/mietStatus";
import { heuteBerlin } from "@/lib/zeitraum";
// Fälligkeit und Toleranz liegen seit 07.10.2026 in lib/mietStatus.ts (eine Regel, Audit P7).
export { TEILZAHLUNG_TOLERANZ, dritterWerktag };

/**
 * Mietminderung (§ 536 BGB) für einen Zeitraum — tritt kraft Gesetzes ein; ein geminderter Monat
 * ist mit dem geminderten Betrag bezahlt, nicht „offen“ (Gesamtprüfung 07.10.2026, B15).
 * Gespeichert als JSON-Liste am Mieter (`mieter.minderungen`). `prozent` ODER `betrag` (€/Monat).
 */
export type Minderung = {
  von: string;        // YYYY-MM
  bis: string | null; // YYYY-MM (einschließlich) oder null = läuft noch
  prozent?: number | null;
  betrag?: number | null;
  grund?: string | null;
  anliegen_id?: string | null;
};

export type MietkontoMieter = {
  kaltmiete: number | null;
  nk_vorauszahlung: number | null;
  stellplatz_miete?: number | null;
  mietbeginn: string | null; // ISO-Datum
  mietende: string | null;   // ISO-Datum oder null = unbefristet
  /** Erfasste Mietminderungen (§ 536 BGB). */
  minderungen?: Minderung[] | null;
};

export type MietkontoZeitraum = {
  von: string;        // YYYY-MM-01
  bis: string | null; // YYYY-MM-01 (einschließlich) oder null = laufend
  kaltmiete: number | null;
  nk_vorauszahlung: number | null;
  stellplatz_miete: number | null;
};

export type SollMiete = {
  kaltmiete: number;
  nk: number;
  stellplatz: number;
  gesamt: number;
  /**
   * Gesetzt, wenn der Monat nur teilweise zum Mietverhältnis gehört (Einzug
   * oder Auszug mitten im Monat). Die Beträge sind dann bereits tagesanteilig
   * gekürzt; die Werte dienen der Anzeige („16/30 Tage").
   */
  anteilig?: { tage: number; tageImMonat: number };
  /** Gesetzt, wenn eine Mietminderung den Monat betrifft: um diesen Betrag ist `gesamt` gekürzt. */
  minderung?: { betrag: number; grund: string | null };
};

export type ErwarteterMonat = SollMiete & {
  jahrMonat: string;     // YYYY-MM
  standardDatum: string; // YYYY-MM-01 (Vorschlag, editierbar)
};

export type ErwarteterMonatMitStatus = ErwarteterMonat & { schonGebucht: boolean };

// ---- Monats-Helfer (alles auf YYYY-MM-Ebene, ISO-Strings vergleichen sauber) ----

const YM = /^\d{4}-\d{2}$/;

/** ISO-Datum/-Monat → "YYYY-MM" (null bei leer/ungültig). */
export function zuJahrMonat(d: string | null | undefined): string | null {
  if (!d) return null;
  const ym = d.slice(0, 7);
  return YM.test(ym) ? ym : null;
}

/** "YYYY-MM" + n Monate. */
export function ymPlus(ym: string, n: number): string {
  const [j, m] = ym.split("-").map(Number);
  const gesamt = j * 12 + (m - 1) + n;
  const jj = Math.floor(gesamt / 12);
  const mm = (gesamt % 12) + 1;
  return `${jj}-${String(mm).padStart(2, "0")}`;
}

/**
 * Voreingestellter Startmonat der Nacherfassung.
 *
 * Der spätere von: frühester Mietbeginn · Januar des VORJAHRES.
 *
 * VORHER (bis 30.09.2026): frühester Mietbeginn, bis zu zehn Jahre zurück.
 * Wer beim Einrichten Mieter seit 2015 anlegte, sah beim ersten Blick ins
 * Mietkonto „Nacherfassen (600)" — in der Demo waren es 299, weil der
 * älteste Vertrag von 2018 ist und ab 2025 gebucht wurde. Das Review nannte
 * es abschreckend, und es ist auch nicht die Aufgabe: Für die Anlage V zählt
 * das Vorjahr. Wer weiter zurück will, stellt den Startmonat früher ein (bis
 * zehn Jahre, unverändert).
 */
export function standardStartNacherfassung(mietbeginne: (string | null | undefined)[], aktuellerMonat: string): string {
  const vorjahrJanuar = `${Number(aktuellerMonat.slice(0, 4)) - 1}-01`;
  const beginne = mietbeginne
    .map((b) => (b ?? "").slice(0, 7))
    .filter((ym) => YM.test(ym))
    .sort();
  const fruehester = beginne[0];
  return fruehester && fruehester > vorjahrJanuar ? fruehester : vorjahrJanuar;
}

const rund2 = (n: number) => Math.round(n * 100) / 100;

// -------------------------------------------------------------- Soll-Miete ----

/** Zahl der Kalendertage eines Monats ("2026-02" → 28). */
export function tageImMonat(jahrMonat: string): number {
  const [j, m] = jahrMonat.split("-").map(Number);
  return new Date(Date.UTC(j, m, 0)).getUTCDate();
}

/**
 * Vertragswerte (volle Monatsbeträge, ohne Tagesanteil und ohne Prüfung der Mietzeit)
 * für einen Monat: Ein Miet-Zeitraum, der den Monat abdeckt, gewinnt (bei Überlappung
 * der mit dem spätesten „von“), sonst die Felder am Mieter.
 *
 * Die EINE Regel für „welche Miete gilt in Monat X“ — Mietkonto, Dashboard, Objektseite
 * und Briefe benutzen sie (Verknüpfungs-Audit 06.10.2026, Paket B). Vorher nahmen die
 * Kacheln die Mieterfelder, das Mietkonto die Zeiträume: zwei Zahlen für eine Sache.
 */
export function vertragswerte(
  mieter: Pick<MietkontoMieter, "kaltmiete" | "nk_vorauszahlung" | "stellplatz_miete">,
  zeitraeume: MietkontoZeitraum[],
  jahrMonat: string,
): { kaltmiete: number; nk: number; stellplatz: number } {
  const monatsanfang = `${jahrMonat}-01`;
  const passend = zeitraeume
    .filter((z) => z.von <= monatsanfang && (z.bis == null || z.bis >= monatsanfang))
    .sort((a, b) => b.von.localeCompare(a.von))[0];
  return {
    kaltmiete: Number(passend ? passend.kaltmiete : mieter.kaltmiete) || 0,
    nk: Number(passend ? passend.nk_vorauszahlung : mieter.nk_vorauszahlung) || 0,
    stellplatz: Number(passend ? passend.stellplatz_miete : mieter.stellplatz_miete) || 0,
  };
}

/**
 * Soll-Miete eines Mieters für einen Kalendermonat.
 * 1. Deckt ein Miet-Zeitraum den Monat ab (von <= Monatsanfang und
 *    (bis == null oder bis >= Monatsanfang)) → dessen Werte.
 *    Bei Überlappung gewinnt der Zeitraum mit dem spätesten "von".
 * 2. Sonst Fallback auf die Stammdaten des Mieters.
 * Außerhalb von mietbeginn..mietende (auf Monatsebene) → null.
 *
 * Beginnt oder endet das Mietverhältnis MITTEN im Monat, wird die Miete
 * tagesanteilig gekürzt (pro rata temporis) und in `anteilig` ausgewiesen.
 * Ohne diese Kürzung bekämen bei einem Mieterwechsel zum Monatswechsel beide
 * Mieter die volle Monatsmiete vorgeschlagen — für denselben Monat, dieselbe
 * Wohnung.
 */
export function sollFuerMonat(
  mieter: MietkontoMieter,
  zeitraeume: MietkontoZeitraum[],
  jahrMonat: string,
): SollMiete | null {
  const soll = sollOhneMinderung(mieter, zeitraeume, jahrMonat);
  if (!soll) return null;
  const md = minderungImMonat(mieter.minderungen, jahrMonat);
  if (!md) return soll;
  // Minderung von der Bruttomiete (BGH VIII ZR 223/04), gekürzt zuerst an der Kaltmiete.
  const betrag = rund2(Math.min(soll.gesamt, md.prozent != null ? (soll.gesamt * md.prozent) / 100 : md.betrag ?? 0));
  if (betrag <= 0) return soll;
  const kaltmiete = rund2(Math.max(0, soll.kaltmiete - betrag));
  return { ...soll, kaltmiete, gesamt: rund2(soll.gesamt - betrag), minderung: { betrag, grund: md.grund ?? null } };
}

/**
 * Prüft eine eingegebene Minderung. Prozent (0 < p ≤ 100) ODER Betrag (> 0), nie beides; von/bis als
 * "YYYY-MM". Gibt die bereinigte Minderung oder einen Fehlertext zurück. EINE Prüfung für die Action.
 */
export function minderungAus(roh: {
  von?: unknown; bis?: unknown; prozent?: unknown; betrag?: unknown; grund?: unknown; anliegen_id?: unknown;
}): Minderung | { fehler: string } {
  const ym = (v: unknown) => (typeof v === "string" && YM.test(v.slice(0, 7)) ? v.slice(0, 7) : null);
  const zahl = (v: unknown) => {
    if (v == null || v === "") return null;
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  };
  const von = ym(roh.von);
  if (!von) return { fehler: "Bitte den ersten geminderten Monat angeben." };
  const bis = roh.bis == null || roh.bis === "" ? null : ym(roh.bis);
  if (roh.bis != null && roh.bis !== "" && !bis) return { fehler: "Der letzte Monat ist ungültig." };
  if (bis && bis < von) return { fehler: "„Bis“ liegt vor „Von“." };
  const prozent = zahl(roh.prozent);
  const betrag = zahl(roh.betrag);
  if (Number.isNaN(prozent) || Number.isNaN(betrag)) return { fehler: "Bitte eine Zahl angeben." };
  if ((prozent == null) === (betrag == null)) return { fehler: "Bitte entweder Prozent oder einen Betrag je Monat angeben." };
  if (prozent != null && !(prozent > 0 && prozent <= 100)) return { fehler: "Prozent zwischen 0 und 100." };
  if (betrag != null && !(betrag > 0)) return { fehler: "Der Betrag muss größer als 0 sein." };
  const grund = typeof roh.grund === "string" ? roh.grund.trim().slice(0, 200) || null : null;
  const anliegen = typeof roh.anliegen_id === "string" && /^[0-9a-f-]{36}$/i.test(roh.anliegen_id) ? roh.anliegen_id : null;
  return { von, bis, prozent: prozent ?? null, betrag: betrag != null ? rund2(betrag) : null, grund, anliegen_id: anliegen };
}

/** Die Minderung, die einen Monat betrifft (spätestes „von“ gewinnt). */
export function minderungImMonat(minderungen: Minderung[] | null | undefined, jahrMonat: string): Minderung | null {
  const passend = (minderungen ?? [])
    .filter((m) => YM.test(m.von) && m.von <= jahrMonat && (m.bis == null || m.bis >= jahrMonat))
    .filter((m) => (m.prozent != null && m.prozent > 0) || (m.betrag != null && m.betrag > 0))
    .sort((a, b) => b.von.localeCompare(a.von));
  return passend[0] ?? null;
}

function sollOhneMinderung(
  mieter: MietkontoMieter,
  zeitraeume: MietkontoZeitraum[],
  jahrMonat: string,
): SollMiete | null {
  if (!YM.test(jahrMonat)) return null;

  // Mietverhältnis aktiv? (Monat des Beginns/Endes zählt jeweils mit.)
  const beginnYm = zuJahrMonat(mieter.mietbeginn);
  const endeYm = zuJahrMonat(mieter.mietende);
  if (beginnYm && jahrMonat < beginnYm) return null;
  if (endeYm && jahrMonat > endeYm) return null;
  if (!beginnYm) return null; // ohne Mietbeginn keine Soll-Miete

  const { kaltmiete: kaltmieteVoll, nk: nkVoll, stellplatz: stellplatzVoll } = vertragswerte(mieter, zeitraeume, jahrMonat);

  // Belegte Tage im Monat — nur relevant im Beginn-/Endemonat.
  const gesamtTage = tageImMonat(jahrMonat);
  const ersterTag = beginnYm === jahrMonat ? Number(mieter.mietbeginn!.slice(8, 10)) || 1 : 1;
  const letzterTag =
    endeYm === jahrMonat ? Math.min(gesamtTage, Number(mieter.mietende!.slice(8, 10)) || gesamtTage) : gesamtTage;
  const belegteTage = Math.max(0, letzterTag - ersterTag + 1);

  if (belegteTage >= gesamtTage) {
    return {
      kaltmiete: kaltmieteVoll,
      nk: nkVoll,
      stellplatz: stellplatzVoll,
      gesamt: rund2(kaltmieteVoll + nkVoll + stellplatzVoll),
    };
  }

  const q = belegteTage / gesamtTage;
  const kaltmiete = rund2(kaltmieteVoll * q);
  const nk = rund2(nkVoll * q);
  const stellplatz = rund2(stellplatzVoll * q);
  return {
    kaltmiete,
    nk,
    stellplatz,
    gesamt: rund2(kaltmiete + nk + stellplatz),
    anteilig: { tage: belegteTage, tageImMonat: gesamtTage },
  };
}

// ------------------------------------------------------- erwartete Monate ----

/**
 * Erwartete Monats-Einnahmen von vonMonat bis bisMonat (je einschließlich).
 * vonMonat wird nie älter als max(heute − 10 Jahre, mietbeginn) angesetzt;
 * Monate ohne Soll-Miete (außerhalb des Mietverhältnisses) werden übersprungen.
 * `heute` ist nur für Tests übersteuerbar.
 */
export function erwarteteMonate(
  mieter: MietkontoMieter,
  zeitraeume: MietkontoZeitraum[],
  vonMonat: string,
  bisMonat: string,
  heute: Date = new Date(),
): ErwarteterMonat[] {
  if (!YM.test(vonMonat) || !YM.test(bisMonat)) return [];

  const heuteYm = `${heute.getFullYear()}-${String(heute.getMonth() + 1).padStart(2, "0")}`;
  const zehnJahre = ymPlus(heuteYm, -120);
  const beginnYm = zuJahrMonat(mieter.mietbeginn);

  let start = vonMonat;
  if (start < zehnJahre) start = zehnJahre;
  if (beginnYm && start < beginnYm) start = beginnYm;

  const monate: ErwarteterMonat[] = [];
  for (let ym = start; ym <= bisMonat; ym = ymPlus(ym, 1)) {
    const soll = sollFuerMonat(mieter, zeitraeume, ym);
    if (!soll) continue;
    monate.push({ ...soll, jahrMonat: ym, standardDatum: `${ym}-01` });
    if (monate.length > 1200) break; // Sicherung gegen Endlosschleifen
  }
  return monate;
}

// ------------------------------------------------------------------ Dedup ----

export type DedupEinnahme = {
  buchungsdatum: string | null;
  kategorie: string | null;
  /** Zugeordneter Miet-Monat (YYYY-MM) — schlägt den Monat des Buchungsdatums,
   *  damit verspätete Zahlungen den richtigen Monat schließen. */
  soll_monat?: string | null;
  /** Betrag der Buchung. Fehlt er (alte Aufrufer), zählt die Buchung als voll bezahlt. */
  betrag?: number | null;
};


/**
 * Gezahlter Betrag eines Monats aus den Miet-Buchungen (soll_monat, sonst Buchungsmonat).
 * `null` = mindestens eine Buchung ohne Betrag (dann gilt der Monat als bezahlt, wie bisher).
 */
export function gezahltImMonat(einnahmen: DedupEinnahme[], jahrMonat: string): number | null {
  let summe = 0;
  for (const e of einnahmen) {
    if ((e.kategorie ?? "").toLowerCase() !== "miete") continue;
    if ((e.soll_monat ?? zuJahrMonat(e.buchungsdatum)) !== jahrMonat) continue;
    if (e.betrag == null) return null;
    summe += Number(e.betrag) || 0;
  }
  return Math.round(summe * 100) / 100;
}

/**
 * Markiert erwartete Monate als "schonGebucht", wenn für den Kalendermonat
 * bereits eine Miet-Einnahme existiert (soll_monat, sonst Monat des
 * Buchungsdatums). `vorhandeneEinnahmen` müssen bereits die Einnahmen DIESES
 * Mieters sein.
 */
export function dedup(
  erwartet: ErwarteterMonat[],
  vorhandeneEinnahmen: DedupEinnahme[],
): ErwarteterMonatMitStatus[] {
  const gebucht = new Set(
    vorhandeneEinnahmen
      .filter((e) => (e.kategorie ?? "").toLowerCase() === "miete")
      .map((e) => e.soll_monat ?? zuJahrMonat(e.buchungsdatum))
      .filter(Boolean) as string[],
  );
  return erwartet.map((m) => ({ ...m, schonGebucht: gebucht.has(m.jahrMonat) }));
}

// -------------------------------------------------------- offene Mieten ----

export type OffeneMiete = ErwarteterMonat & {
  /** Fälligkeit: 3. Werktag des Monats (§ 556b Abs. 1 BGB) */
  faelligSeit: string;
  tageOffen: number;
  /** Schon gezahlt (Teilzahlung), sonst 0. */
  gezahlt: number;
  /** Was fehlt: Soll − gezahlt. */
  rest: number;
};

const MONATE_DE = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

/** "2026-07" → "Juli 2026" */
export function monatLabel(ym: string): string {
  const [j, m] = ym.split("-").map(Number);
  return `${MONATE_DE[(m ?? 1) - 1] ?? ym} ${j}`;
}

/**
 * Offene (unbestätigte) Miet-Monate der letzten 12 Monate — der
 * Rückstands-Wächter. Ein Monat gilt als offen, wenn die gebuchten Miet-Einnahmen
 * das Soll um mehr als TEILZAHLUNG_TOLERANZ unterschreiten (keine Buchung = 0 gezahlt)
 * und die Fälligkeit (3. Werktag, § 556b BGB) erreicht wurde.
 *
 * Teilzahlung (Paket B, 06.10.2026): Vorher galt ein Monat mit IRGENDEINER Buchung als
 * bezahlt — zahlte ein Mieter 400 von 900 €, sah er im Portal „teilweise“, der Vermieter
 * nichts. Die Nacherfassung (`dedup`) bleibt bei „irgendeine Buchung“: Sie schlägt ganze
 * Monate vor, und ein zweiter voller Vorschlag für einen teilbezahlten Monat wäre eine
 * Doppelbuchung.
 */
export function offeneMieten(
  mieter: MietkontoMieter,
  zeitraeume: MietkontoZeitraum[],
  einnahmen: DedupEinnahme[],
  heute: Date | string = new Date(),
): OffeneMiete[] {
  // Stichtag = Berliner Kalenderdatum (Audit P7, B13): vorher Server-Ortszeit — um 23:30 UTC
  // war es in Berlin schon der nächste Tag, und „tageOffen“ hing an der Zeitzone des Servers.
  const heuteISO = typeof heute === "string" ? heute.slice(0, 10) : heuteBerlin(heute);
  const heuteYm = heuteISO.slice(0, 7);
  const erwartet = erwarteteMonate(mieter, zeitraeume, ymPlus(heuteYm, -11), heuteYm, new Date(`${heuteISO}T12:00:00Z`));
  const offene: OffeneMiete[] = [];
  for (const m of erwartet) {
    if (m.gesamt <= 0) continue;
    const gezahlt = gezahltImMonat(einnahmen, m.jahrMonat);
    if (gezahlt == null || mieteBezahlt(m.gesamt, gezahlt)) continue;
    const f = mietFaelligkeit(m.jahrMonat, heuteISO);
    if (f.stand === "nicht_faellig") continue; // aktueller Monat, noch nicht fällig
    offene.push({ ...m, faelligSeit: f.faellig, tageOffen: f.tage, gezahlt, rest: Math.round((m.gesamt - gezahlt) * 100) / 100 });
  }
  return offene;
}
