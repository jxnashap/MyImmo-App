// Prüfregeln für Briefe mit Rechtsfolgen (Gesamtprüfung P3, 08.10.2026): Kündigung und
// Mieterhöhung. EINE Stelle für Brief-Generator (Vorschau) UND PDF-Route bzw. Archiv (Server).
//
// Was hier steht, ist Rechnen und Prüfen nach dem Wortlaut des Gesetzes (gesetze-im-internet.de,
// abgerufen 08.10.2026) — keine Rechtsberatung. Die Formulierungen der Briefe stehen auf der
// Anwaltsliste (docs/AUDIT-2026-10-07-gesamt.md, Abschnitt 10, Fragen 3–6).
// Reine Funktionen auf den ZAHLEN des ISO-Datums, ohne Ortszeit (vgl. lib/mietStatus.ts).

import { bundesFeiertage } from "@/lib/mietStatus";
import { vertragswerte, type MietkontoZeitraum } from "@/lib/mietkonto";
import { ART_MIT_MONAT, type DocArt } from "@/lib/dokumentVorlagen";

// ------------------------------------------------------------ Datum ----
const teile = (s: string) => s.slice(0, 10).split("-").map(Number) as [number, number, number];
const iso = (j: number, m: number, t: number) => new Date(Date.UTC(j, m - 1, t)).toISOString().slice(0, 10);
const wochentag = (s: string) => {
  const [j, m, t] = teile(s);
  return new Date(Date.UTC(j, m - 1, t)).getUTCDay();
};
const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** „2027-01-31“ → „31.01.2027“. */
export const deDatum = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
export const istIsoDatum = (s: string | null | undefined): s is string => !!s && ISO.test(s.slice(0, 10));

/** „2026-10“ + n Monate. */
export function ymPlusMonate(ym: string, n: number): string {
  const [j, m] = ym.split("-").map(Number);
  return iso(j, m + n, 1).slice(0, 7);
}

/** Letzter Tag des Monats („2027-01“ → „2027-01-31“). */
export const monatsende = (ym: string): string => {
  const [j, m] = ym.split("-").map(Number);
  return iso(j, m + 1, 0);
};

export const istMonatsende = (d: string): boolean => istIsoDatum(d) && monatsende(d.slice(0, 7)) === d.slice(0, 10);

/** Datum + n Monate, Tag gekappt (31.01. + 1 Monat = 28./29.02.). */
export function plusMonate(d: string, n: number): string {
  const [j, m, t] = teile(d);
  const ende = monatsende(iso(j, m + n, 1).slice(0, 7));
  const kandidat = iso(j, m + n, Math.min(t, Number(ende.slice(8, 10))));
  return kandidat;
}

/** Volle Jahre von `von` bis `bis`. */
export function volleJahre(von: string, bis: string): number {
  const [j1, m1, t1] = teile(von);
  const [j2, m2, t2] = teile(bis);
  let jahre = j2 - j1;
  if (m2 < m1 || (m2 === m1 && t2 < t1)) jahre -= 1;
  return Math.max(0, jahre);
}

// ---------------------------------------------------------- § 573c ----
/**
 * Letzter Tag, an dem eine Kündigung im Monat zugehen muss (§ 573c Abs. 1 S. 1 BGB: „spätestens am
 * dritten Werktag eines Kalendermonats“). Der Samstag zählt mit, es sei denn, der dritte Werktag
 * fiele auf ihn (BGH, Urteil vom 27.04.2005, VIII ZR 206/04) — dann der nächste Werktag.
 * Nur bundesweite Feiertage: Ein Landesfeiertag verschiebt den Tag nach HINTEN, ohne ihn liegt
 * die Rechnung also auf der sicheren Seite (früherer Stichtag).
 */
export function karenzTag(jahrMonat: string): string {
  const [j, m] = jahrMonat.split("-").map(Number);
  const feiertage = bundesFeiertage(j);
  let gezaehlt = 0;
  for (let t = 1; t <= 31; t++) {
    const d = iso(j, m, t);
    const w = wochentag(d);
    if (w === 0 || feiertage.has(d)) continue;
    gezaehlt += 1;
    if (gezaehlt < 3) continue;
    if (w !== 6) return d;
    // Dritter Werktag wäre ein Samstag → zählt nicht als letzter Tag: nächster Mo–Fr ohne Feiertag.
    for (let k = t + 1; k <= t + 7; k++) {
      const e = iso(j, m, k);
      const we = wochentag(e);
      if (we !== 0 && we !== 6 && !bundesFeiertage(Number(e.slice(0, 4))).has(e)) return e;
    }
  }
  return `${jahrMonat}-03`;
}

const zusatzMonate = (jahre: number) => (jahre >= 8 ? 6 : jahre >= 5 ? 3 : 0);

export type KuendigungsTermin = {
  /** Frühester zulässiger Beendigungstermin (Monatsende) — Dauer bis zum ZUGANG gerechnet. */
  termin: string;
  /** Späterer Termin, falls das Mietverhältnis bis zum Ende fünf bzw. acht Jahre alt wird; sonst = termin. */
  sichererTermin: string;
  /** Bis zu diesem Tag muss die Kündigung zugehen, damit der Monat des Zugangs zählt. */
  zugangBis: string;
  /** Kündigungsfrist in Monaten (3, 6 oder 9) für `termin`. */
  fristMonate: number;
  hinweis: string | null;
};

/**
 * Frühester Termin einer ordentlichen Kündigung durch den Vermieter (§ 573c Abs. 1 BGB): zum Ablauf
 * des übernächsten Monats, nach fünf und acht Jahren seit der Überlassung je drei Monate später.
 *
 * Die Dauer zählt bis zum ZUGANG der Kündigung (so u. a. Berliner Mieterverein; höchstrichterlich
 * nicht entschieden — Anwaltsfrage 3). Wird das Mietverhältnis bis zum Ende fünf bzw. acht Jahre
 * alt, nennt `sichererTermin` den späteren Termin; die Oberfläche zeigt ihn als Hinweis.
 * Ohne Mietbeginn: längste Frist (9 Monate) für beide.
 */
export function fruehesterKuendigungstermin(zugang: string, ueberlassung: string | null | undefined): KuendigungsTermin {
  const zym = zugang.slice(0, 7);
  const zugangBis = karenzTag(zym);
  const startYm = zugang.slice(0, 10) <= zugangBis ? zym : ymPlusMonate(zym, 1);
  const termin = (zusatz: number) => monatsende(ymPlusMonate(startYm, 2 + zusatz));

  if (!istIsoDatum(ueberlassung ?? null)) {
    return {
      termin: termin(6),
      sichererTermin: termin(6),
      zugangBis,
      fristMonate: 9,
      hinweis: "Ohne Mietbeginn lässt sich die Verlängerung nach fünf und acht Jahren nicht prüfen — gerechnet mit der längsten Frist (9 Monate).",
    };
  }
  const beiZugang = zusatzMonate(volleJahre(ueberlassung!, zugang));
  let sicher = beiZugang;
  // Höchstens zweimal nachziehen (3 → 6 → 9 Monate).
  for (let i = 0; i < 2; i++) {
    const z = zusatzMonate(volleJahre(ueberlassung!, termin(sicher)));
    if (z <= sicher) break;
    sicher = z;
  }
  return {
    termin: termin(beiZugang),
    sichererTermin: termin(sicher),
    zugangBis,
    fristMonate: 3 + beiZugang,
    hinweis:
      sicher > beiZugang
        ? `Bis zum Ende wird das Mietverhältnis ${sicher === 6 ? "acht" : "fünf"} Jahre alt. Üblicherweise zählt die Dauer bis zum Zugang; höchstrichterlich ist das nicht entschieden. Wer sicher gehen will, kündigt zum ${deDatum(termin(sicher))}.`
        : null,
  };
}

// ------------------------------------------------------------ § 558 ----
/** Erster Tag des dritten Kalendermonats nach dem Zugang (§ 558b Abs. 1 BGB). */
export const fruehestWirksam = (zugang: string): string => `${ymPlusMonate(zugang.slice(0, 7), 3)}-01`;

/**
 * Monat der letzten Änderung der Kaltmiete laut Miet-Zeiträumen (Paket B), sonst null. Erhöhungen
 * nach Modernisierung (§ 559) lassen sich davon nicht unterscheiden — sie zählen für § 558 nicht,
 * die Prüfung ist mit ihnen also strenger als das Gesetz.
 */
export function letzteKaltmieteAenderung(
  stand: { kaltmiete: number | null; nk_vorauszahlung: number | null; stellplatz_miete: number | null },
  zeitraeume: MietkontoZeitraum[],
  mietbeginn: string | null,
  bisYm: string,
): string | null {
  if (!istIsoDatum(mietbeginn) || zeitraeume.length === 0) return null;
  let ym = mietbeginn.slice(0, 7);
  let vorher = vertragswerte(stand, zeitraeume, ym).kaltmiete;
  let letzte: string | null = null;
  for (let i = 0; i < 600 && ym < bisYm; i++) {
    ym = ymPlusMonate(ym, 1);
    const k = vertragswerte(stand, zeitraeume, ym).kaltmiete;
    if (k !== vorher) letzte = `${ym}-01`;
    vorher = k;
  }
  return letzte;
}

/**
 * Grundlage der Prüfung aus den Mieterdaten — EINE Rechnung für Vorschau und PDF.
 * `stand` sind die Mieterfelder OHNE Zeitraum-Anpassung (vertragswerte() legt die Zeiträume darüber).
 * Kappungsgrenze: Miete drei Jahre vor dem Wirksamkeitstermin, bei jüngerem Mietverhältnis die
 * Anfangsmiete (§ 558 Abs. 3 BGB).
 */
export function mieterhoehungBasis(
  m: {
    kaltmiete: number | null;
    nk_vorauszahlung: number | null;
    stellplatz_miete?: number | null;
    mietbeginn: string | null;
    letzte_erhoehung: string | null;
  },
  zeitraeume: MietkontoZeitraum[],
  wirksamAb: string,
  heuteYm: string,
): Omit<MieterhoehungEingabe, "zugang" | "wirksamAb" | "neueMiete"> {
  const stand = { kaltmiete: m.kaltmiete, nk_vorauszahlung: m.nk_vorauszahlung, stellplatz_miete: m.stellplatz_miete ?? null };
  const alteMiete = vertragswerte(stand, zeitraeume, heuteYm).kaltmiete;
  let mieteVorDreiJahren: number | null = null;
  if (istIsoDatum(wirksamAb)) {
    let ym = ymPlusMonate(wirksamAb.slice(0, 7), -36);
    if (istIsoDatum(m.mietbeginn) && m.mietbeginn.slice(0, 7) > ym) ym = m.mietbeginn.slice(0, 7);
    mieteVorDreiJahren = vertragswerte(stand, zeitraeume, ym).kaltmiete || null;
  }
  const ausZeitraeumen = letzteKaltmieteAenderung(stand, zeitraeume, m.mietbeginn, heuteYm);
  const letzteErhoehung = [m.letzte_erhoehung, ausZeitraeumen].filter(istIsoDatum).map((d) => d.slice(0, 10)).sort().pop() ?? null;
  return { alteMiete, mieteVorDreiJahren, letzteErhoehung, mietbeginn: m.mietbeginn };
}

export type MieterhoehungEingabe = {
  zugang: string;
  wirksamAb: string;
  /** Bisherige Kaltmiete (gilt heute). */
  alteMiete: number;
  neueMiete: number;
  /** Kaltmiete drei Jahre vor dem Wirksamkeitstermin (bzw. bei Mietbeginn, falls jünger). */
  mieteVorDreiJahren: number | null;
  /** Letzte Erhöhung: Feld am Mieter oder Änderung laut Miet-Zeiträumen — die spätere. */
  letzteErhoehung: string | null;
  /** Mietbeginn: Auch ohne Erhöhung muss die Miete seit 15 Monaten unverändert sein. */
  mietbeginn?: string | null;
};

const eur = (n: number) => new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + " €";

/** Fehler (blockieren) und Warnungen (stehen dabei) für ein Mieterhöhungsverlangen nach § 558. */
export function pruefeMieterhoehung(e: MieterhoehungEingabe): { fehler: string[]; warnungen: string[] } {
  const fehler: string[] = [];
  const warnungen: string[] = [];
  if (!istIsoDatum(e.zugang) || !istIsoDatum(e.wirksamAb)) return { fehler, warnungen };

  const ab = fruehestWirksam(e.zugang);
  if (e.wirksamAb < ab) {
    fehler.push(`„Wirksam ab“ frühestens ${deDatum(ab)}: Die erhöhte Miete gilt ab Beginn des dritten Kalendermonats nach Zugang (§ 558b Abs. 1 BGB).`);
  } else if (e.wirksamAb.slice(8, 10) !== "01") {
    warnungen.push("„Wirksam ab“ ist kein Monatserster — die Erhöhung wirkt mit Beginn eines Kalendermonats (§ 558b Abs. 1 BGB).");
  }
  if (e.neueMiete > 0 && e.alteMiete > 0 && e.neueMiete <= e.alteMiete) {
    fehler.push("Die neue Kaltmiete liegt nicht über der bisherigen.");
  }
  if (istIsoDatum(e.letzteErhoehung)) {
    const jahr = plusMonate(e.letzteErhoehung, 12);
    if (e.zugang.slice(0, 10) < jahr) {
      warnungen.push(`Das Verlangen ist frühestens ein Jahr nach der letzten Erhöhung zulässig (§ 558 Abs. 1 S. 2 BGB) — Zugang ab ${deDatum(jahr)}.`);
    }
  }
  // 15 Monate unverändert — gerechnet ab der letzten Erhöhung, sonst ab Mietbeginn.
  const seit = [e.letzteErhoehung, e.mietbeginn].filter(istIsoDatum).sort().pop();
  if (seit) {
    const fuenfzehn = plusMonate(seit, 15);
    if (e.wirksamAb < fuenfzehn) {
      warnungen.push(`Die Miete muss zum Wirksamkeitstermin seit 15 Monaten unverändert sein (§ 558 Abs. 1 S. 1 BGB) — frühestens ab ${deDatum(fuenfzehn)}.`);
    }
  }
  if (e.mieteVorDreiJahren && e.mieteVorDreiJahren > 0 && e.neueMiete > 0) {
    const grenze20 = Math.round(e.mieteVorDreiJahren * 1.2 * 100) / 100;
    const grenze15 = Math.round(e.mieteVorDreiJahren * 1.15 * 100) / 100;
    if (e.neueMiete > grenze20) {
      warnungen.push(`Kappungsgrenze: Innerhalb von drei Jahren höchstens 20 % mehr (§ 558 Abs. 3 BGB) — ausgehend von ${eur(e.mieteVorDreiJahren)} also höchstens ${eur(grenze20)}.`);
    } else if (e.neueMiete > grenze15) {
      warnungen.push(`In Gemeinden mit abgesenkter Kappungsgrenze (Landesverordnung) gilt 15 % — dort höchstens ${eur(grenze15)}. Bitte prüfen, ob die Wohnung in einem solchen Gebiet liegt.`);
    }
  }
  return { fehler, warnungen };
}

// --------------------------------------------------------- Kündigung ----
export function pruefeKuendigung(e: { zugang: string; termin: string; ueberlassung: string | null }): {
  fehler: string[];
  warnungen: string[];
  fruehester: KuendigungsTermin | null;
} {
  if (!istIsoDatum(e.zugang)) return { fehler: [], warnungen: [], fruehester: null };
  const f = fruehesterKuendigungstermin(e.zugang, e.ueberlassung);
  const fehler: string[] = [];
  const warnungen: string[] = f.hinweis ? [f.hinweis] : [];
  if (istIsoDatum(e.termin)) {
    if (!istMonatsende(e.termin)) fehler.push("Kündigen lässt sich nur zum Ende eines Monats (§ 573c Abs. 1 BGB).");
    else if (e.termin.slice(0, 10) < f.termin) {
      fehler.push(`Frühestens zum ${deDatum(f.termin)} (Frist ${f.fristMonate} Monate, § 573c Abs. 1 BGB) — vorausgesetzt, der Brief geht bis zum ${deDatum(f.zugangBis)} zu.`);
    }
  }
  return { fehler, warnungen, fruehester: f };
}

// ----------------------------------------------------- Schriftform ----
/**
 * Liste der Schriftform-Arten — EINE Stelle, die Versand und E-Signatur steuert (Audit P3, A8).
 * „pflicht“: nur ausgedruckt und eigenhändig unterschrieben wirksam → Mail, Portal und eingebettete
 * Unterschrift gesperrt. „ungeklaert“: Gesetz verlangt „schriftlich“, ob ein PDF genügt, ist offen
 * (Anwaltsfragen 5 und 6) → Hinweis, nichts gesperrt.
 */
export const SCHRIFTFORM: Partial<Record<DocArt, { stufe: "pflicht" | "ungeklaert"; text: string }>> = {
  kuendigung: {
    stufe: "pflicht",
    text: "Eine Kündigung ist nur ausgedruckt und eigenhändig unterschrieben wirksam (§ 568 Abs. 1, § 126 BGB). Per Mail, im Mieterportal oder mit eingebetteter Unterschrift ist sie unwirksam (§ 125 BGB). Zustellen per Bote oder Einwurf-Einschreiben und den Zugang belegen.",
  },
  mietquittung: {
    stufe: "ungeklaert",
    text: "Die Quittung ist ein „schriftliches Empfangsbekenntnis“ (§ 368 BGB). Ob ein PDF mit eingebetteter Unterschrift genügt, ist nicht geklärt — sicher ist die ausgedruckte, eigenhändig unterschriebene Quittung.",
  },
  wohnungsgeber: {
    stufe: "ungeklaert",
    text: "Der Einzug ist „schriftlich“ zu bestätigen (§ 19 Abs. 1 BMG). Ob ein PDF mit eingebetteter Unterschrift genügt, ist nicht geklärt — sicher ist die ausgedruckte, eigenhändig unterschriebene Bestätigung.",
  },
};

/** Mail, Mieterportal und eingebettete Unterschrift gesperrt? */
export const digitalGesperrt = (art: string): boolean => SCHRIFTFORM[art as DocArt]?.stufe === "pflicht";

// --------------------------------------------- weitere Arten (P4) ----
/** Pflichtangaben der Wohnungsgeberbestätigung (§ 19 Abs. 3 BMG) als Platzhalter der Vorlage. */
export const WOHNUNGSGEBER_PFLICHT: { key: string; label: string }[] = [
  { key: "vermieter", label: "Name des Wohnungsgebers" },
  { key: "vermieteradresse", label: "Anschrift des Wohnungsgebers" },
  { key: "eigentuemer", label: "Eigentümer" },
  { key: "einzug", label: "Einzugsdatum" },
  { key: "objekt", label: "Anschrift der Wohnung" },
  { key: "personen", label: "meldepflichtige Personen" },
];

/** Die Reparatur-Vorlage deckt Erhaltung ab (§ 555a BGB), keine Modernisierung (B39). */
export const REPARATUR_HINWEIS =
  "Nur für Erhaltungsmaßnahmen (Instandhaltung und Instandsetzung, § 555a BGB). Eine Modernisierung (§ 555b BGB) ist spätestens drei Monate vorher in Textform anzukündigen — mit Art und Umfang, Beginn und Dauer und der erwarteten Mieterhöhung (§ 555c BGB). Dafür ist diese Vorlage nicht gedacht.";

// ----------------------------------------------------------- Namen ----
/** Weitere Mieter laut Vertrag (Freitext, je Zeile/Komma/Semikolon ein Name). */
export function weitereMieterListe(text: string | null | undefined): string[] {
  return (text ?? "")
    .split(/[\n;,]+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 10);
}

/** Alle Vertragspartner auf Mieterseite — Hauptmieter zuerst, ohne Doppelte. */
export function alleMieter(haupt: string, weitere: string | null | undefined): string[] {
  const liste = [haupt.trim(), ...weitereMieterListe(weitere)].filter(Boolean);
  return liste.filter((n, i) => liste.findIndex((x) => x.toLocaleLowerCase("de-DE") === n.toLocaleLowerCase("de-DE")) === i);
}

/** „Anna Weber“ · „Anna Weber und Ben Weber“ · „A, B und C“. */
export function namenAufzaehlung(namen: string[]): string {
  if (namen.length <= 1) return namen[0] ?? "";
  return `${namen.slice(0, -1).join(", ")} und ${namen[namen.length - 1]}`;
}

/** Namenszeilen fürs Adressfeld: bis drei je eine Zeile, darüber eine Aufzählung (sechs Zeilen Platz). */
export function empfaengerNamenZeilen(namen: string[]): string[] {
  if (namen.length === 0) return ["–"];
  return namen.length <= 3 ? namen : [namenAufzaehlung(namen)];
}

/** Anrede ohne Geschlechtsannahme, je Vertragspartner eine. */
export function anrede(namen: string[]): string {
  const n = namen.length ? namen : ["–"];
  return n.map((x, i) => `${i === 0 ? "Sehr" : "sehr"} geehrte/r ${x}`).join(", ") + ",";
}

/** Arten, die an ALLE Vertragspartner gehen müssen (B44; Anwaltsfrage 4). */
export const AN_ALLE_MIETER: DocArt[] = ["mieterhoehung", "kuendigung"];

export const MEHRERE_MIETER_HINWEIS =
  "Haben mehrere Personen den Mietvertrag unterschrieben, muss dieser Brief an alle gehen. Trage sie beim Mieter unter „Weitere Mieter laut Vertrag“ ein — Empfänger und Anrede nennen dann alle.";

// ---------------------------------------------------- Begründung ----
/** Bausteine für die Begründung einer Mieterhöhung (§ 558a Abs. 2 BGB) — Lücken in [eckigen Klammern]. */
export const BEGRUENDUNGSMITTEL: { key: string; label: string; text: string }[] = [
  {
    key: "mietspiegel",
    label: "Mietspiegel (§ 558a Abs. 2 Nr. 1)",
    text: "Zur Begründung beziehe ich mich auf den Mietspiegel [Gemeinde, Stand]. Die Wohnung ist dort [Feld bzw. Merkmale: Baujahr, Größe, Ausstattung, Lage] zuzuordnen; die Spanne beträgt [von – bis] € je m². Die verlangte Miete von [Betrag] € je m² liegt innerhalb dieser Spanne.",
  },
  {
    key: "vergleich",
    label: "Drei Vergleichswohnungen (§ 558a Abs. 2 Nr. 4)",
    text: "Zur Begründung benenne ich drei vergleichbare Wohnungen mit ihrer Miete je m²: 1. [Anschrift, Lage im Haus, Größe, Miete je m²]; 2. [Anschrift, Lage im Haus, Größe, Miete je m²]; 3. [Anschrift, Lage im Haus, Größe, Miete je m²].",
  },
  {
    key: "gutachten",
    label: "Sachverständigengutachten (§ 558a Abs. 2 Nr. 3)",
    text: "Zur Begründung beziehe ich mich auf das beigefügte Gutachten des öffentlich bestellten und vereidigten Sachverständigen [Name] vom [Datum].",
  },
  {
    key: "mietdatenbank",
    label: "Mietdatenbank (§ 558a Abs. 2 Nr. 2)",
    text: "Zur Begründung beziehe ich mich auf die Auskunft aus der Mietdatenbank [Name] vom [Datum]: [Ergebnis].",
  },
];

/** Offene Lücke „[…]“ in einem Text? */
export const hatLuecke = (s: string): boolean => /\[[^\]\n]{0,120}\]/.test(s);

/** Arten, bei denen die Begründung Pflicht ist (§ 558a Abs. 1, § 573 Abs. 3 BGB). */
export const BEGRUENDUNG_PFLICHT: DocArt[] = ["mieterhoehung", "kuendigung"];

// --------------------------------------------- Prüfung des Briefs ----
export type BriefPruefung = {
  /** Fehlende Angaben (Feldnamen) — blockieren das PDF. */
  fehlend: string[];
  /** Rechtliche Fehler — blockieren das PDF. */
  fehler: string[];
  /** Hinweise — stehen beim Brief, blockieren nichts. */
  warnungen: string[];
};

/**
 * EINE Prüfung für Vorschau und Server: Absender (§ 126b BGB nennt den Erklärenden; B42), Pflicht-
 * Begründung, offene Lücken, Fristen. `text` ist der Vorlagetext MIT Platzhaltern.
 */
export function pruefeBrief(p: {
  art: string;
  text: string;
  grund: string;
  vName: string;
  datum: string;
  zugang: string;
  kuendigung?: { ueberlassung: string | null };
  mieterhoehung?: Omit<MieterhoehungEingabe, "zugang" | "wirksamAb">;
  /** Zahl der Vertragspartner (Hauptmieter + weitere) — bei 1 ein Hinweis für Erhöhung/Kündigung. */
  mieterAnzahl?: number;
}): BriefPruefung {
  const fehlend: string[] = [];
  const fehler: string[] = [];
  const warnungen: string[] = [];
  const art = p.art as DocArt;

  if (!p.vName.trim()) fehlend.push("Absender (Name)");

  if (BEGRUENDUNG_PFLICHT.includes(art)) {
    if (!p.text.includes("{{grund}}")) {
      fehler.push("Deine gespeicherte Vorlage enthält den Platzhalter {{grund}} nicht — die Begründung erschiene nicht im Brief. „Zurücksetzen“ stellt den Standardtext wieder her.");
    } else if (!p.grund.trim()) {
      fehlend.push("Begründung");
    } else if (hatLuecke(p.grund)) {
      fehler.push("Die Begründung enthält noch Lücken in [eckigen Klammern].");
    }
    if (!istIsoDatum(p.zugang)) fehlend.push("Zugang beim Mieter");
  }

  // P4 (B38/C43): Eine eigene Vorlage ohne Monat lässt offen, welche Miete gemeint ist.
  if (ART_MIT_MONAT.includes(art) && !p.text.includes("{{monat}}")) {
    warnungen.push("Deine gespeicherte Vorlage nennt den Mietmonat nicht ({{monat}}) — dann bleibt offen, welche Miete gemeint ist. „Zurücksetzen“ stellt den Standardtext wieder her.");
  }
  // P4 (B41): Ohne diese Angaben ist es keine Bestätigung nach § 19 Abs. 3 BMG.
  if (art === "wohnungsgeber") {
    const fehlt = WOHNUNGSGEBER_PFLICHT.filter((x) => !p.text.includes(`{{${x.key}}}`)).map((x) => x.label);
    if (fehlt.length) {
      fehler.push(`Deine gespeicherte Vorlage enthält nicht alle Pflichtangaben nach § 19 Abs. 3 BMG (es fehlt: ${fehlt.join(", ")}). „Zurücksetzen“ stellt den Standardtext wieder her.`);
    }
  }

  if (AN_ALLE_MIETER.includes(art) && p.mieterAnzahl === 1) {
    warnungen.push(MEHRERE_MIETER_HINWEIS);
  }

  if (art === "kuendigung") {
    if (!/Textform/.test(p.text) || !/zwei Monate/.test(p.text)) {
      warnungen.push("Die Vorlage nennt Form (Textform) und Frist (zwei Monate vor der Beendigung) des Widerspruchs nicht (§ 568 Abs. 2, § 574b BGB). „Zurücksetzen“ stellt den Standardtext wieder her.");
    }
    if (istIsoDatum(p.zugang)) {
      const k = pruefeKuendigung({ zugang: p.zugang, termin: p.datum, ueberlassung: p.kuendigung?.ueberlassung ?? null });
      fehler.push(...k.fehler);
      warnungen.push(...k.warnungen);
    }
  }

  if (art === "mieterhoehung" && p.mieterhoehung && istIsoDatum(p.zugang) && istIsoDatum(p.datum)) {
    const m = pruefeMieterhoehung({ ...p.mieterhoehung, zugang: p.zugang, wirksamAb: p.datum });
    fehler.push(...m.fehler);
    warnungen.push(...m.warnungen);
  }

  return { fehlend, fehler, warnungen };
}

/** Meldung für die Schranke auf dem Server (PDF-Route, Archiv): fehlende Angaben, dann Fehler. */
export function briefAblehnung(p: BriefPruefung): string[] {
  return [...(p.fehlend.length ? [`Bitte noch ausfüllen: ${p.fehlend.join(", ")}.`] : []), ...p.fehler];
}

/** Der Brief verstößt gegen eine Prüfregel — kein PDF (Rückgabe von `erzeugeBriefPdf`). */
export type BriefAbgelehnt = { abgelehnt: string[] };
export const istAbgelehnt = (x: unknown): x is BriefAbgelehnt =>
  !!x && typeof x === "object" && Array.isArray((x as BriefAbgelehnt).abgelehnt);
