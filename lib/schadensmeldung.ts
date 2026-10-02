// Geführte Schadensmeldung + Notfall (02.10.2026, Schritt 5 aus
// docs/zukunft/MIETERPORTAL-AUSBAU.md § 9).
//
// Regelbasierte Rückfragen je Schadensart statt eines leeren Textfelds — der Vermieter
// bekommt beim ersten Mal, was er sonst nachfragen müsste (Was genau? Wo? Seit wann?
// Läuft etwas aus?). Bewusst KEINE KI (Entscheidung des Betreibers: „KI im Portal
// gemerkt, nicht jetzt“). Reine Daten + reine Funktion, ohne React, prüfbar.
//
// NOTFALL: MyImmo ist kein Notdienst. Wo Gefahr besteht, steht ZUERST, was jetzt zu tun
// ist — 112 und die Sofortmaßnahme —, erst danach die Meldung an den Vermieter.
// Keine erfundenen Telefonnummern: Die Gas-Entstörung ist je Netzbetreiber verschieden.

export type NotfallArt = "allgemein" | "gas" | "wasser" | "strom";

export const NOTFALL_TEXT: Record<NotfallArt, { titel: string; schritte: string[] }> = {
  allgemein: {
    titel: "Feuer, Rauch, Verletzte oder akute Gefahr",
    schritte: ["Sofort 112 anrufen.", "Danach — wenn alle in Sicherheit sind — deinen Vermieter informieren."],
  },
  gas: {
    titel: "Gasgeruch",
    schritte: [
      "Keine Schalter, kein Licht, keine Klingel betätigen, kein offenes Feuer, kein Handy in der Wohnung.",
      "Fenster und Türen öffnen, Haus verlassen, Nachbarn warnen.",
      "Von draußen den Entstörungsdienst deines Gasnetzbetreibers anrufen (Nummer meist am Gaszähler oder auf der Gasrechnung). Bei starkem Geruch: 112.",
    ],
  },
  wasser: {
    titel: "Wasser läuft aus",
    schritte: [
      "Absperrventil schließen (unter Spüle oder WC, im Bad oder am Wasserzähler).",
      "Läuft Wasser in Steckdosen oder Lampen: Sicherung ausschalten, nichts anfassen.",
      "Nachbarn darunter informieren, dann deinen Vermieter.",
    ],
  },
  strom: {
    titel: "Verschmorter Geruch, Funken, heiße Leitung",
    schritte: [
      "Sicherung des Stromkreises ausschalten, das Gerät nicht anfassen.",
      "Bei Rauch oder Feuer: 112.",
    ],
  },
};

export type Frage = {
  key: string;
  frage: string;
  optionen: string[];
  /** Antwort, bei der sofort der Notfall-Hinweis erscheint. */
  notfallBei?: string;
  notfall?: NotfallArt;
};

export type Kategorie = {
  key: string;
  label: string;
  /** Diese Kategorie IST ein Notfall: Hinweis zuerst, Meldung erst danach. */
  notfall?: NotfallArt;
  fragen: Frage[];
};

export const KATEGORIEN: Kategorie[] = [
  { key: "gas", label: "Gasgeruch", notfall: "gas", fragen: [] },
  {
    key: "heizung", label: "Heizung / Warmwasser",
    fragen: [
      { key: "umfang", frage: "Was ist betroffen?", optionen: ["Ein Heizkörper", "Mehrere oder alle Heizkörper", "Nur das Warmwasser", "Heizung und Warmwasser"] },
      { key: "stoerung", frage: "Zeigt die Heizung/Therme eine Störung an?", optionen: ["Ja, eine Fehleranzeige", "Nein", "Weiß ich nicht"] },
    ],
  },
  {
    key: "wasser", label: "Wasser / Sanitär",
    fragen: [
      { key: "art", frage: "Was ist passiert?", optionen: ["Wasser tritt aus", "Abfluss verstopft", "Kein Wasser oder wenig Druck", "WC defekt", "Etwas anderes"] },
      { key: "laeuft", frage: "Läuft gerade Wasser aus, das du nicht stoppen kannst?", optionen: ["Ja", "Nein"], notfallBei: "Ja", notfall: "wasser" },
    ],
  },
  {
    key: "strom", label: "Strom / Elektrik",
    fragen: [
      { key: "art", frage: "Was ist passiert?", optionen: ["Sicherung fliegt raus", "Steckdose oder Schalter defekt", "Licht oder Leitung ohne Funktion", "Etwas anderes"] },
      { key: "gefahr", frage: "Riecht es verschmort, gibt es Funken oder ist etwas heiß?", optionen: ["Ja", "Nein"], notfallBei: "Ja", notfall: "strom" },
    ],
  },
  {
    key: "fenster", label: "Fenster / Türen / Schloss",
    fragen: [
      { key: "art", frage: "Was ist defekt?", optionen: ["Fenster schließt nicht", "Wohnungstür oder Schloss", "Haustür oder Klingel", "Rollladen", "Etwas anderes"] },
      { key: "abschliessen", frage: "Lässt sich die Wohnung noch abschließen?", optionen: ["Ja", "Nein"] },
    ],
  },
  {
    key: "feuchte", label: "Feuchtigkeit / Schimmel",
    fragen: [
      { key: "wo", frage: "Wo genau?", optionen: ["Außenwand", "Am Fenster", "Bad", "Decke", "Keller"] },
      { key: "groesse", frage: "Wie groß ist die Stelle?", optionen: ["Kleiner als eine Handfläche", "Bis DIN-A4", "Größer"] },
    ],
  },
  {
    key: "geraet", label: "Mitvermietetes Gerät",
    fragen: [
      { key: "welches", frage: "Welches Gerät?", optionen: ["Herd oder Backofen", "Kühlschrank", "Spülmaschine", "Dunstabzug", "Anderes Gerät"] },
    ],
  },
  { key: "sonstiges", label: "Etwas anderes", fragen: [] },
];

export const SEIT_OPTIONEN = ["Heute", "Seit ein paar Tagen", "Seit über einer Woche"] as const;

export function kategorie(key: string): Kategorie | undefined {
  return KATEGORIEN.find((k) => k.key === key);
}

/** Welcher Notfall-Hinweis gilt für diese Antworten? null = keiner. */
export function notfallFuer(k: Kategorie, antworten: Record<string, string>): NotfallArt | null {
  if (k.notfall) return k.notfall;
  for (const f of k.fragen) {
    if (f.notfallBei && antworten[f.key] === f.notfallBei) return f.notfall ?? "allgemein";
  }
  return null;
}

export const TITEL_MAX = 120;
export const BESCHREIBUNG_MAX = 2000;

/**
 * Titel und Beschreibung für das Anliegen. Nur Antworten auf die Fragen DIESER Kategorie
 * und nur erlaubte Optionen gehen hinein — die Werte kommen aus dem Browser.
 */
export function baueMeldung(
  k: Kategorie,
  antworten: Record<string, string>,
  extra: { raum?: string; seit?: string; text?: string; erreichbar?: string },
): { titel: string; beschreibung: string } {
  const gueltig = k.fragen
    .map((f) => ({ f, a: antworten[f.key] }))
    .filter(({ f, a }) => !!a && f.optionen.includes(a));
  const haupt = gueltig[0]?.a;
  const raum = extra.raum?.trim();
  const titel = [k.label, haupt && haupt !== "Etwas anderes" ? haupt : null, raum ? `(${raum})` : null]
    .filter(Boolean).join(" · ").slice(0, TITEL_MAX);

  const zeilen: string[] = [];
  for (const { f, a } of gueltig) zeilen.push(`${f.frage} ${a}`);
  if (raum) zeilen.push(`Raum / Ort: ${raum}`);
  if (extra.seit && (SEIT_OPTIONEN as readonly string[]).includes(extra.seit)) zeilen.push(`Seit wann: ${extra.seit}`);
  if (extra.erreichbar?.trim()) zeilen.push(`Erreichbar / Zugang: ${extra.erreichbar.trim()}`);
  const text = extra.text?.trim();
  if (text) zeilen.push("", text);
  return { titel, beschreibung: zeilen.join("\n").slice(0, BESCHREIBUNG_MAX) };
}
