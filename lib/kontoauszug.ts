// Kontoauszug-Abgleich per CSV (02.10.2026; Plan vom 01.10., Phase 3 — „80 % von Open Banking
// ohne Lizenz und ohne Kosten je Konto“). Reine Funktionen, laufen IM BROWSER: Der Auszug enthält
// auch fremde Zahlungen (Gehalt, Privates) und verlässt das Gerät deshalb nicht. Zum Server gehen
// nur die Zeilen, die der Vermieter bestätigt (über `bestaetigeMehrere`, mit Dublettenschutz).
//
// ZUORDNUNG — bewusst vorsichtig: Ein Betrag allein ist KEIN Beleg (750 € überweist jeder).
// Gezählt werden IBAN des Mieters (+3), Nachname in Name/Verwendungszweck (+2) und ein Betrag,
// der genau einer offenen Soll-Miete entspricht (+2). Ab 4 Punkten „sicher“ (vorausgewählt),
// ab 3 „Vorschlag“ (nicht vorausgewählt), darunter keine Zuordnung.

import { parseCsv, parseZahl, parseDatum } from "@/lib/importCsv";
import { ymPlus, zuJahrMonat } from "@/lib/mietkonto";

export type Zahlung = { zeile: number; datum: string; betrag: number; name: string; zweck: string; iban: string };

export type AuszugErgebnis =
  | { ok: true; zahlungen: Zahlung[]; ausgaenge: number; spalten: Record<string, string> }
  | { ok: false; fehler: string };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöüß]/g, "");

// Spaltennamen der großen Banken (Sparkasse/CAMT-CSV, DKB, ING, comdirect, Volksbank, N26 …).
const ALIASE = {
  datum: ["buchungstag", "buchungsdatum", "datum", "buchung", "wertstellung", "valutadatum", "valuta"],
  betrag: ["betrag", "betrageur", "betrag€", "umsatz", "umsatzineur", "betragineur", "amount", "betragineuro"],
  haben: ["haben", "gutschrift", "eingang"],
  soll: ["soll", "lastschrift", "ausgang"],
  name: [
    "beguenstigterzahlungspflichtiger", "begünstigterzahlungspflichtiger", "namezahlungsbeteiligter",
    "zahlungspflichtigerin", "zahlungspflichtiger", "auftraggeberbegünstigter", "auftraggeberbeguenstigter",
    "auftraggeber", "empfänger", "empfaenger", "zahlungsempfängerin", "name", "gegenkonto", "payee",
  ],
  zweck: ["verwendungszweck", "buchungstext", "vorgangverwendungszweck", "beschreibung", "zweck", "paymentreference"],
  iban: ["iban", "kontonummeriban", "ibanzahlungsbeteiligter", "kontonummer", "ibanauftraggeber", "gegenkontoiban", "accountnumber"],
};

function spalte(headers: string[], aliase: string[]): number {
  const n = headers.map(norm);
  // erst exakte Treffer, dann „beginnt mit“ — „Betrag (EUR)“ → „betrageur“
  for (const a of aliase) { const i = n.indexOf(a); if (i >= 0) return i; }
  for (const a of aliase) { const i = n.findIndex((h) => h.startsWith(a)); if (i >= 0) return i; }
  return -1;
}

/** Liest einen Bank-CSV-Export. Vorspann-Zeilen (Kontoname, Zeitraum …) werden übersprungen. */
export function leseKontoauszug(text: string): AuszugErgebnis {
  const zeilen = text.replace(/^﻿/, "").split(/\r?\n/);
  // Kopfzeile = erste Zeile (in den ersten 40), die eine Datums- UND eine Betrags-/Haben-Spalte nennt.
  let kopf = -1;
  for (let i = 0; i < Math.min(zeilen.length, 40); i++) {
    const t = parseCsv(zeilen[i]).headers;
    if (spalte(t, ALIASE.datum) >= 0 && (spalte(t, ALIASE.betrag) >= 0 || spalte(t, ALIASE.haben) >= 0)) { kopf = i; break; }
  }
  if (kopf < 0) return { ok: false, fehler: "Keine Kopfzeile mit Datum und Betrag gefunden — ist das ein CSV-Export aus dem Online-Banking?" };

  const tab = parseCsv(zeilen.slice(kopf).join("\n"));
  const h = tab.headers;
  const iDatum = spalte(h, ALIASE.datum);
  const iBetrag = spalte(h, ALIASE.betrag);
  const iHaben = spalte(h, ALIASE.haben);
  const iSoll = spalte(h, ALIASE.soll);
  const iName = spalte(h, ALIASE.name);
  const iZweck = spalte(h, ALIASE.zweck);
  const iIban = spalte(h, ALIASE.iban);
  if (iName < 0 && iZweck < 0 && iIban < 0) {
    return { ok: false, fehler: "Weder Name, Verwendungszweck noch IBAN gefunden — so lässt sich keine Zahlung einem Mieter zuordnen." };
  }

  const zahlungen: Zahlung[] = [];
  let ausgaenge = 0;
  tab.rows.forEach((r, i) => {
    const datum = parseDatum(r[iDatum]);
    let betrag: number | null = null;
    if (iBetrag >= 0) betrag = parseZahl(r[iBetrag]);
    else {
      const haben = parseZahl(r[iHaben]);
      const soll = iSoll >= 0 ? parseZahl(r[iSoll]) : null;
      betrag = haben && haben > 0 ? haben : soll ? -Math.abs(soll) : null;
    }
    if (!datum || betrag == null) return;
    if (betrag <= 0) { ausgaenge++; return; }
    zahlungen.push({
      zeile: kopf + i + 2,
      datum,
      betrag: Math.round(betrag * 100) / 100,
      name: (iName >= 0 ? r[iName] : "")?.trim() ?? "",
      zweck: (iZweck >= 0 ? r[iZweck] : "")?.trim() ?? "",
      iban: (iIban >= 0 ? r[iIban] : "")?.replace(/\s/g, "").toUpperCase() ?? "",
    });
  });
  const benannt = (i: number) => (i >= 0 ? h[i] : "—");
  return {
    ok: true, zahlungen, ausgaenge,
    spalten: { datum: benannt(iDatum), betrag: iBetrag >= 0 ? benannt(iBetrag) : benannt(iHaben), name: benannt(iName), zweck: benannt(iZweck), iban: benannt(iIban) },
  };
}

// ---------------------------------------------------------------- Zuordnung --

export type OffenerMonat = { jahrMonat: string; gesamt: number; nk: number };
export type AbgleichMieter = {
  mieterId: string;
  propId: string | null;
  name: string;
  nachname: string | null;
  /** SHA-256 (hex) der normalisierten IBAN — die IBAN selbst steht nicht im Browser. */
  ibanHash: string | null;
  offen: OffenerMonat[];
};

export type Treffer = {
  zahlung: Zahlung;
  mieterId: string;
  propId: string | null;
  name: string;
  jahrMonat: string;
  /** Alle offenen Monate dieses Mieters — der Vermieter kann umstellen. */
  monate: OffenerMonat[];
  punkte: number;
  gruende: string[];
  stufe: "sicher" | "vorschlag";
  nkAnteil: number | null;
};

export type AbgleichErgebnis = { treffer: Treffer[]; ohneZuordnung: Zahlung[] };

/** Zielmonat einer Zahlung: ab dem 25. gilt sie meist schon dem Folgemonat (Miete im Voraus). */
export function zielMonat(datum: string): string {
  const ym = zuJahrMonat(datum)!;
  return Number(datum.slice(8, 10)) >= 25 ? ymPlus(ym, 1) : ym;
}

/** Wörter, die im Verwendungszweck nie als Nachname zählen (Monate, Miet-Begriffe). */
const ZWECK_WOERTER = new Set([
  "januar", "februar", "märz", "maerz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember",
  "miete", "mieter", "wohnung", "whg", "nebenkosten", "kaution", "kaltmiete", "warmmiete",
]);

/** Kommt `wort` als ganzes Wort (Buchstabengrenzen, auch Umlaute) im Text vor? */
export function enthaeltWort(text: string, wort: string): boolean {
  const esc = wort.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}])${esc}($|[^\\p{L}])`, "u").test(text);
}

/**
 * Ordnet Eingänge offenen Soll-Mieten zu. `ibanHashe` = SHA-256 der IBAN je Zahlung (im Browser
 * per crypto.subtle berechnet; hier als Map übergeben, damit die Funktion rein bleibt).
 */
export function gleicheAb(zahlungen: Zahlung[], mieter: AbgleichMieter[], ibanHashe: Map<number, string>): AbgleichErgebnis {
  const verbraucht = new Set<string>(); // mieterId:jahrMonat — eine Zahlung je Monat
  const treffer: Treffer[] = [];
  const ohneZuordnung: Zahlung[] = [];

  for (const z of [...zahlungen].sort((a, b) => a.datum.localeCompare(b.datum))) {
    let best: { m: AbgleichMieter; punkte: number; gruende: string[]; monat: OffenerMonat } | null = null;
    // Zwei Mieter gleich gut? Dann nie „sicher“ — der Vermieter entscheidet.
    let gleichstand = false;

    for (const m of mieter) {
      const offen = m.offen.filter((o) => !verbraucht.has(`${m.mieterId}:${o.jahrMonat}`));
      if (offen.length === 0) continue;
      let punkte = 0;
      const gruende: string[] = [];
      const hz = ibanHashe.get(z.zeile);
      if (m.ibanHash && hz && m.ibanHash === hz) { punkte += 3; gruende.push("IBAN"); }
      // Name nur als GANZES Wort (Audit P7, B14): Vorher fand „Mai“ in „Miete Mai 2026“ die Mieterin
      // Kai Mai — zusammen mit dem Betrag 4 Punkte, also „sicher“ und vorausgewählt, obwohl Petra
      // Schulz gezahlt hatte. Im Verwendungszweck zählen Monatsnamen und Miet-Wörter nicht als Name.
      const nn = (m.nachname ?? "").trim().toLowerCase();
      const imAuftraggeber = nn.length >= 3 && enthaeltWort(z.name.toLowerCase(), nn);
      const imZweck = nn.length >= 3 && !ZWECK_WOERTER.has(nn) && enthaeltWort(z.zweck.toLowerCase(), nn);
      if (imAuftraggeber || imZweck) { punkte += 2; gruende.push(imAuftraggeber ? "Name" : "Name im Zweck"); }
      const betragGleich = offen.some((o) => Math.abs(o.gesamt - z.betrag) < 0.005);
      if (betragGleich) { punkte += 2; gruende.push("Betrag"); }
      if (punkte < 3) continue;

      // Monat: Zielmonat, wenn offen; sonst der älteste offene (Rückstand zuerst ausgleichen).
      const ziel = zielMonat(z.datum);
      const sortiert = [...offen].sort((a, b) => a.jahrMonat.localeCompare(b.jahrMonat));
      const monat = sortiert.find((o) => o.jahrMonat === ziel) ?? sortiert[0];
      if (!best || punkte > best.punkte) { best = { m, punkte, gruende, monat }; gleichstand = false; }
      else if (punkte === best.punkte) gleichstand = true;
    }

    if (!best) { ohneZuordnung.push(z); continue; }
    verbraucht.add(`${best.m.mieterId}:${best.monat.jahrMonat}`);
    const nkAnteil = best.monat.nk > 0 && best.monat.gesamt > 0
      ? Math.round(Math.min(best.monat.nk, (best.monat.nk * z.betrag) / best.monat.gesamt) * 100) / 100
      : null;
    treffer.push({
      zahlung: z,
      mieterId: best.m.mieterId,
      propId: best.m.propId,
      name: best.m.name,
      jahrMonat: best.monat.jahrMonat,
      monate: best.m.offen,
      punkte: best.punkte,
      gruende: gleichstand ? [...best.gruende, "mehrdeutig"] : best.gruende,
      // „Sicher“ nur mit IBAN oder dem Namen im Auftraggeber — Betrag + Zweck allein beweisen nichts.
      stufe: best.punkte >= 4 && !gleichstand && (best.gruende.includes("IBAN") || best.gruende.includes("Name")) ? "sicher" : "vorschlag",
      nkAnteil,
    });
  }
  return { treffer, ohneZuordnung };
}

/** IBAN für den Vergleich vereinheitlichen (Leerzeichen raus, Großbuchstaben). */
export const normIban = (s: string | null | undefined) => (s ?? "").replace(/\s/g, "").toUpperCase();
