// Erhaltungsrücklage der WEG je Steuerjahr (10.10.2026, Betreiber nach Paket P14).
//
// RECHT: BFH, Urteil vom 14.01.2025, IX R 19/24 (BStBl 2025 II S. 291) — die Zuführung von Hausgeld zur
// Erhaltungsrücklage ist auch nach der WEG-Reform 2020 KEINE Werbungskosten. Abziehbar ist erst, was die
// Gemeinschaft für Erhaltungsmaßnahmen ausgibt, im Jahr der Ausgabe. Der Vordruck sagt dasselbe:
// „Nicht umgelegte Kosten (… – ohne Erhaltungsrücklage –)“ und Erhaltungsaufwendungen „einschließlich
// Entnahmen aus der Erhaltungsrücklage“. Quellen: BFH-Urteil (rewis.io), lohnsteuer-kompakt.de,
// steuertipps.de, etl.de — abgerufen 10.10.2026.
//
// VORHER: MyImmo zog jedes gebuchte Hausgeld voll ab — mit Zuführung. Bei einer typischen ETW sind das
// einige hundert Euro im Jahr zu viel Werbungskosten.
//
// DATEN: beide Beträge stehen in der WEG-Jahresabrechnung (Einzelabrechnung des Eigentümers). Gespeichert
// je Objekt und Jahr in `properties.weg_ruecklage` (Migration 20261010162259):
//   {"2025": {"zufuehrung": 600, "entnahme": 0}}
// Die Buchungen bleiben unverändert — das Hausgeld ist wirklich abgeflossen (Cashflow, Buchungssaldo).
// Nur die Anlage V rechnet: Hausgeld − Zuführung, Erhaltung + Entnahme.

import { zahlDe } from "@/lib/zahl";

export type WegRuecklageJahr = { zufuehrung: number; entnahme: number };

/** Obergrenze je Betrag — schützt vor Tippfehlern (ein Komma zu weit rechts). */
export const RUECKLAGE_MAX = 1_000_000;

const istBetrag = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= RUECKLAGE_MAX;

/** Eintrag eines Jahres aus der gespeicherten Spalte — null, wenn nichts (Gültiges) eingetragen ist. */
export function ruecklageImJahr(json: unknown, jahr: number): WegRuecklageJahr | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const e = (json as Record<string, unknown>)[String(jahr)];
  if (!e || typeof e !== "object") return null;
  const { zufuehrung, entnahme } = e as Record<string, unknown>;
  if (!istBetrag(zufuehrung) || !istBetrag(entnahme)) return null;
  return { zufuehrung, entnahme };
}

/** Alle gültigen Jahre, neuestes zuerst — für die Anzeige auf der Objektseite. */
export function ruecklageListe(json: unknown): ({ jahr: number } & WegRuecklageJahr)[] {
  if (!json || typeof json !== "object" || Array.isArray(json)) return [];
  return Object.keys(json)
    .filter((k) => /^\d{4}$/.test(k))
    .map(Number)
    .map((jahr) => ({ jahr, wert: ruecklageImJahr(json, jahr) }))
    .filter((x): x is { jahr: number; wert: WegRuecklageJahr } => x.wert != null)
    .map(({ jahr, wert }) => ({ jahr, ...wert }))
    .sort((a, b) => b.jahr - a.jahr);
}

/** Eingabe aus dem Formular prüfen. Beträge sind Geld (Textfeld) → `zahlDe`. Leer = 0. */
export function ruecklageEintragAus(
  jahrRoh: unknown,
  zufuehrungRoh: unknown,
  entnahmeRoh: unknown,
): { jahr: number; wert: WegRuecklageJahr } | { fehler: string } {
  const jahr = Number(String(jahrRoh ?? "").trim());
  if (!Number.isInteger(jahr) || jahr < 2000 || jahr > 2100) return { fehler: "Bitte ein Jahr angeben." };
  const betrag = (roh: unknown) => {
    const s = String(roh ?? "").trim();
    return s === "" ? 0 : zahlDe(s);
  };
  const zufuehrung = betrag(zufuehrungRoh);
  const entnahme = betrag(entnahmeRoh);
  if (zufuehrung == null || entnahme == null) return { fehler: "Bitte Beträge als Zahl eingeben (z. B. 600 oder 1.250,50)." };
  if (!istBetrag(zufuehrung) || !istBetrag(entnahme)) return { fehler: "Die Beträge müssen zwischen 0 und 1.000.000 € liegen." };
  return { jahr, wert: { zufuehrung: Math.round(zufuehrung * 100) / 100, entnahme: Math.round(entnahme * 100) / 100 } };
}

/** Gespeichertes Objekt plus ein Jahr (ersetzt einen vorhandenen Eintrag des Jahres). */
export function mitRuecklageJahr(json: unknown, jahr: number, wert: WegRuecklageJahr): Record<string, WegRuecklageJahr> {
  const basis: Record<string, WegRuecklageJahr> = {};
  for (const e of ruecklageListe(json)) basis[String(e.jahr)] = { zufuehrung: e.zufuehrung, entnahme: e.entnahme };
  basis[String(jahr)] = wert;
  return basis;
}

/** Gespeichertes Objekt ohne das Jahr. */
export function ohneRuecklageJahr(json: unknown, jahr: number): Record<string, WegRuecklageJahr> {
  const basis: Record<string, WegRuecklageJahr> = {};
  for (const e of ruecklageListe(json)) if (e.jahr !== jahr) basis[String(e.jahr)] = { zufuehrung: e.zufuehrung, entnahme: e.entnahme };
  return basis;
}

/** Hat das Objekt überhaupt eine WEG? Eigentumswohnung oder gepflegtes Hausgeld. */
export function hatWeg(p: { typ?: string | null; hausgeld?: number | null }): boolean {
  return p.typ === "Eigentumswohnung" || (Number(p.hausgeld) || 0) > 0;
}

/** Kategorie, unter der Hausgeld gebucht wird (lib/kategorien.ts). */
export const HAUSGELD_KATEGORIE = "Hausgeld / WEG";

export const RUECKLAGE_FEHLT_HINWEIS =
  "Im Hausgeld steckt meist eine Zuführung zur Erhaltungsrücklage. Sie ist keine Werbungskosten (BFH, Urteil vom 14.01.2025, IX R 19/24) — abziehbar ist erst, was die Gemeinschaft für eine Erhaltung ausgibt. Trage beides aus der WEG-Jahresabrechnung auf der Objektseite ein, sonst sind die Werbungskosten zu hoch.";
