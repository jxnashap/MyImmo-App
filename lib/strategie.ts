// Strategie (BuyImmo, Umbau 06.10.2026) — Jonas: „stammbaumartig seine Kaufziele für das nächste
// Jahrzehnt vorbereiten … man kauft jetzt, man kauft in zwei Jahren mit der und der Taktik, da ich
// dadurch so und so viel Kapital mit der ersten [Immobilie] drin habe. Und diese Taktiken muss man sich
// verschieden aussuchen können.“
//
// WAS DAS IST: ein Rechner. Der Nutzer legt Kaufschritte an (Jahr, Preis, Miete, Taktik); die Rechnung
// zeigt, ob das Eigenkapital NACH SEINEN ANNAHMEN reicht, was fehlt und wie sich Bestand, Schulden und
// Erspartes über zehn Jahre entwickeln. Der „Stammbaum“: Ein Kauf, der Kapital aus einem früheren Objekt
// nimmt (Beleihung, Verkauf), hängt unter diesem Objekt.
//
// WAS DAS NICHT IST (docs/zukunft/STRATEGIE-REITER.md, Risiko 1): keine Empfehlung. Kein „du kannst
// kaufen“, keine Rangfolge der Taktiken, jede Taktik mit ihren Risiken. Ob eine Bank finanziert, hängt
// auch an Einkommen, Bonität und ihrem Beleihungswert — das prüft diese Rechnung nicht. § 34i GewO und
// die Grenze zur Anlageberatung sind anwaltlich offen; vor dem öffentlichen Start klären.
// Gegen Scheingenauigkeit (Risiko 2): zwei Szenarien, das vorsichtige daneben (Zins +1 Prozentpunkt,
// keine Wertsteigerung).
//
// Reine Funktionen — kein React, keine Datenbank. Der Plan liegt im Browser (localStorage).

import { zahlDe } from "@/lib/zahl";
import { altSatzAus, berechneRestschuld, grestSatzAus, kaufnebenkostenSatz, LAND_STANDARD, landAus, MAKLER_STANDARD_PROZENT } from "@/lib/kalk";
import { beispielZins } from "@/lib/kauf/darlehen";
import { AUSLAUF_HOCH } from "@/lib/beleihungsauslauf";

export const HORIZONT_JAHRE = 10;
export const MAX_KAEUFE = 12;
/** Wurzel des Stammbaums: heute, mit deinem Ersparten. */
export const WURZEL_ID = "heute";
/** Sammelposten für Kredite ohne Objekt im Bestand — Schulden zählen, Quelle kann er nicht sein. */
export const OHNE_OBJEKT_ID = "ohne-objekt";

export type TaktikId = "ansparen" | "nebenkosten" | "vollfinanzierung" | "beleihung" | "verkauf";

export type Taktik = {
  id: TaktikId;
  titel: string;
  /** Wie die Rechnung den Kauf finanziert. */
  rechnung: string;
  /** Was dabei schiefgehen kann — steht immer daneben. */
  risiken: string[];
  /** Braucht diese Taktik ein früheres Objekt als Quelle? */
  quelle: boolean;
  /** Fragt sie nach einem Eigenkapital-Anteil am Kaufpreis? */
  anteil: boolean;
};

/** Reihenfolge = Reihenfolge im Auswahlfeld, KEINE Rangfolge. */
export const TAKTIKEN: Taktik[] = [
  {
    id: "ansparen",
    titel: "Aus Erspartem",
    rechnung: "Nebenkosten und dein Eigenkapital-Anteil am Kaufpreis kommen aus deinem Ersparten, der Rest ist ein Darlehen.",
    risiken: ["Ansparen dauert — bis dahin können Preise und Zinsen steigen.", "Wer alles Ersparte einsetzt, hat keine Reserve für Reparaturen oder Leerstand."],
    quelle: false,
    anteil: true,
  },
  {
    id: "nebenkosten",
    titel: "Nur Nebenkosten selbst",
    rechnung: "Aus deinem Ersparten zahlst du nur die Kaufnebenkosten; der Kaufpreis wird voll finanziert.",
    risiken: ["Höheres Darlehen, höhere Rate, meist höherer Zins.", "Nicht jede Bank finanziert den vollen Kaufpreis."],
    quelle: false,
    anteil: false,
  },
  {
    id: "vollfinanzierung",
    titel: "Vollfinanzierung",
    rechnung: "Kaufpreis und Nebenkosten werden finanziert; aus dem Ersparten fließt nichts.",
    risiken: [
      "Höchstes Darlehen, höchste Rate — sinkt der Wert, sind die Schulden höher als das Objekt.",
      "Banken bieten das selten an und meist nur bei hohem Einkommen.",
    ],
    quelle: false,
    anteil: false,
  },
  {
    id: "beleihung",
    titel: "Beleihung eines Objekts",
    rechnung:
      "Das Eigenkapital kommt aus einem früheren Objekt: Ein zusätzliches Darlehen auf dessen Wert (bis zur Beleihungsgrenze, abzüglich seiner Schulden) ersetzt Erspartes. Was fehlt, kommt aus dem Ersparten.",
    risiken: [
      "Beide Objekte tragen dann Schulden — fallen Werte oder Mieten, trifft es beide.",
      "Die Bank rechnet mit ihrem Beleihungswert, der meist unter dem Marktwert liegt.",
    ],
    quelle: true,
    anteil: true,
  },
  {
    id: "verkauf",
    titel: "Verkauf eines Objekts",
    rechnung: "Ein früheres Objekt wird zu Jahresbeginn verkauft; der Erlös nach Verkaufskosten und Schulden geht ins Ersparte.",
    risiken: [
      "Verkauf innerhalb von zehn Jahren nach dem Kauf: Der Gewinn kann steuerpflichtig sein (§ 23 EStG) — mit dem Steuerberater klären.",
      "Die Miete des verkauften Objekts fällt weg.",
      "Wird ein Darlehen vor Ende der Zinsbindung abgelöst, verlangt die Bank meist eine Vorfälligkeitsentschädigung — die Rechnung zieht sie nicht ab.",
    ],
    quelle: true,
    anteil: true,
  },
];

export const taktik = (id: TaktikId): Taktik => TAKTIKEN.find((t) => t.id === id)!;
const TAKTIK_IDS = new Set<string>(TAKTIKEN.map((t) => t.id));

export type KaufSchritt = {
  id: string;
  name: string;
  jahr: string;
  kaufpreis: string;
  /** Kaltmiete je Monat (leer = selbst genutzt). */
  kaltmiete: string;
  taktik: TaktikId;
  /** Eigenkapital-Anteil am Kaufpreis in Prozent (zusätzlich zu den Nebenkosten). */
  ekAnteil: string;
  /** Beleihung/Verkauf: ein Objekt aus dem Bestand (MyImmo) oder ein FRÜHERER Kaufschritt. */
  quelle: string;
};

export type StrategieEntwurf = {
  version: 1;
  erspartes: string;
  sparrate: string;
  zins: string;
  tilgung: string;
  wertentwicklung: string;
  bewirtschaftung: string;
  beleihungsgrenze: string;
  /**
   * Bundesland für die Grunderwerbsteuer: Länderkürzel (seit 09.10.2026, B32) oder — in älteren Plänen —
   * der Satz als Maschinenwert („0.05“). Nie durch den Zahlenparser; gelesen über `grestSatzAus()`.
   */
  grest: string;
  makler: string;
  verkaufskosten: string;
  kaeufe: KaufSchritt[];
};

/**
 * Ein Objekt aus dem MyImmo-Bestand — mit Wert und den Krediten, die es belasten. Sein Mietüberschuss
 * steckt in der Sparrate, die der Nutzer einträgt (sonst zählte er doppelt).
 */
export type BestandObjekt = {
  id: string;
  name: string;
  wert: number;
  /** Jahr des Kaufs, wenn bekannt — für den Hinweis zur Zehnjahresfrist beim Verkauf. */
  kaufJahr: number | null;
  kredite: { restschuld: number; monatsrate: number; zinsProzent: number }[];
};

/**
 * Startwerte: Annahmen sichtbar und änderbar. Beispielzins wie im Kauf-Assistenten (lib/kauf/darlehen.ts,
 * Prüfzyklus „Beispiel-Sollzins“), Tilgung 2 % wie dessen „gleiche Rate“, Bewirtschaftung 20 % wie im
 * Objekt-Rechner, Beleihungsgrenze 80 % = obere Schwelle auf /kredite. Wertentwicklung 0 % — eine
 * Steigerung muss der Nutzer selbst annehmen.
 */
export function leereStrategie(erspartes = 0): StrategieEntwurf {
  return {
    version: 1,
    erspartes: erspartes > 0 ? String(Math.round(erspartes)) : "",
    sparrate: "",
    zins: String(beispielZins(15)).replace(".", ","),
    tilgung: "2",
    wertentwicklung: "0",
    bewirtschaftung: "20",
    beleihungsgrenze: String(AUSLAUF_HOCH),
    grest: LAND_STANDARD,
    makler: String(MAKLER_STANDARD_PROZENT).replace(".", ","),
    verkaufskosten: String(MAKLER_STANDARD_PROZENT).replace(".", ","),
    kaeufe: [],
  };
}

export function neuerKauf(id: string, jahr: number): KaufSchritt {
  return { id, name: "", jahr: String(jahr), kaufpreis: "", kaltmiete: "", taktik: "ansparen", ekAnteil: "10", quelle: "" };
}

// ---- Lesen ------------------------------------------------------------------------------------

/** Geld aus einem Textfeld (deutscher Tausenderpunkt erlaubt); leer/unlesbar/negativ → 0. */
export function geldAus(v: string | null | undefined): number {
  const n = v == null || v.trim() === "" ? null : zahlDe(v);
  return n != null && Number.isFinite(n) && n > 0 ? n : 0;
}

/** Prozent aus einem Textfeld (Komma oder Punkt); leer/unlesbar → 0. Zwischen -50 und 100. */
export function prozentAus(v: string | null | undefined): number {
  const roh = (v ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d*\.?\d*$/.test(roh) || !/\d/.test(roh)) return 0;
  const n = Number(roh);
  return Number.isFinite(n) ? Math.min(100, Math.max(-50, n)) : 0;
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const text = (v: unknown, max: number, ersatz = ""): string => (typeof v === "string" ? v.slice(0, max) : ersatz);

/** Gespeicherten Plan prüfen (localStorage — dort kann alles stehen). `null`, wenn es keiner ist. */
export function strategieAus(roh: unknown): StrategieEntwurf | null {
  const o = obj(roh);
  if (o.version !== 1 || !Array.isArray(o.kaeufe)) return null;
  const basis = leereStrategie();
  const kaeufe = o.kaeufe.slice(0, MAX_KAEUFE).map((x, i): KaufSchritt => {
    const k = obj(x);
    return {
      id: typeof k.id === "string" && k.id.length > 0 && k.id.length <= 64 && k.id !== WURZEL_ID ? k.id : `k${i}`,
      name: text(k.name, 60),
      jahr: text(k.jahr, 4),
      kaufpreis: text(k.kaufpreis, 16),
      kaltmiete: text(k.kaltmiete, 12),
      taktik: typeof k.taktik === "string" && TAKTIK_IDS.has(k.taktik) ? (k.taktik as TaktikId) : "ansparen",
      ekAnteil: text(k.ekAnteil, 6, "10"),
      quelle: text(k.quelle, 64),
    };
  });
  const grest = text(o.grest, 6, basis.grest);
  return {
    version: 1,
    erspartes: text(o.erspartes, 16),
    sparrate: text(o.sparrate, 12),
    zins: text(o.zins, 6, basis.zins),
    tilgung: text(o.tilgung, 6, basis.tilgung),
    wertentwicklung: text(o.wertentwicklung, 6, basis.wertentwicklung),
    bewirtschaftung: text(o.bewirtschaftung, 6, basis.bewirtschaftung),
    beleihungsgrenze: text(o.beleihungsgrenze, 6, basis.beleihungsgrenze),
    // Ein Länderkürzel oder (ältere Pläne) ein Satz zwischen 0 und 10 %.
    grest: landAus(grest) || altSatzAus(grest) != null ? grest : basis.grest,
    makler: text(o.makler, 6, basis.makler),
    verkaufskosten: text(o.verkaufskosten, 6, basis.verkaufskosten),
    kaeufe,
  };
}

// ---- Rechnen ----------------------------------------------------------------------------------

type Kredit = { rest: number; zinsPa: number; rateMo: number };
/** `startKredite`: so viele Kredite hatte ein Bestandsobjekt heute — deren Rate steckt in der Sparrate. */
type Objekt = { id: string; name: string; wert: number; kredite: Kredit[]; mieteMo: number; kaufJahr: number | null; startKredite: number };

export type Szenario = { zinsAufschlag: number; wertentwicklung: number | null };
export const SZENARIO_ANNAHMEN: Szenario = { zinsAufschlag: 0, wertentwicklung: null };
/** Vorsichtig: Zins einen Prozentpunkt höher, keine Wertsteigerung. */
export const SZENARIO_VORSICHTIG: Szenario = { zinsAufschlag: 1, wertentwicklung: 0 };

export type KaufErgebnis = {
  id: string;
  name: string;
  jahr: number;
  taktik: TaktikId;
  kaufpreis: number;
  nebenkosten: number;
  /** Eigenkapital, das der Kauf nach der Taktik braucht (Nebenkosten + Anteil). */
  ekBedarf: number;
  /** Davon über ein Darlehen auf ein früheres Objekt gedeckt (Beleihung). */
  ausBeleihung: number;
  /** Davon aus dem Ersparten. */
  ausErspartem: number;
  /** Verkaufserlös, der vor dem Kauf ins Ersparte floss (Verkauf). */
  erloes: number;
  /** Erspartes zum Kaufzeitpunkt (nach einem Verkaufserlös). */
  verfuegbar: number;
  gedeckt: boolean;
  /** Rechnerische Lücke in Euro (0, wenn gedeckt). */
  luecke: number;
  /** Warum nicht gerechnet werden konnte (fehlende Quelle, kein Preis …) — sonst null. */
  grund: string | null;
  darlehen: number;
  /** Rate aller neuen Darlehen dieses Kaufs je Monat. */
  rateMo: number;
  /** Miete nach Bewirtschaftung minus Rate, je Monat (vor Steuern). */
  ueberschussMo: number;
  /** Elternknoten im Stammbaum: `heute` (Wurzel, aus Erspartem) oder das Objekt, dessen Kapital er nutzt. */
  eltern: string;
  hinweise: string[];
};

export type JahresZeile = { jahr: number; objekte: number; wert: number; schulden: number; eigenkapital: number; erspartes: number };

export type StrategieErgebnis = { kaeufe: KaufErgebnis[]; jahre: JahresZeile[] };

const runden = (n: number) => Math.round(n);
const summe = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

/** Reihenfolge: nach Jahr, bei Gleichstand wie in der Liste. */
export function sortierteKaeufe(kaeufe: KaufSchritt[]): KaufSchritt[] {
  return kaeufe.map((k, i) => ({ k, i })).sort((a, b) => Number(a.k.jahr) - Number(b.k.jahr) || a.i - b.i).map((x) => x.k);
}

/**
 * Monate, die im Startjahr noch vor dir liegen — der laufende Monat zählt mit (Stichtag 07.10. →
 * Oktober, November, Dezember = 3). Gesamtprüfung 07.10.2026, B29: Vorher rechnete das Startjahr mit
 * zwölf vollen Monaten Sparrate, Überschuss und Tilgung — im Oktober rund 9.700 € Erspartes zu viel, und
 * der Fehler trug sich in jeden späteren Kauf fort.
 */
export function restMonateImStartjahr(startMonat: number): number {
  const m = Number.isInteger(startMonat) && startMonat >= 1 && startMonat <= 12 ? startMonat : 1;
  return 13 - m;
}

/**
 * Den Plan Jahr für Jahr durchrechnen. Ein Kauf, dessen Eigenkapital nicht reicht, findet in der
 * Rechnung NICHT statt (Lücke) — Käufe, die auf ihn bauen, finden dann ihre Quelle nicht. So sieht man,
 * was am Plan hängt.
 *
 * `startMonat` (1–12): der Monat des Stichtags. Im Startjahr zählen Sparrate, Mietüberschuss, Tilgung und
 * Wertentwicklung nur für die restlichen Monate (`restMonateImStartjahr`); ab dem Folgejahr volle Jahre.
 */
export function rechneStrategie(
  e: StrategieEntwurf,
  bestand: BestandObjekt[],
  startJahr: number,
  szenario: Szenario = SZENARIO_ANNAHMEN,
  startMonat = 1,
): StrategieErgebnis {
  const zinsPa = (prozentAus(e.zins) + szenario.zinsAufschlag) / 100;
  const tilgPa = prozentAus(e.tilgung) / 100;
  const wachstum = (szenario.wertentwicklung ?? prozentAus(e.wertentwicklung)) / 100;
  const bewirt = prozentAus(e.bewirtschaftung) / 100;
  const grenze = Math.max(0, prozentAus(e.beleihungsgrenze)) / 100;
  const nkSatz = kaufnebenkostenSatz(grestSatzAus(e.grest), Math.max(0, prozentAus(e.makler)));
  const verkaufskosten = Math.max(0, prozentAus(e.verkaufskosten)) / 100;
  const sparMo = geldAus(e.sparrate);
  const neuerKredit = (betrag: number): Kredit => ({ rest: betrag, zinsPa, rateMo: (betrag * (zinsPa + tilgPa)) / 12 });

  let erspartes = geldAus(e.erspartes);
  const objekte: Objekt[] = bestand.map((b) => ({
    id: b.id,
    name: b.name,
    wert: Math.max(0, b.wert),
    kredite: b.kredite.map((k) => ({ rest: Math.max(0, k.restschuld), zinsPa: Math.max(0, k.zinsProzent) / 100, rateMo: Math.max(0, k.monatsrate) })),
    mieteMo: 0, // Überschuss des Bestands steckt in der Sparrate, die der Nutzer einträgt
    kaufJahr: b.kaufJahr,
    startKredite: b.kredite.length,
  }));
  const schuldenVon = (o: Objekt) => summe(o.kredite.map((k) => k.rest));

  const ergebnisse: KaufErgebnis[] = [];
  const jahre: JahresZeile[] = [];
  const geplant = sortierteKaeufe(e.kaeufe);

  for (let jahr = startJahr; jahr <= startJahr + HORIZONT_JAHRE; jahr++) {
    for (const k of geplant.filter((x) => Number(x.jahr) === jahr)) {
      const t = taktik(k.taktik);
      const kp = geldAus(k.kaufpreis);
      const nk = kp * nkSatz;
      const anteil = t.anteil ? Math.max(0, prozentAus(k.ekAnteil)) / 100 : 0;
      const ekBedarf = k.taktik === "vollfinanzierung" ? 0 : nk + kp * anteil;
      const r: KaufErgebnis = {
        id: k.id, name: k.name.trim() || "Kauf", jahr, taktik: k.taktik, kaufpreis: kp, nebenkosten: nk, ekBedarf,
        ausBeleihung: 0, ausErspartem: 0, erloes: 0, verfuegbar: erspartes, gedeckt: false, luecke: 0, grund: null,
        darlehen: 0, rateMo: 0, ueberschussMo: 0, eltern: t.quelle && k.quelle ? k.quelle : WURZEL_ID, hinweise: [],
      };
      ergebnisse.push(r);
      if (kp <= 0) {
        r.grund = "Kaufpreis fehlt";
        continue;
      }
      let quelle: Objekt | undefined;
      if (t.quelle) {
        quelle = objekte.find((o) => o.id === k.quelle);
        if (!quelle) {
          r.grund = k.quelle ? "Das Objekt, aus dem das Kapital kommen soll, ist in der Rechnung nicht (mehr) da" : "Wähle das Objekt, aus dem das Kapital kommen soll";
          r.luecke = ekBedarf;
          continue;
        }
      }
      if (k.taktik === "verkauf" && quelle) {
        const erloes = quelle.wert * (1 - verkaufskosten) - schuldenVon(quelle);
        r.erloes = erloes;
        erspartes += erloes;
        r.verfuegbar = erspartes;
        objekte.splice(objekte.indexOf(quelle), 1);
        if (quelle.kaufJahr == null || jahr - quelle.kaufJahr < 10) {
          r.hinweise.push("Verkauf vor Ablauf von zehn Jahren seit dem Kauf: Ein Gewinn kann steuerpflichtig sein (§ 23 EStG).");
        }
        if (erloes < 0) r.hinweise.push("Die Schulden sind höher als der Verkaufserlös — der Verkauf kostet Erspartes.");
        // C30: Was die Rechnung beim Verkauf NICHT abbildet, steht am Kauf.
        if (schuldenVon(quelle) > 0) {
          r.hinweise.push("Eine Vorfälligkeitsentschädigung für die Ablösung der Darlehen ist nicht abgezogen.");
        }
        const ausBestand = quelle.id;
        if (bestand.some((b) => b.id === ausBestand)) {
          r.hinweise.push("Deine Sparrate bleibt in der Rechnung gleich — steckt darin der Überschuss dieses Objekts, sinkt sie nach dem Verkauf.");
        }
      }
      let ausBeleihung = 0;
      if (k.taktik === "beleihung" && quelle) {
        const spielraum = Math.max(0, quelle.wert * grenze - schuldenVon(quelle));
        ausBeleihung = Math.min(spielraum, ekBedarf);
        if (spielraum <= 0) r.hinweise.push("Das Objekt hat bei dieser Beleihungsgrenze keinen Spielraum.");
      }
      const ausErspartem = ekBedarf - ausBeleihung;
      if (ausErspartem > erspartes + 0.005) {
        r.luecke = ausErspartem - Math.max(0, erspartes);
        continue;
      }
      // Gedeckt: Kauf findet statt.
      r.gedeckt = true;
      r.ausBeleihung = ausBeleihung;
      r.ausErspartem = ausErspartem;
      erspartes -= ausErspartem;
      const darlehen = kp + nk - ekBedarf;
      r.darlehen = darlehen;
      const kredite = darlehen > 0 ? [neuerKredit(darlehen)] : [];
      if (ausBeleihung > 0 && quelle) {
        const zusatz = neuerKredit(ausBeleihung);
        quelle.kredite.push(zusatz);
        r.rateMo += zusatz.rateMo;
      }
      r.rateMo += summe(kredite.map((x) => x.rateMo));
      const miete = geldAus(k.kaltmiete);
      r.ueberschussMo = miete * (1 - bewirt) - r.rateMo;
      objekte.push({ id: k.id, name: r.name, wert: kp, kredite, mieteMo: miete, kaufJahr: jahr, startKredite: 0 });
    }

    // Jahresende: sparen, Mieten minus Raten, tilgen, Werte fortschreiben. Raten der Kredite, die es
    // heute schon gibt, stecken in der Sparrate — gezählt werden nur die neuen (Kauf und Beleihung).
    // Im Startjahr nur die restlichen Monate (B29).
    const monate = jahr === startJahr ? restMonateImStartjahr(startMonat) : 12;
    const ueberschussMo = summe(objekte.map((o) => o.mieteMo * (1 - bewirt) - summe(o.kredite.slice(o.startKredite).map((k) => k.rateMo))));
    erspartes += (sparMo + ueberschussMo) * monate;
    for (const o of objekte) {
      for (const kr of o.kredite) kr.rest = berechneRestschuld(kr.rest, kr.zinsPa, kr.rateMo, monate / 12);
      o.wert = o.wert * Math.pow(1 + wachstum, monate / 12);
    }
    const wert = summe(objekte.map((o) => o.wert));
    const schulden = summe(objekte.map(schuldenVon));
    jahre.push({
      jahr,
      objekte: objekte.filter((o) => o.id !== OHNE_OBJEKT_ID).length,
      wert: runden(wert),
      schulden: runden(schulden),
      eigenkapital: runden(wert - schulden),
      erspartes: runden(erspartes),
    });
  }
  return { kaeufe: ergebnisse, jahre };
}

/** Kinder eines Knotens im Stammbaum — Käufe, deren Kapital aus ihm kommt; nach Jahr. */
export function kinder(ergebnisse: KaufErgebnis[], eltern: string): KaufErgebnis[] {
  return ergebnisse.filter((r) => r.eltern === eltern);
}

/**
 * Welche Objekte als Quelle in Frage kommen: der Bestand und alle FRÜHEREN Kaufschritte (Jahr davor
 * oder weiter oben im selben Jahr) — ein Kauf kann nie Kapital aus sich selbst oder einem späteren ziehen.
 */
export function moeglicheQuellen(kaeufe: KaufSchritt[], k: KaufSchritt, bestand: { id: string; name: string }[]): { id: string; name: string }[] {
  const reihe = sortierteKaeufe(kaeufe);
  const pos = reihe.findIndex((x) => x.id === k.id);
  const frueher = reihe.slice(0, Math.max(0, pos)).filter((x) => Number(x.jahr) <= Number(k.jahr));
  return [
    ...bestand.filter((b) => b.id !== OHNE_OBJEKT_ID).map((b) => ({ id: b.id, name: b.name })),
    ...frueher.map((x) => ({ id: x.id, name: x.name.trim() || `Kauf ${x.jahr}` })),
  ];
}

/**
 * MyImmo-Bestand → Startobjekte der Strategie. Kredite hängen über `prop_id` am Objekt; Kredite ohne
 * Objekt kommen in einen Sammelposten (Schulden zählen, Quelle kann er nicht sein). Leere Zahlen → 0.
 */
export function bestandAus(
  objekte: { id: string; bezeichnung: string; wert: number | null; kaufdatum?: string | null }[],
  kredite: { prop_id: string | null; restschuld: number | null; monatsrate: number | null; zinssatz: number | null }[],
): BestandObjekt[] {
  const z = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const kredit = (k: (typeof kredite)[number]) => ({ restschuld: z(k.restschuld), monatsrate: z(k.monatsrate), zinsProzent: z(k.zinssatz) });
  const ids = new Set(objekte.map((o) => o.id));
  const liste: BestandObjekt[] = objekte.map((o) => {
    const jahr = typeof o.kaufdatum === "string" ? Number(o.kaufdatum.slice(0, 4)) : NaN;
    return {
      id: o.id,
      name: o.bezeichnung || "Objekt",
      wert: z(o.wert),
      kaufJahr: Number.isInteger(jahr) && jahr > 1800 ? jahr : null,
      kredite: kredite.filter((k) => k.prop_id === o.id).map(kredit),
    };
  });
  const ohne = kredite.filter((k) => !k.prop_id || !ids.has(k.prop_id));
  if (ohne.length > 0) liste.push({ id: OHNE_OBJEKT_ID, name: "Kredite ohne Objekt", wert: 0, kaufJahr: null, kredite: ohne.map(kredit) });
  return liste;
}
