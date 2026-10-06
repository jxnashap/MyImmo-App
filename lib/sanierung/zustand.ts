// Zustand-Baukasten des Sanierungs-Guides (Entscheidung Jonas, 05.10.2026): Der Nutzer wählt je
// Gewerk einen Zustand anhand von Anzeichen, die man bei der Besichtigung SIEHT; der Zustand kreuzt
// Arbeiten vor, der Nutzer kann an- und abwählen. Keine Diagnose — die macht der Fachbetrieb.
//
// Die Stufen folgen der Idee des amtlichen Modernisierungs-Rasters (ImmoWertV, Anlage 2: Bad,
// Leitungen, Heizung, Innenausbau, Fenster je „nicht“ bis „umfassend modernisiert“) — ohne Euro.
//
// Eigentumswohnung: Teile, die für Bestand oder Sicherheit des Gebäudes nötig sind, und
// gemeinschaftliche Anlagen sind kein Sondereigentum (§ 5 Abs. 2 WEG); Außenfenster sind nach BGH
// zwingend Gemeinschaftseigentum. Solche Arbeiten rechnet der Guide bei einer ETW nicht als Kosten
// des Käufers, sondern zeigt sie als Prüfpunkt der Gemeinschaft (Protokolle, Erhaltungsrücklage,
// Sonderumlage). Kein Rechtsrat: Die Teilungserklärung kann Kosten anders verteilen.

import { ARBEITEN, type ArbeitId, type Gewerk } from "@/lib/sanierung/arbeiten";

export type Zustand = "gut" | "mittel" | "schlecht";
export const ZUSTAENDE: Zustand[] = ["gut", "mittel", "schlecht"];
/** „Weiß ich nicht“ → mittlerer Zustand als Annahme (im Ergebnis als Annahme markiert). */
export const ZUSTAND_ANNAHME: Zustand = "mittel";

export type ZustandGewerk = {
  gewerk: Gewerk;
  titel: string;
  /** Was man bei der Besichtigung prüfen kann — als Fragen formuliert. */
  anzeichen: string[];
  /** Kurzbeschreibung je Stufe, damit der Nutzer einordnen kann. */
  stufen: Record<Zustand, string>;
  vorauswahl: Record<Zustand, ArbeitId[]>;
  /** Bei Eigentumswohnung Sache der Gemeinschaft (nicht als eigene Kosten rechnen). */
  gemeinschaftBeiEtw: boolean;
  /** Hinweis für die Eigentumswohnung, wenn es „kommt darauf an“. */
  etwHinweis?: string;
};

export const ZUSTAND_GEWERKE: ZustandGewerk[] = [
  {
    gewerk: "elektrik",
    titel: "Elektrik",
    anzeichen: [
      "Im Sicherungskasten: Schraubsicherungen (Porzellan) oder Sicherungsautomaten (Kippschalter)?",
      "Gibt es einen FI-Schutzschalter (Schalter mit Prüftaste „T“)?",
      "Haben die Steckdosen Schutzkontakte (Metallbügel oben und unten)?",
      "Wenige Steckdosen, überall Mehrfachstecker?",
    ],
    stufen: {
      gut: "Automaten und FI vorhanden, Steckdosen mit Schutzkontakt",
      mittel: "Automaten, aber kein FI; Schalter und Steckdosen alt",
      schlecht: "Schraubsicherungen, Steckdosen ohne Schutzkontakt, zu wenige Steckdosen",
    },
    vorauswahl: {
      gut: [],
      mittel: ["fi_nachruesten", "schalter_steckdose_tauschen", "e_check"],
      // Nur „komplett“: Die Quelle zählt den neuen Sicherungskasten dazu („Neuer Sicherungskasten, neue
      // Leitungen in allen Räumen, neue Steckdosen und Schalter“) — die Unterverteilung extra wäre doppelt.
      schlecht: ["elektrik_komplett"],
    },
    gemeinschaftBeiEtw: false,
    etwHinweis: "Leitungen in der Wohnung sind meist Sondereigentum; Steigleitung und Hausanschluss gehören der Gemeinschaft.",
  },
  {
    gewerk: "bad",
    titel: "Bad",
    anzeichen: [
      "Fliesen gerissen, hohl klingend oder lose?",
      "Schimmel in den Fugen, Wasserflecken an der Decke darunter?",
      "Kommt beim ersten Aufdrehen braunes Wasser (alte verzinkte Leitungen)?",
      "WC, Waschtisch und Wanne sehr alt oder beschädigt?",
    ],
    stufen: {
      gut: "Fliesen und Objekte in Ordnung",
      mittel: "Fliesen in Ordnung, WC/Waschtisch alt",
      schlecht: "Fliesen beschädigt, Leitungen alt — Bad komplett",
    },
    vorauswahl: {
      gut: [],
      mittel: ["wc_tauschen", "waschtisch_tauschen"],
      schlecht: ["bad_komplett"],
    },
    gemeinschaftBeiEtw: false,
    etwHinweis: "Fallrohre und Leitungen bis zum Abzweig in die Wohnung gehören meist der Gemeinschaft.",
  },
  {
    gewerk: "heizung",
    titel: "Heizung",
    anzeichen: [
      "Heizkörper rostig, undicht oder werden nicht gleichmäßig warm?",
      "Fehlen Thermostatköpfe oder lassen sie sich nicht drehen?",
      "Eigene Etagenheizung: Wie alt ist das Gerät (Typenschild)?",
    ],
    stufen: {
      gut: "Heizkörper und Thermostate in Ordnung",
      mittel: "Einzelne Heizkörper tauschen",
      schlecht: "Heizkörper tauschen, Heizung erneuern",
    },
    vorauswahl: {
      gut: [],
      mittel: ["heizkoerper_tauschen"],
      schlecht: ["heizkoerper_tauschen"],
    },
    gemeinschaftBeiEtw: false,
    etwHinweis: "Bei einer Zentralheizung sind Heizkörper oft Gemeinschaftseigentum — Teilungserklärung ansehen.",
  },
  {
    gewerk: "fenster",
    titel: "Fenster",
    anzeichen: ["Einfachverglasung?", "Rahmen verzogen, Fenster schließen schlecht, es zieht?"],
    stufen: {
      gut: "Fenster dicht und gängig",
      mittel: "Beschläge und Dichtungen erneuern",
      schlecht: "Fenster tauschen",
    },
    vorauswahl: { gut: [], mittel: [], schlecht: ["fenster_tauschen"] },
    gemeinschaftBeiEtw: true,
    etwHinweis: "Außenfenster sind Gemeinschaftseigentum — nicht selbst tauschen; in Protokollen und Rücklage nach geplanten Arbeiten und Sonderumlagen sehen.",
  },
  {
    gewerk: "tueren",
    titel: "Innentüren",
    anzeichen: ["Türblätter beschädigt, Zargen schief, Türen schleifen?"],
    stufen: {
      gut: "Türen in Ordnung",
      mittel: "Türen lackieren (Eigenleistung)",
      schlecht: "Türen mit Zarge erneuern",
    },
    vorauswahl: { gut: [], mittel: [], schlecht: ["innentuer_komplett"] },
    gemeinschaftBeiEtw: false,
  },
  {
    gewerk: "kueche",
    titel: "Küche",
    anzeichen: ["Gibt es eine Küche, die bleibt?", "Fronten, Arbeitsplatte und Geräte noch brauchbar?"],
    stufen: {
      gut: "Küche bleibt",
      mittel: "Küche bleibt, Fronten/Arbeitsplatte selbst erneuern",
      schlecht: "Neue Küche",
    },
    vorauswahl: { gut: [], mittel: [], schlecht: ["kueche_moebel", "kueche_montage"] },
    gemeinschaftBeiEtw: false,
  },
];

/**
 * Vorgekreuzte Arbeiten für einen Zustand. Bei einer Eigentumswohnung fallen Gewerke weg, die der
 * Gemeinschaft gehören — sie erscheinen stattdessen als Prüfpunkt (`gemeinschaftsPruefpunkte`).
 */
export function vorauswahl(gewerk: Gewerk, zustand: Zustand | null, etw: boolean): ArbeitId[] {
  const g = ZUSTAND_GEWERKE.find((x) => x.gewerk === gewerk);
  if (!g) return [];
  if (etw && g.gemeinschaftBeiEtw) return [];
  return [...g.vorauswahl[zustand ?? ZUSTAND_ANNAHME]];
}

/** Gewerke, die bei einer Eigentumswohnung Prüfpunkt der Gemeinschaft sind (mit Hinweistext). */
export function gemeinschaftsPruefpunkte(etw: boolean): { gewerk: Gewerk; titel: string; hinweis: string }[] {
  if (!etw) return [];
  return ZUSTAND_GEWERKE.filter((g) => g.gemeinschaftBeiEtw).map((g) => ({ gewerk: g.gewerk, titel: g.titel, hinweis: g.etwHinweis ?? "" }));
}

/** Alle Arbeiten, die ein Gewerk anbieten kann (für das Ankreuzen), in Katalog-Reihenfolge. */
export function arbeitenDesGewerks(gewerk: Gewerk): ArbeitId[] {
  return (Object.keys(ARBEITEN) as ArbeitId[]).filter((id) => ARBEITEN[id].gewerk === gewerk);
}
