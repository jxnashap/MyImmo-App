// Gemeinsame Termin-Konstanten & Helfer (Kategorien, Wiederkehrung, Vorlagen).

export const TERMIN_KATEGORIEN = [
  "Miete", "Finanzierung", "Steuer", "Wartung", "WEG", "Versicherung", "Sonstiges",
] as const;
export type TerminKategorie = (typeof TERMIN_KATEGORIEN)[number];

// Wiederkehrungs-Intervalle (inkl. 2/3/4 Jahre für gesetzliche Prüfzyklen).
export const WIEDERKEHRUNGEN = [
  "monatlich", "quartalsweise", "halbjaehrlich", "jaehrlich", "alle_2_jahre", "alle_3_jahre", "alle_4_jahre",
] as const;

export const WIEDERKEHRUNG_LABEL: Record<string, string> = {
  monatlich: "monatlich",
  quartalsweise: "quartalsweise",
  halbjaehrlich: "halbjährlich",
  jaehrlich: "jährlich",
  alle_2_jahre: "alle 2 Jahre",
  alle_3_jahre: "alle 3 Jahre",
  alle_4_jahre: "alle 4 Jahre",
};

const WIEDERKEHRUNG_MONATE: Record<string, number> = {
  monatlich: 1,
  quartalsweise: 3,
  halbjaehrlich: 6,
  jaehrlich: 12,
  alle_2_jahre: 24,
  alle_3_jahre: 36,
  alle_4_jahre: 48,
};

// Nächste Fälligkeit — ohne Tag-Rollover (31.01. +1 Mon. → 28./29.02.).
// ZEITZONEN-FREI GERECHNET (08.09.2026 umgestellt). Die frühere Fassung
// mischte `new Date("2026-03-15")` (UTC-Mitternacht) mit `getDate()`/`setDate()`
// (Ortszeit) und `toISOString()` (wieder UTC). Ergebnis, gemessen:
//   · TZ=Europe/Berlin: 15.03. + 1 Monat → **14.04.** (Sommerzeit-Umstellung)
//   · TZ=America/New_York: 31.01. + 1 Monat → **01.03.** (statt 28.02.)
// Auf Vercel läuft alles in UTC, produktiv war das Ergebnis also richtig — die
// Rechnung hing aber an einer Umgebungseinstellung, die niemand hier verwaltet.
// Jetzt reine Kalenderarithmetik auf den Zahlen: kein `Date`-Objekt für die
// Verschiebung, nur eines für „wie viele Tage hat dieser Monat" (in UTC).
export function naechsteFaelligkeit(datum: string, wiederkehrung: string): string | null {
  const monate = WIEDERKEHRUNG_MONATE[wiederkehrung] ?? 0;
  if (!monate) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datum);
  if (!m) return null;
  const jahr = Number(m[1]);
  const monat = Number(m[2]);
  const tag = Number(m[3]);
  if (monat < 1 || monat > 12 || tag < 1 || tag > 31) return null;

  const verschoben = jahr * 12 + (monat - 1) + monate;
  const zielJahr = Math.floor(verschoben / 12);
  const zielMonat = (verschoben % 12) + 1;
  // Tag 0 des Folgemonats = letzter Tag des Zielmonats. Über `Date.UTC`
  // gebildet, damit die Ortszeit keine Rolle spielt.
  const letzterTag = new Date(Date.UTC(zielJahr, zielMonat, 0)).getUTCDate();
  const zielTag = Math.min(tag, letzterTag);
  const zwei = (n: number) => String(n).padStart(2, "0");
  return `${zielJahr}-${zwei(zielMonat)}-${zwei(zielTag)}`;
}

// Kategorie-Chips: Farbe (Badge-Klasse bzw. Punkt-Farbe) + Icon.
export const KATEGORIE_STIL: Record<string, { badge: string; punkt: string; icon: string }> = {
  Miete: { badge: "badge-teal", punkt: "var(--teal)", icon: "🏠" },
  Betriebskosten: { badge: "badge-teal", punkt: "var(--teal)", icon: "🧾" },
  Finanzierung: { badge: "badge-gold", punkt: "var(--gold)", icon: "🏦" },
  Steuer: { badge: "badge-neutral", punkt: "var(--muted)", icon: "📋" },
  Wartung: { badge: "badge-amber", punkt: "var(--amber)", icon: "🔧" },
  WEG: { badge: "badge-green", punkt: "var(--green)", icon: "🏢" },
  Versicherung: { badge: "badge-muted", punkt: "var(--muted)", icon: "🛡️" },
  Sonstiges: { badge: "badge-neutral", punkt: "var(--faint)", icon: "📌" },
};

// Prüfpflichten-Katalog: Ein Klick → wiederkehrender Termin mit Kategorie +
// Intervall. `relevanz` sagt, WANN die Pflicht das Objekt überhaupt trifft
// (wird in der UI als Hinweis gezeigt — keine Rechtsberatung). Die häufigsten
// Pflichten für Wohnimmobilien zuerst, Spezialfälle (kern: false) dahinter.
export type PruefVorlage = {
  titel: string;
  wiederkehrung: (typeof WIEDERKEHRUNGEN)[number];
  kategorie: TerminKategorie;
  notiz: string;      // Rechtsgrundlage/Quelle — landet in der Termin-Notiz
  relevanz?: string;  // "trifft zu wenn …" (UI-Hinweis)
  kern?: boolean;     // Standardfall Wohnimmobilie → prominent anzeigen
};

export const PRUEF_KATALOG: PruefVorlage[] = [
  // ---- Kern: trifft die meisten vermieteten Wohnobjekte ----
  { kern: true, titel: "Heizungswartung", wiederkehrung: "jaehrlich", kategorie: "Wartung", notiz: "Jährliche Wartung (Herstellervorgabe/Gewährleistung; Betriebssicherheit)" },
  { kern: true, titel: "Rauchwarnmelder-Prüfung", wiederkehrung: "jaehrlich", kategorie: "Wartung", notiz: "Jährliche Funktionsprüfung — DIN 14676 (Dokumentation aufbewahren: Haftung im Brandfall)" },
  { kern: true, titel: "Feuerstättenschau / Schornsteinfeger", wiederkehrung: "jaehrlich", kategorie: "Wartung", notiz: "Kehr- und Messtermine nach KÜO/1. BImSchV — mit Bezirksschornsteinfeger abstimmen" },
  { kern: true, titel: "Zählerablesung (Jahresende)", wiederkehrung: "jaehrlich", kategorie: "Wartung", notiz: "Jahresablesung Strom/Gas/Wasser — Basis der NK-Abrechnung (§ 556 BGB)" },
  { kern: true, titel: "Winterdienst organisieren (Saisonstart)", wiederkehrung: "jaehrlich", kategorie: "Wartung", notiz: "Verkehrssicherungspflicht: Räum-/Streupflicht. Auch bei Übertragung auf Mieter/Dienstleister bleibt die Kontrollpflicht beim Eigentümer" },
  { kern: true, titel: "Legionellenprüfung", wiederkehrung: "alle_3_jahre", kategorie: "Wartung", notiz: "§ 14b TrinkwV: alle 3 Jahre; Ergebnis den Mietern mitteilen, 10 Jahre aufbewahren", relevanz: "nur bei zentraler Warmwasserbereitung (Großanlage: Speicher > 400 l oder > 3 l Leitungsinhalt) — Ein-/Zweifamilienhäuser i. d. R. nicht betroffen" },
  // ---- Nach Ausstattung ----
  { titel: "Aufzugsprüfung (ZÜS)", wiederkehrung: "jaehrlich", kategorie: "Wartung", notiz: "§ 16 BetrSichV: Haupt- und Zwischenprüfung im jährlichen Wechsel durch ZÜS (z. B. TÜV); Notrufsystem prüfen", relevanz: "nur bei Aufzug" },
  { titel: "Feuerlöscher-Prüfung", wiederkehrung: "alle_2_jahre", kategorie: "Wartung", notiz: "DIN 14406-4: Prüfung durch Sachkundigen alle 2 Jahre", relevanz: "wenn Feuerlöscher vorhanden (Gemeinschaftsflächen/Tiefgarage)" },
  { titel: "Baumkontrolle", wiederkehrung: "jaehrlich", kategorie: "Wartung", notiz: "Verkehrssicherungspflicht (FLL-Baumkontrollrichtlinie): Sichtkontrolle, dokumentiert", relevanz: "wenn Bäume auf dem Grundstück" },
  { titel: "Garagentor / kraftbetätigte Tore", wiederkehrung: "jaehrlich", kategorie: "Wartung", notiz: "Jährliche Prüfung durch Sachkundigen — ASR A1.7/BetrSichV", relevanz: "wenn kraftbetätigte Tore vorhanden" },
  { titel: "Rückstauklappen-Kontrolle", wiederkehrung: "halbjaehrlich", kategorie: "Wartung", notiz: "DIN 1986-100/EN 13564: halbjährliche Funktionskontrolle", relevanz: "wenn Rückstausicherung verbaut (Keller/Souterrain)" },
  { titel: "Spielplatz-Hauptinspektion", wiederkehrung: "jaehrlich", kategorie: "Wartung", notiz: "DIN EN 1176: jährliche Hauptinspektion (+ regelmäßige Sichtkontrollen)", relevanz: "wenn Spielplatz/Spielgeräte vorhanden" },
  { titel: "Elektro-Prüfung ortsfeste Anlagen (DGUV V3)", wiederkehrung: "alle_4_jahre", kategorie: "Wartung", notiz: "DGUV Vorschrift 3 / DIN VDE 0105: ortsfeste elektrische Anlagen ca. alle 4 Jahre", relevanz: "v. a. bei Gemeinschaftsanlagen/Gewerbeeinheiten" },
  { titel: "Lüftungsanlage Hygieneinspektion", wiederkehrung: "alle_2_jahre", kategorie: "Wartung", notiz: "VDI 6022: Hygieneinspektion raumlufttechnischer Anlagen (2–3 Jahre)", relevanz: "nur bei zentraler Lüftungs-/RLT-Anlage" },
  { titel: "Eigentümerversammlung", wiederkehrung: "jaehrlich", kategorie: "WEG", notiz: "Jährliche Versammlung — § 24 WEG", relevanz: "nur bei Eigentumswohnung (WEG)" },
];

// Rückwärtskompatibler Alias (bisheriger Name).
export const WARTUNGS_VORLAGEN = PRUEF_KATALOG;

/**
 * Stabiler Schluessel einer ABGELEITETEN Frist (Termine-Seite).
 *
 * Abgeleitete Fristen werden aus den Stammdaten gerechnet und haben keine
 * eigene Zeile in `termine`. Um sie ausblenden zu koennen, brauchen sie eine
 * Kennung — sie steckt in `frist_ausgeblendet.schluessel`.
 *
 * Das Datum ist bewusst Teil des Schluessels: Eine wiederkehrende Frist (etwa
 * die Nebenkostenabrechnung) soll im FOLGEJAHR wieder auftauchen und nicht
 * dauerhaft stumm bleiben, nur weil sie einmal ausgeblendet wurde.
 */
export function fristSchluessel(quelle: string, datum: string, label: string): string {
  return `${quelle}|${datum}|${label}`;
}
