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
import { erwarteteMonate, monatLabel, ymPlus, zuJahrMonat, type MietkontoMieter, type MietkontoZeitraum } from "@/lib/mietkonto";
import { monatsStand, verteileZahlung, type GebuchteMiete, type Verteilung } from "@/lib/mietZahlung";
import { TEILZAHLUNG_TOLERANZ } from "@/lib/mietStatus";

export type Zahlung = { zeile: number; datum: string; betrag: number; name: string; zweck: string; iban: string };

export type AuszugErgebnis =
  | {
      ok: true;
      zahlungen: Zahlung[];
      /** Anzahl ALLER Ausgänge (auch fremde: Strom, Einkauf …). */
      ausgaenge: number;
      /** Die Ausgänge selbst (Betrag negativ) — für Rücklastschriften und Erstattungen an Mieter (Ablauf A). */
      abgaenge: Zahlung[];
      spalten: Record<string, string>;
    }
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
  const abgaenge: Zahlung[] = [];
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
    if (!datum || betrag == null || betrag === 0) return;
    const z: Zahlung = {
      zeile: kopf + i + 2,
      datum,
      betrag: Math.round(betrag * 100) / 100,
      name: (iName >= 0 ? r[iName] : "")?.trim() ?? "",
      zweck: (iZweck >= 0 ? r[iZweck] : "")?.trim() ?? "",
      iban: (iIban >= 0 ? r[iIban] : "")?.replace(/\s/g, "").toUpperCase() ?? "",
    };
    if (betrag < 0) { ausgaenge++; abgaenge.push(z); return; }
    zahlungen.push(z);
  });
  const benannt = (i: number) => (i >= 0 ? h[i] : "—");
  return {
    ok: true, zahlungen, ausgaenge, abgaenge,
    spalten: { datum: benannt(iDatum), betrag: iBetrag >= 0 ? benannt(iBetrag) : benannt(iHaben), name: benannt(iName), zweck: benannt(iZweck), iban: benannt(iIban) },
  };
}

// ---------------------------------------------------------------- Zuordnung --

export type OffenerMonat = {
  jahrMonat: string;
  gesamt: number;
  nk: number;
  /** Noch offener Rest nach Teilzahlungen (fehlt = ganzes Soll offen). */
  rest?: number;
};
export type AbgleichMieter = {
  mieterId: string;
  propId: string | null;
  name: string;
  nachname: string | null;
  /** SHA-256 (hex) der normalisierten IBAN — die IBAN selbst steht nicht im Browser. */
  ibanHash: string | null;
  offen: OffenerMonat[];
};

/** Ein möglicher Mieter für eine Zahlung (Ablauf A: Mehrdeutigkeit sichtbar machen). */
export type Kandidat = {
  mieterId: string;
  propId: string | null;
  name: string;
  /** Vorgeschlagener Mietmonat für diesen Mieter. */
  jahrMonat: string;
  /** Alle offenen Monate dieses Mieters — der Vermieter kann umstellen. */
  monate: OffenerMonat[];
  punkte: number;
  gruende: string[];
};

export type Treffer = Kandidat & {
  zahlung: Zahlung;
  stufe: "sicher" | "vorschlag";
  nkAnteil: number | null;
  /**
   * Weitere Mieter, auf die die Zahlung ebenfalls passt (mindestens 3 Punkte), stärkste zuerst.
   * Nicht leer = der Vermieter sieht, WARUM er prüfen soll, und kann den Mieter wechseln.
   */
  alternativen: Kandidat[];
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
    const kandidaten: Kandidat[] = [];

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
      // Betrag = volles Soll ODER der offene Rest nach einer Teilzahlung (Ablauf A).
      const betragGleich = offen.some((o) => Math.abs(o.gesamt - z.betrag) < 0.005);
      const restGleich = !betragGleich && offen.some((o) => o.rest != null && o.rest < o.gesamt && Math.abs(o.rest - z.betrag) < 0.005);
      if (betragGleich || restGleich) { punkte += 2; gruende.push(betragGleich ? "Betrag" : "Restbetrag"); }
      if (punkte < 3) continue;

      // Monat: Zielmonat, wenn offen; sonst der älteste offene (Rückstand zuerst ausgleichen).
      const ziel = zielMonat(z.datum);
      const sortiert = [...offen].sort((a, b) => a.jahrMonat.localeCompare(b.jahrMonat));
      const monat = sortiert.find((o) => o.jahrMonat === ziel) ?? sortiert[0];
      kandidaten.push({ mieterId: m.mieterId, propId: m.propId, name: m.name, jahrMonat: monat.jahrMonat, monate: m.offen, punkte, gruende });
    }

    if (kandidaten.length === 0) { ohneZuordnung.push(z); continue; }
    // Stärkster zuerst; bei gleicher Punktzahl bleibt die Reihenfolge der Mieterliste.
    const sortiert = kandidaten.map((k, i) => ({ k, i })).sort((a, b) => b.k.punkte - a.k.punkte || a.i - b.i).map((x) => x.k);
    const best = sortiert[0];
    const alternativen = sortiert.slice(1);
    // Zwei Mieter gleich gut? Dann nie „sicher“ — der Vermieter entscheidet.
    const gleichstand = alternativen.some((a) => a.punkte === best.punkte);
    const monat = best.monate.find((o) => o.jahrMonat === best.jahrMonat)!;
    verbraucht.add(`${best.mieterId}:${best.jahrMonat}`);
    const nkAnteil = monat.nk > 0 && monat.gesamt > 0
      ? Math.round(Math.min(monat.nk, (monat.nk * z.betrag) / monat.gesamt) * 100) / 100
      : null;
    treffer.push({
      ...best,
      zahlung: z,
      gruende: gleichstand ? [...best.gruende, "mehrdeutig"] : best.gruende,
      // „Sicher“ nur mit IBAN oder dem Namen im Auftraggeber — Betrag + Zweck allein beweisen nichts.
      stufe: best.punkte >= 4 && !gleichstand && (best.gruende.includes("IBAN") || best.gruende.includes("Name")) ? "sicher" : "vorschlag",
      nkAnteil,
      alternativen,
    });
  }
  return { treffer, ohneZuordnung };
}

/** IBAN für den Vergleich vereinheitlichen (Leerzeichen raus, Großbuchstaben). */
export const normIban = (s: string | null | undefined) => (s ?? "").replace(/\s/g, "").toUpperCase();

/**
 * Inhalt, aus dem der Browser die Kennung einer Bankzeile bildet (B07, 11.10.2026): Datum, Betrag,
 * Name, Zweck, IBAN und — bei mehreren GLEICHEN Zeilen in derselben Datei — deren laufende Nummer.
 * Gezählt wird über ALLE Zeilen der Datei, nicht nur über die ausgewählten: Wer erst die zweite von
 * zwei gleichen Zahlungen bucht und später die erste, bekommt zwei verschiedene Kennungen. Ein
 * erneutes Hochladen derselben Datei ergibt dieselben Kennungen — der Server bucht nichts doppelt.
 */
export function bankzeilenSchluessel(zahlungen: Zahlung[]): Map<number, string> {
  const vorkommen = new Map<string, number>();
  const aus = new Map<number, string>();
  for (const z of [...zahlungen].sort((a, b) => a.zeile - b.zeile)) {
    const roh = [z.datum, z.betrag.toFixed(2), z.name.trim(), z.zweck.trim(), normIban(z.iban)].join("|");
    const n = (vorkommen.get(roh) ?? 0) + 1;
    vorkommen.set(roh, n);
    aus.set(z.zeile, `${roh}|${n}`);
  }
  return aus;
}

// ------------------------------------------------- Ablauf A: Mieterdaten im Browser --

/** Gebuchte Mietzahlung, wie sie der Server für den Abgleich mitgibt (auch negative = Rückbuchung). */
export type GebuchteZahlung = { jahrMonat: string; betrag: number; datum: string };

/** Was der Browser über einen Mieter weiß: Vertrag, Miet-Zeiträume und gebuchte Mietzahlungen. */
export type MieterStand = {
  mieter: MietkontoMieter;
  zeitraeume: MietkontoZeitraum[];
  zahlungen: GebuchteZahlung[];
};

const alsBuchungen = (zahlungen: GebuchteZahlung[]): GebuchteMiete[] =>
  zahlungen.map((p) => ({ soll_monat: p.jahrMonat, buchungsdatum: p.datum, betrag: p.betrag, nk_anteil: null }));

/**
 * Offene Monate eines Mieters im Zeitraum — mit dem tatsächlichen Rest nach Teilzahlungen und
 * Rückbuchungen (dieselbe Rechnung wie der Server: `monatsStand` aus lib/mietZahlung.ts).
 */
export function offeneMonate(s: MieterStand, von: string, bis: string, heute?: Date): OffenerMonat[] {
  const buchungen = alsBuchungen(s.zahlungen);
  return erwarteteMonate(s.mieter, s.zeitraeume, von, bis, heute)
    .map((m) => {
      const st = monatsStand(s.mieter, s.zeitraeume, buchungen, m.jahrMonat);
      return { jahrMonat: m.jahrMonat, gesamt: m.gesamt, nk: m.nk, rest: Math.round(Math.max(0, st.rest) * 100) / 100 };
    })
    .filter((o) => o.gesamt > 0 && o.rest > TEILZAHLUNG_TOLERANZ);
}

/**
 * Vorschau der Verteilung für die AUSGEWÄHLTEN Eingänge — in derselben Reihenfolge und mit derselben
 * Funktion wie der Server (`verteileZahlung` ab dem gewählten Monat bis heute): Eine Sammelzahlung zeigt
 * vor dem Buchen, auf welche Monate sie geht und was als Überzahlung übrig bleibt. Zwei Zahlungen
 * desselben Mieters im Auszug werden nacheinander verrechnet, wie beim Buchen.
 */
export function vorschauVerteilung(
  zeilen: { schluessel: number; mieterId: string; betrag: number; monat: string }[],
  daten: Map<string, MieterStand>,
  heuteMonat: string,
): Map<number, Verteilung> {
  const aus = new Map<number, Verteilung>();
  const buchungen = new Map<string, GebuchteMiete[]>();
  for (const z of zeilen) {
    const d = daten.get(z.mieterId);
    if (!d || !(z.betrag > 0)) continue;
    if (!buchungen.has(z.mieterId)) buchungen.set(z.mieterId, alsBuchungen(d.zahlungen));
    const b = buchungen.get(z.mieterId)!;
    const v = verteileZahlung(z.betrag, z.monat, heuteMonat < z.monat ? z.monat : heuteMonat, (ym) => monatsStand(d.mieter, d.zeitraeume, b, ym));
    for (const t of v.teile) b.push({ soll_monat: t.jahrMonat, buchungsdatum: `${t.jahrMonat}-15`, betrag: t.betrag, nk_anteil: t.nk });
    aus.set(z.schluessel, v);
  }
  return aus;
}

// ------------------------------------------- Ablauf A: Rücklastschrift und Erstattung --
//
// Ausgänge an einen MIETER sind entweder eine Rücklastschrift (die Bank holt eine Mietzahlung zurück —
// der Monat ist wieder offen) oder eine Erstattung (der Vermieter zahlt eine Überzahlung zurück).
// Beides wird als NEGATIVE Mietbuchung im betroffenen Monat gebucht, mit derselben Kennung je
// Bankzeile wie ein Eingang — nie doppelt. Zugeordnet wird nur über IBAN oder Namen des Empfängers;
// ein Betrag allein beweist nichts. Kein Vorschlag ist vorausgewählt: Der Vermieter prüft jeden.
// Was weder eine Rücklastschrift noch die Rückgabe einer Überzahlung ist (Kaution, NK-Guthaben),
// lehnt der Server ab — das gehört unter Ein-/Ausgaben, nicht ins Mietkonto.

export type RueckArt = "ruecklastschrift" | "erstattung";

export type RueckMieter = {
  mieterId: string;
  propId: string | null;
  name: string;
  nachname: string | null;
  ibanHash: string | null;
  stand: MieterStand;
};

export type RueckMonat = { jahrMonat: string; gezahlt: number; ueberzahlt: number };

export type RueckTreffer = {
  zahlung: Zahlung;
  mieterId: string;
  propId: string | null;
  name: string;
  art: RueckArt;
  /** Vorgeschlagener Monat; null = kein passender Monat gefunden (der Vermieter wählt oder bucht woanders). */
  jahrMonat: string | null;
  /** Monate mit gebuchten Zahlungen bzw. Überzahlung — zur Auswahl. */
  monate: RueckMonat[];
  gruende: string[];
  /** Weitere Mieter mit gleicher oder schwächerer Übereinstimmung. */
  alternativen: { mieterId: string; name: string }[];
};

const RUECK_WORT = /r(ü|ue)cklastschrift|r(ü|ue)ckbuchung|r(ü|ue)ckgabe|retoure|storno|return|chargeback|widerspruch/i;

/** Monate eines Mieters mit Zahlungen: was gezahlt ist und was über dem Soll liegt. */
export function rueckMonate(s: MieterStand): RueckMonat[] {
  const buchungen = alsBuchungen(s.zahlungen);
  const monate = Array.from(new Set(s.zahlungen.map((p) => p.jahrMonat))).sort();
  return monate
    .map((ym) => {
      const st = monatsStand(s.mieter, s.zeitraeume, buchungen, ym);
      return { jahrMonat: ym, gezahlt: st.gezahlt, ueberzahlt: Math.round(Math.max(0, -st.rest) * 100) / 100 };
    })
    .filter((m) => m.gezahlt > 0);
}

const tageZwischen = (a: string, b: string) =>
  Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86_400_000);

/** Ordnet Ausgänge (Betrag < 0) einem Mieter zu und schlägt Art und Monat vor. */
export function gleicheRueckbuchungenAb(abgaenge: Zahlung[], mieter: RueckMieter[], ibanHashe: Map<number, string>): RueckTreffer[] {
  const aus: RueckTreffer[] = [];
  for (const z of [...abgaenge].sort((a, b) => a.datum.localeCompare(b.datum))) {
    if (!(z.betrag < 0)) continue;
    const betrag = Math.round(-z.betrag * 100) / 100;
    const kandidaten: { m: RueckMieter; punkte: number; gruende: string[] }[] = [];
    for (const m of mieter) {
      let punkte = 0;
      const gruende: string[] = [];
      const hz = ibanHashe.get(z.zeile);
      if (m.ibanHash && hz && m.ibanHash === hz) { punkte += 3; gruende.push("IBAN"); }
      const nn = (m.nachname ?? "").trim().toLowerCase();
      if (nn.length >= 3 && enthaeltWort(z.name.toLowerCase(), nn)) { punkte += 2; gruende.push("Name"); }
      if (punkte >= 2) kandidaten.push({ m, punkte, gruende });
    }
    if (kandidaten.length === 0) continue; // kein Mieter als Empfänger — ein gewöhnlicher Ausgang
    kandidaten.sort((a, b) => b.punkte - a.punkte);
    const { m, gruende } = kandidaten[0];
    const monate = rueckMonate(m.stand);
    const bisMonat = zuJahrMonat(z.datum)!;
    const vorher = monate.filter((x) => x.jahrMonat <= ymPlus(bisMonat, 1));

    // Rücklastschrift: Wort im Zweck, oder derselbe Betrag kam in den letzten 60 Tagen herein.
    const gleicherEingang = [...m.stand.zahlungen]
      .filter((p) => p.betrag > 0 && Math.abs(p.betrag - betrag) < 0.005 && p.datum <= z.datum && tageZwischen(p.datum, z.datum) <= 60)
      .sort((a, b) => b.datum.localeCompare(a.datum))[0];
    const ueberzahlterMonat = [...vorher].reverse().find((x) => x.ueberzahlt >= betrag - TEILZAHLUNG_TOLERANZ);
    const wort = RUECK_WORT.test(`${z.zweck} ${z.name}`);
    const art: RueckArt = wort || (gleicherEingang && !ueberzahlterMonat) ? "ruecklastschrift" : "erstattung";
    const grund: string[] = [...gruende];
    let jahrMonat: string | null;
    if (art === "ruecklastschrift") {
      const gedeckt = [...vorher].reverse().find((x) => x.gezahlt >= betrag - TEILZAHLUNG_TOLERANZ);
      jahrMonat = gleicherEingang?.jahrMonat ?? gedeckt?.jahrMonat ?? null;
      grund.push(wort ? "Rücklastschrift im Zweck" : `gleicher Betrag kam am ${gleicherEingang!.datum.split("-").reverse().join(".")} herein`);
    } else {
      jahrMonat = ueberzahlterMonat?.jahrMonat ?? null;
      grund.push(ueberzahlterMonat ? `Überzahlung im ${monatLabel(ueberzahlterMonat.jahrMonat)}` : "keine Überzahlung gefunden");
    }
    aus.push({
      zahlung: z,
      mieterId: m.mieterId,
      propId: m.propId,
      name: m.name,
      art,
      jahrMonat,
      monate,
      gruende: kandidaten.length > 1 && kandidaten[1].punkte === kandidaten[0].punkte ? [...grund, "mehrdeutig"] : grund,
      alternativen: kandidaten.slice(1).map((k) => ({ mieterId: k.m.mieterId, name: k.m.name })),
    });
  }
  return aus;
}

/**
 * Für einen Eingang OHNE Zuordnung: Gibt es genau EINEN Mieter, dessen IBAN oder Nachname passt?
 * Dann steht er in der Auswahl schon drin — angehakt wird trotzdem nichts (Ablauf A: ein Betrag,
 * der zu keiner offenen Miete passt, ist eine Teil- oder Sonderzahlung und braucht einen Blick).
 */
export function namensHinweis(z: Zahlung, mieter: AbgleichMieter[], ibanHashe: Map<number, string>): string | null {
  const hz = ibanHashe.get(z.zeile);
  const passend = mieter.filter((m) => {
    if (m.ibanHash && hz && m.ibanHash === hz) return true;
    const nn = (m.nachname ?? "").trim().toLowerCase();
    return nn.length >= 3 && (enthaeltWort(z.name.toLowerCase(), nn) || (!ZWECK_WOERTER.has(nn) && enthaeltWort(z.zweck.toLowerCase(), nn)));
  });
  return passend.length === 1 ? passend[0].mieterId : null;
}
