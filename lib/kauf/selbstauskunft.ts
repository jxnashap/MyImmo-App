// Selbstauskunft / Haushaltsrechnung (§ 18 KWG) für den Finanzierungs-Assistenten.
// Reine Datenstruktur + kleine Summen-Helfer — die Machbarkeitsprüfung liegt in
// lib/kauf/machbarkeit.ts. Persistiert wird das Ganze verschlüsselt (siehe
// lib/actions/selbstauskunft.ts). KEINE Beratung, nur Aufbereitung für die Bank.

export type Beschaeftigung = "angestellt" | "selbststaendig" | "beamter" | "rentner" | "sonstiges";
export type Befristung = "unbefristet" | "befristet" | "probezeit";

export type SelbstauskunftDaten = {
  // Person
  familienstand: string;
  kinder: number;
  staatsangehoerigkeit: string;
  beschaeftigung: Beschaeftigung;
  beruf: string;
  arbeitgeber: string;
  beschaeftigtSeit: string;     // YYYY-MM
  befristung: Befristung;
  anzahlPersonen: number;       // Haushaltsgröße (für die Lebenshaltungspauschale)
  zveHaushaltJahr: number;      // zu versteuerndes Haushaltseinkommen €/Jahr (KfW 300/308-Grenze)
  // Einnahmen (€/Monat, netto)
  einkommen: number;
  einkommenPartner: number;
  mieteinnahmen: number;        // bestehende Mieteinnahmen (Bank rechnet mit Abschlag)
  kindergeld: number;
  sonstigeEinnahmen: number;
  // Ausgaben (€/Monat)
  wohnkostenAktuell: number;    // aktuelle Miete/Wohnkosten (entfällt oft nach Kauf)
  versicherungen: number;
  unterhalt: number;
  ratenKredite: number;         // laufende Kreditraten
  sonstigeAusgaben: number;
  // Vermögen (€, Eigenkapital-Quellen)
  bankguthaben: number;
  wertpapiere: number;
  bausparen: number;
  sonstigesVermoegen: number;
  // Verbindlichkeiten (€, Restschuld gesamt — nur informativ)
  summeVerbindlichkeiten: number;
};

// Fester Beispielstand fuer die oeffentliche Demo. Ohne ihn stuende dort ein
// leeres, gesperrtes Formular — der Besucher saehe die Machbarkeits-Ampel nie
// rechnen. Die Zahlen passen zur Demo-Wohnung (245.000 EUR, 720 EUR Kaltmiete):
// ein Angestelltenhaushalt mit zwei Einkommen, der sich das plausibel leisten
// kann. In der Datenbank kann das NICHT liegen, weil `selbstauskunft.daten_enc`
// App-Layer-verschluesselt ist und der Schluessel nur zur Laufzeit existiert.
export const DEMO_SELBSTAUSKUNFT: SelbstauskunftDaten = {
  familienstand: "verheiratet",
  kinder: 1,
  staatsangehoerigkeit: "deutsch",
  beschaeftigung: "angestellt",
  beruf: "Projektleiterin",
  arbeitgeber: "Muster GmbH",
  beschaeftigtSeit: "2019-04",
  befristung: "unbefristet",
  anzahlPersonen: 3,
  zveHaushaltJahr: 74000,
  einkommen: 3400,
  einkommenPartner: 2100,
  mieteinnahmen: 0,
  kindergeld: 250,
  sonstigeEinnahmen: 0,
  wohnkostenAktuell: 1150,
  versicherungen: 210,
  unterhalt: 0,
  ratenKredite: 180,
  sonstigeAusgaben: 120,
  bankguthaben: 48000,
  wertpapiere: 22000,
  bausparen: 9000,
  sonstigesVermoegen: 0,
  summeVerbindlichkeiten: 6400,
};

export const LEERE_SELBSTAUSKUNFT: SelbstauskunftDaten = {
  familienstand: "",
  kinder: 0,
  staatsangehoerigkeit: "",
  beschaeftigung: "angestellt",
  beruf: "",
  arbeitgeber: "",
  beschaeftigtSeit: "",
  befristung: "unbefristet",
  anzahlPersonen: 1,
  zveHaushaltJahr: 0,
  einkommen: 0,
  einkommenPartner: 0,
  mieteinnahmen: 0,
  kindergeld: 0,
  sonstigeEinnahmen: 0,
  wohnkostenAktuell: 0,
  versicherungen: 0,
  unterhalt: 0,
  ratenKredite: 0,
  sonstigeAusgaben: 0,
  bankguthaben: 0,
  wertpapiere: 0,
  bausparen: 0,
  sonstigesVermoegen: 0,
  summeVerbindlichkeiten: 0,
};

// Fehlende/teilweise Datensätze robust auffüllen (z. B. nach Schema-Erweiterung).
export function normalisiereSelbstauskunft(roh: Partial<SelbstauskunftDaten> | null | undefined): SelbstauskunftDaten {
  return { ...LEERE_SELBSTAUSKUNFT, ...(roh ?? {}) };
}

// Eigenkapital = Summe aller Vermögensposten.
export function eigenkapitalGesamt(d: SelbstauskunftDaten): number {
  return Math.max(0, d.bankguthaben) + Math.max(0, d.wertpapiere) + Math.max(0, d.bausparen) + Math.max(0, d.sonstigesVermoegen);
}

// Nettoeinkommen des Haushalts (ohne Mieteinnahmen — die werden in der
// Machbarkeitsprüfung gesondert mit Abschlag angesetzt).
export function haushaltsNetto(d: SelbstauskunftDaten): number {
  return Math.max(0, d.einkommen) + Math.max(0, d.einkommenPartner) + Math.max(0, d.kindergeld) + Math.max(0, d.sonstigeEinnahmen);
}
