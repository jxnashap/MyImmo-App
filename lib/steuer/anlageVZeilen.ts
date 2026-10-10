// Zeilen der amtlichen Anlage V je Steuerjahr (Gesamtprüfung 07.10.2026, B1).
//
// Vorher nannte die App feste Zeilennummern aus einem älteren Vordruck (9/13/14/21/33/37/40/46/47/
// 50/51/23-24) — seit der Neufassung zum VZ 2023 stimmte davon nur Zeile 33. Schuldzinsen standen
// auf „Zeile 37“, der § 7b-Zeile; die Abo-Buchung nannte „Zeile 46“ für Verwaltungskosten.
//
// QUELLEN (abgerufen 10.10.2026):
//  - Vordruck „Anlage V 2025“ (amtlicher Vordruck, Formularnummern 2025003102xx), Nachdruck bei Buhl:
//    https://www.buhl.de/steuer/wp-content/uploads/sites/31/2026/02/Anlage_V_2025.pdf —
//    Zeilen und Kennzahlen wörtlich aus dem Vordruck gelesen (Text mit Position ausgewertet).
//  - „Anleitung zur Anlage V“ 2024 (amtliche Anleitung), Beispiel: AfA „Zeilen 33 und 35“, umgelegte
//    Kosten „Zeilen 73 und 75“, Kontoführung „Zeilen 76 und 78“, Summe „Zeile 83“, Überschuss
//    „Zeile 85“; Abschnitte „Zeile 46 bis 48 Schuldzinsen“, „Zeile 55 bis 72“ Erhaltung, „Zeile 80 bis 82
//    Sonstige Kosten“, „Zeile 20 bis 24“ Umlagen — http://www.steuerhexe.de/wp-content/uploads/2025/05/Anlage-V-2024-Anleitung.pdf
//  Beide Jahrgänge haben dieselbe Zeilenbelegung.
//
// REGEL: Ein Jahr, das hier nicht steht, bekommt KEINE Zeilennummern — die Oberfläche überträgt dann
// nach Bezeichnung. Neues Jahr erst eintragen, wenn der Vordruck veröffentlicht ist (meist Jan./Feb.
// des Folgejahres), aus dem Vordruck selbst lesen und hier mit Quelle festhalten. Prüftermin:
// `docs/app-entwicklung/07 Volatile Kennzahlen und Pruefzyklus.md`.

export type AnlageVFeld =
  | "miete"
  | "umlagenLaufend"
  | "umlagenAbrechnung"
  | "sonstigeEinnahmen"
  | "summeEinnahmen"
  | "afa"
  | "schuldzinsen"
  | "erhaltung"
  | "umgelegt"
  | "nichtUmgelegt"
  | "sonstigeKosten"
  | "summeWerbungskosten"
  | "ueberschuss";

export type AnlageVZeile = { zeile: string; kz?: string };

export type AnlageVZeilentabelle = {
  /** Kurzbeleg für die Oberfläche („Vordruck Anlage V 2025“). */
  vordruck: string;
  felder: Record<AnlageVFeld, AnlageVZeile>;
};

/** Zeilenbelegung seit der Neufassung (VZ 2024 und 2025 gleich, siehe Quellen oben). */
const BELEGUNG_2024_2025: Record<AnlageVFeld, AnlageVZeile> = {
  miete: { zeile: "13–15", kz: "01" },
  umlagenLaufend: { zeile: "20", kz: "04" },
  umlagenAbrechnung: { zeile: "21", kz: "11" },
  sonstigeEinnahmen: { zeile: "25–31" },
  summeEinnahmen: { zeile: "32" },
  afa: { zeile: "33–35", kz: "30" },
  schuldzinsen: { zeile: "46–48", kz: "33" },
  erhaltung: { zeile: "55–56", kz: "36" },
  umgelegt: { zeile: "73–75", kz: "52" },
  nichtUmgelegt: { zeile: "76–78", kz: "48" },
  sonstigeKosten: { zeile: "80–82", kz: "49" },
  summeWerbungskosten: { zeile: "83" },
  ueberschuss: { zeile: "85" },
};

export const ANLAGE_V_ZEILEN: Record<number, AnlageVZeilentabelle> = {
  2024: { vordruck: "Vordruck Anlage V 2024", felder: BELEGUNG_2024_2025 },
  2025: { vordruck: "Vordruck Anlage V 2025", felder: BELEGUNG_2024_2025 },
};

/** Zeilentabelle des Steuerjahres — null, wenn der Vordruck (noch) nicht geprüft ist. */
export function anlageVZeilen(jahr: number): AnlageVZeilentabelle | null {
  return ANLAGE_V_ZEILEN[jahr] ?? null;
}

/** „Z. 46–48“ für ein Feld, oder null ohne geprüften Vordruck. */
export function zeileVon(jahr: number, feld: AnlageVFeld): string | null {
  const t = anlageVZeilen(jahr);
  return t ? `Z. ${t.felder[feld].zeile}` : null;
}

/** Ein Satz für die Oberfläche, wenn es für das Jahr keine geprüften Zeilen gibt. */
export function ohneZeilenHinweis(jahr: number): string {
  return `Für ${jahr} sind die Zeilennummern des Vordrucks noch nicht geprüft — bitte nach der Bezeichnung übertragen.`;
}
