// Zwei Bereiche, eine App (05.10.2026, Vorgabe des Betreibers):
//
//   MyImmo  = automatisierte Verwaltung (Mieter, Buchungen, Abrechnung)
//   BuyImmo = aktive Kommandozentrale für den Bestandsaufbau (Kaufen, Finanzieren, Verkaufen)
//
// Gewechselt wird oben links am Logo. Welcher Bereich offen ist, folgt ALLEIN aus der Adresse —
// kein gespeicherter Zustand, kein Cookie. Dadurch öffnet ein Lesezeichen auf /kauf immer
// BuyImmo, „Zurück“ bleibt heil, und Server und Browser rendern dieselbe Navigation.
//
// Ausnahme: Seiten, die zu BEIDEN Bereichen gehören (Einstellungen, Hilfe, Objekt-Detail),
// behalten den Bereich, aus dem man kam. Wer in BuyImmo ein Objekt aus der Seitenleiste
// anklickt, soll nicht plötzlich in MyImmo stehen.
//
// Reine Funktionen, ohne React und ohne Browser — prüfbar in `tests/bereich.test.ts`.

import { ABRECHNEN, UEBERBLICK, VERWALTEN, WEG, WERKZEUGE, type NavItem } from "@/lib/nav";

export type Bereich = "verwaltung" | "aufbau";

export type BereichInfo = {
  /** Erster Teil der Wortmarke — „My“ bzw. „Buy“, dahinter steht immer kursiv „Immo“. */
  marke: string;
  name: string;
  /** Zeile unter der Wortmarke. */
  zusatz: string;
  /** Ein Satz im Umschalter: wofür der Bereich da ist (beginnt mit dem Zusatz — im Menü
   *  steht er nicht noch einmal neben der Wortmarke, dafür ist die Leiste zu schmal). */
  beschreibung: string;
  /** Wohin der Umschalter führt. */
  start: string;
  gruppen: { titel: string; ziele: NavItem[] }[];
};

export const BEREICHE: Record<Bereich, BereichInfo> = {
  verwaltung: {
    marke: "My",
    name: "MyImmo",
    zusatz: "Verwaltung",
    beschreibung: "Verwaltung: Mieter, Buchungen, Abrechnung — läuft im Hintergrund",
    start: "/",
    gruppen: [
      { titel: "Heute verwalten", ziele: VERWALTEN },
      { titel: "Abrechnen", ziele: ABRECHNEN },
    ],
  },
  aufbau: {
    marke: "Buy",
    name: "BuyImmo",
    zusatz: "Bestandsaufbau",
    beschreibung: "Bestandsaufbau: kaufen, finanzieren, verkaufen",
    start: "/aufbau",
    gruppen: [
      { titel: "Überblick", ziele: UEBERBLICK },
      { titel: "Dein Weg zum Kauf", ziele: WEG },
      { titel: "Werkzeuge", ziele: WERKZEUGE },
    ],
  },
};

/** Reihenfolge im Umschalter. */
export const BEREICH_REIHENFOLGE: Bereich[] = ["verwaltung", "aufbau"];

/** Seiten, die zu beiden Bereichen gehören — sie behalten den Bereich, aus dem man kam. */
export const GEMEINSAME_PFADE = ["/einstellungen", "/hilfe", "/properties"];

/**
 * Gehört `pfad` zu `href`? Nur der Pfad selbst oder ein Unterpfad — `/kaufen` gehört
 * NICHT zu `/kauf`. Die Startseite `/` trifft nur sich selbst.
 */
export function pfadGehoertZu(pfad: string, href: string): boolean {
  if (href === "/") return pfad === "/";
  return pfad === href || pfad.startsWith(href + "/");
}

/**
 * Der Bereich, zu dem eine Seite fest gehört — `null` für gemeinsame Seiten.
 * Alles, was in keiner BuyImmo-Gruppe steht, ist Verwaltung (auch Unterseiten wie
 * `/termine`, die nicht in der Navigation stehen).
 */
export function eigenerBereich(pfad: string): Bereich | null {
  if (GEMEINSAME_PFADE.some((h) => pfadGehoertZu(pfad, h))) return null;
  const imAufbau = BEREICHE.aufbau.gruppen.some((g) => g.ziele.some((z) => pfadGehoertZu(pfad, z.href)));
  return imAufbau ? "aufbau" : "verwaltung";
}

/** Der offene Bereich: der eigene der Seite, sonst der, aus dem man kam. */
export function bereichFuer(pfad: string, letzter: Bereich): Bereich {
  return eigenerBereich(pfad) ?? letzter;
}
