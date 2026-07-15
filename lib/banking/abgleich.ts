// Abgleich-Engine (Etappe 3): entschlüsselte Bank-Umsätze mit erwarteten
// Mieten abgleichen bzw. Ausgaben als Kostenvorschläge aufbereiten.
// Reine Funktionen ohne DB-Zugriff — Prinzip „vorschlagen + per Klick
// bestätigen", es wird hier NICHTS automatisch gebucht.

import { sollFuerMonat, zuJahrMonat, type MietkontoMieter, type MietkontoZeitraum } from "@/lib/mietkonto";

export type AbgleichUmsatz = {
  id: string;
  buchungsdatum: string | null;
  betrag: number;
  gegenpartei: string | null;      // entschlüsselt
  verwendungszweck: string | null; // entschlüsselt
  status: string;
};

export type AbgleichMieter = {
  id: string;
  vorname: string | null;
  nachname: string | null;
  prop_id: string | null;
  stammdaten: MietkontoMieter;
  zeitraeume: MietkontoZeitraum[];
};

export type MietVorschlag = {
  mieterId: string;
  mieterName: string;
  propId: string | null;
  jahrMonat: string;      // Monat, dem der Eingang zugeordnet wird
  sollGesamt: number;
  nkAnteil: number | null; // NK-Anteil, wenn der Betrag der vollen Soll-Miete entspricht
  konfidenz: "hoch" | "mittel";
  schonGebucht: boolean;   // für diesen Monat existiert bereits eine Miet-Einnahme
};

export type KostenVorschlag = {
  kategorie: string;
  beschreibung: string;
  wiederkehrend: boolean; // gleiche Gegenpartei + Betrag mehrfach gesehen
};

// ------------------------------------------------------------- Text-Helfer --

/** Namen/Zwecktexte vergleichbar machen: klein, Umlaute aufgelöst, nur a–z0–9. */
export function normalisiere(text: string | null | undefined): string {
  return (text ?? "")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function enthaeltWort(heuhaufen: string, nadel: string): boolean {
  if (nadel.length < 3) return false; // zu kurze Namen matchen alles
  return ` ${heuhaufen} `.includes(` ${nadel} `) || heuhaufen.includes(nadel);
}

// --------------------------------------------------------- Miet-Abgleich ----

const rund2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Besten Mieter-Vorschlag für EINEN Eingang (betrag > 0) finden.
 * Kriterien: Name in Gegenpartei/Verwendungszweck + Betrag ≈ Soll-Miete des
 * Buchungsmonats. Vorschlag nur bei eindeutigem Treffer:
 * - „hoch":   Name passt UND Betrag passt (±1 €)
 * - „mittel": Name passt ODER Betrag exakt (±1 Cent) bei genau einem Mieter
 */
export function findeMietVorschlag(
  umsatz: AbgleichUmsatz,
  mieter: AbgleichMieter[],
  gebuchteMonate: ReadonlyMap<string, ReadonlySet<string>>,
): MietVorschlag | null {
  if (umsatz.betrag <= 0) return null;
  const ym = zuJahrMonat(umsatz.buchungsdatum);
  if (!ym) return null;

  const text = normalisiere(`${umsatz.gegenpartei ?? ""} ${umsatz.verwendungszweck ?? ""}`);

  type Kandidat = { m: AbgleichMieter; soll: NonNullable<ReturnType<typeof sollFuerMonat>>; nameTrifft: boolean; betragExakt: boolean; betragNah: boolean };
  const kandidaten: Kandidat[] = [];

  for (const m of mieter) {
    const soll = sollFuerMonat(m.stammdaten, m.zeitraeume, ym);
    if (!soll || soll.gesamt <= 0) continue;

    const nachname = normalisiere(m.nachname);
    const vorname = normalisiere(m.vorname);
    const nameTrifft =
      enthaeltWort(text, nachname) ||
      (enthaeltWort(text, vorname) && vorname.length >= 4);

    const diff = Math.abs(umsatz.betrag - soll.gesamt);
    const betragExakt = diff <= 0.01;
    const betragNah = diff <= 1;

    if (nameTrifft || betragExakt) kandidaten.push({ m, soll, nameTrifft, betragExakt, betragNah });
  }

  if (kandidaten.length === 0) return null;

  // Rangfolge: Name+Betrag > Name > nur Betrag. Bei Gleichstand → kein
  // Vorschlag (lieber nichts vorschlagen als falsch zuordnen).
  const score = (k: Kandidat) => (k.nameTrifft ? 2 : 0) + (k.betragExakt ? 2 : k.betragNah ? 1 : 0);
  kandidaten.sort((a, b) => score(b) - score(a));
  const bester = kandidaten[0];
  if (kandidaten.length > 1 && score(kandidaten[1]) === score(bester)) return null;

  const konfidenz: "hoch" | "mittel" = bester.nameTrifft && bester.betragNah ? "hoch" : "mittel";
  const name = [bester.m.vorname, bester.m.nachname].filter(Boolean).join(" ") || "Mieter";

  return {
    mieterId: bester.m.id,
    mieterName: name,
    propId: bester.m.prop_id,
    jahrMonat: ym,
    sollGesamt: bester.soll.gesamt,
    nkAnteil: bester.betragNah && bester.soll.nk > 0 ? rund2(bester.soll.nk) : null,
    konfidenz,
    schonGebucht: gebuchteMonate.get(bester.m.id)?.has(ym) ?? false,
  };
}

// ------------------------------------------------------ Kosten-Vorschlag ----

const KATEGORIE_REGELN: Array<[RegExp, string]> = [
  [/versicherung|allianz|axa|huk|ergo|provinzial|gothaer/, "Versicherung"],
  [/grundsteuer|stadtkasse|gemeindekasse|steuerkasse|finanzamt/, "Grundsteuer"],
  [/hausgeld|weg\b|wohnungseigent/, "Hausgeld / WEG"],
  [/hausverwaltung|verwaltung/, "Verwaltung"],
  [/handwerk|sanitaer|elektro|maler|dachdeck|installat|reparatur/, "Reparatur"],
  [/makler|courtage/, "Makler"],
];

/**
 * Kostenvorschlag für EINEN Ausgang (betrag < 0): Kategorie aus
 * Schlüsselwörtern raten, Beschreibung aus Gegenpartei/Zweck.
 * `alleUmsaetze` dient der Wiederkehrend-Erkennung (gleiche Gegenpartei +
 * gleicher Betrag mindestens zweimal).
 */
export function findeKostenVorschlag(
  umsatz: AbgleichUmsatz,
  alleUmsaetze: AbgleichUmsatz[],
): KostenVorschlag | null {
  if (umsatz.betrag >= 0) return null;

  const text = normalisiere(`${umsatz.gegenpartei ?? ""} ${umsatz.verwendungszweck ?? ""}`);
  const kategorie = KATEGORIE_REGELN.find(([re]) => re.test(text))?.[1] ?? "Sonstiges";

  const beschreibung =
    (umsatz.gegenpartei?.trim() || umsatz.verwendungszweck?.trim() || "Bank-Umsatz").slice(0, 120);

  const gegen = normalisiere(umsatz.gegenpartei);
  const wiederkehrend =
    gegen.length >= 3 &&
    alleUmsaetze.filter(
      (u) =>
        u.id !== umsatz.id &&
        u.betrag < 0 &&
        Math.abs(u.betrag - umsatz.betrag) <= 0.01 &&
        normalisiere(u.gegenpartei) === gegen,
    ).length >= 1;

  return { kategorie, beschreibung, wiederkehrend };
}
