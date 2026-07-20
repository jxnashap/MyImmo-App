// Interaktiver Fördercheck: Programme nach Nutzung (vermieten/eigennutzen),
// Vorhaben und Bundesland filtern. Stand 2026 — Konditionen ändern sich oft,
// deshalb überall "vor Antrag prüfen". Wichtig: Förderanträge müssen i. d. R.
// VOR Vorhabensbeginn gestellt werden.

export type Nutzung = "vermieten" | "eigennutzen";
export type Vorhaben = "kauf_bestand" | "neubau" | "sanierung" | "heizung";

export type Programm = {
  key: string;
  name: string;
  traeger: "KfW" | "BAFA" | "Steuer";
  art: "kredit" | "zuschuss" | "steuer";
  fuer: Nutzung[];              // wer darf es nutzen
  vorhaben: Vorhaben[];         // wofür es gilt
  text: string;                 // ein Satz, was drin ist
  hinweis?: string;             // Einschränkung/Bedingung
  url: string;
};

export const PROGRAMME: Programm[] = [
  {
    key: "kfw297",
    name: "KfW 297/298 – Klimafreundlicher Neubau",
    traeger: "KfW", art: "kredit",
    fuer: ["vermieten", "eigennutzen"], vorhaben: ["neubau"],
    text: "Zinsgünstiger Kredit für Neubau/Ersterwerb auf Effizienzhaus-40-Niveau (298 für Vermieter/Investoren).",
    hinweis: "Nachhaltigkeitsanforderungen (QNG teils nötig); Antrag vor Kaufvertrag/Baubeginn.",
    url: "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Neubau/",
  },
  {
    key: "kfw261",
    name: "KfW 261 – Wohngebäude: Sanierung zum Effizienzhaus",
    traeger: "KfW", art: "kredit",
    fuer: ["vermieten", "eigennutzen"], vorhaben: ["sanierung", "kauf_bestand"],
    text: "Kredit mit Tilgungszuschuss für die Komplettsanierung zum Effizienzhaus — auch beim Kauf frisch sanierten Bestands.",
    hinweis: "Energieeffizienz-Experte (dena-Liste) ist Pflicht.",
    url: "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestandsimmobilie/",
  },
  {
    key: "kfw458",
    name: "KfW 458 – Heizungsförderung (Zuschuss)",
    traeger: "KfW", art: "zuschuss",
    fuer: ["vermieten", "eigennutzen"], vorhaben: ["heizung", "sanierung"],
    text: "Zuschuss für den Tausch auf Wärmepumpe & Co. — Basis 30 %, mit Boni bis 70 % (Selbstnutzer).",
    hinweis: "Vermieter erhalten nur die Grundförderung (~30–35 %), keine Einkommens-/Speed-Boni.",
    url: "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestandsimmobilie/Heizungsf%C3%B6rderung/",
  },
  {
    key: "bafa",
    name: "BAFA BEG EM – Einzelmaßnahmen (Dämmung, Fenster, Anlagentechnik)",
    traeger: "BAFA", art: "zuschuss",
    fuer: ["vermieten", "eigennutzen"], vorhaben: ["sanierung"],
    text: "Zuschuss (i. d. R. 15–20 %) für Gebäudehülle und Anlagentechnik außer Heizung.",
    hinweis: "Antrag vor Beauftragung; Energieeffizienz-Experte nötig; iSFP-Bonus möglich.",
    url: "https://www.bafa.de/DE/Energie/Effiziente_Gebaeude/effiziente_gebaeude_node.html",
  },
  {
    key: "kfw124",
    name: "KfW 124 – Wohneigentumsprogramm",
    traeger: "KfW", art: "kredit",
    fuer: ["eigennutzen"], vorhaben: ["kauf_bestand", "neubau"],
    text: "Bis 100.000 € günstiger Kredit für selbstgenutztes Wohneigentum — ohne Einkommensgrenze.",
    url: "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestandsimmobilie/F%C3%B6rderprodukte/Wohneigentumsprogramm-(124)/",
  },
  {
    key: "kfw300",
    name: "KfW 300 – Wohneigentum für Familien (Neubau)",
    traeger: "KfW", art: "kredit",
    fuer: ["eigennutzen"], vorhaben: ["neubau"],
    text: "Stark zinsverbilligter Kredit für Familien mit Kind beim klimafreundlichen Neubau/Ersterwerb.",
    hinweis: "Einkommensgrenze (90.000 € zvE + Staffel je Kind); mind. 1 Kind unter 18 im Haushalt.",
    url: "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Neubau/F%C3%B6rderprodukte/Wohneigentum-f%C3%BCr-Familien-(300)/",
  },
  {
    key: "kfw308",
    name: "KfW 308 – Jung kauft Alt (Bestandskauf + Sanierung)",
    traeger: "KfW", art: "kredit",
    fuer: ["eigennutzen"], vorhaben: ["kauf_bestand"],
    text: "Günstiger Kredit für Familien, die sanierungsbedürftigen Bestand kaufen (schlechte Effizienzklasse) und binnen 4,5 J. sanieren.",
    // Quelle (geprüft 20.07.2026): kfw.de – Wohneigentum für Familien – Bestandserwerb (308).
    // Sanierungsziel ist Effizienzhaus 85 EE (nicht 70); ab 03.08.2026 alternativ über
    // energetische Einzelmaßnahmen erfüllbar, Förderhöchstbeträge angehoben.
    hinweis: "Einkommensgrenze wie KfW 300 (90.000 € zvE + 10.000 € je weiterem Kind); Sanierungspflicht auf EH 85 EE (ab 03.08.2026 auch per Einzelmaßnahmen).",
    url: "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestandsimmobilie/F%C3%B6rderprodukte/Jung-kauft-Alt-(308)/",
  },
  {
    key: "kfw159",
    name: "KfW 159 – Altersgerecht Umbauen / Einbruchschutz",
    traeger: "KfW", art: "kredit",
    fuer: ["vermieten", "eigennutzen"], vorhaben: ["sanierung"],
    text: "Bis 50.000 € Kredit für Barrierereduzierung (Bad, Aufzug, Zugänge) — unabhängig vom Alter.",
    url: "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestandsimmobilie/F%C3%B6rderprodukte/Altersgerecht-Umbauen-(159)/",
  },
  {
    key: "steuer35c",
    name: "§ 35c EStG – Steuerbonus energetische Sanierung",
    traeger: "Steuer", art: "steuer",
    fuer: ["eigennutzen"], vorhaben: ["sanierung", "heizung"],
    text: "20 % der Sanierungskosten (max. 40.000 €) direkt von der Steuerschuld — Alternative zu BAFA/KfW, ohne Antrag vorab.",
    hinweis: "Nur Selbstnutzung, Gebäude älter als 10 Jahre, Fachunternehmer-Bescheinigung; nicht mit BEG kombinierbar (gleiche Maßnahme).",
    url: "https://www.gesetze-im-internet.de/estg/__35c.html",
  },
];

// Landesförderbanken — je Bundesland eine Anlaufstelle (Programme wechseln,
// daher nur der Einstiegslink).
export const LANDESBANKEN: Record<string, { bank: string; url: string }> = {
  "Baden-Württemberg": { bank: "L-Bank", url: "https://www.l-bank.de" },
  "Bayern": { bank: "BayernLabo", url: "https://www.bayernlabo.de" },
  "Berlin": { bank: "Investitionsbank Berlin (IBB)", url: "https://www.ibb.de" },
  "Brandenburg": { bank: "ILB Brandenburg", url: "https://www.ilb.de" },
  "Bremen": { bank: "BAB – Die Förderbank", url: "https://www.bab-bremen.de" },
  "Hamburg": { bank: "IFB Hamburg", url: "https://www.ifbhh.de" },
  "Hessen": { bank: "WIBank", url: "https://www.wibank.de" },
  "Mecklenburg-Vorpommern": { bank: "LFI M-V", url: "https://www.lfi-mv.de" },
  "Niedersachsen": { bank: "NBank", url: "https://www.nbank.de" },
  "Nordrhein-Westfalen": { bank: "NRW.BANK", url: "https://www.nrwbank.de" },
  "Rheinland-Pfalz": { bank: "ISB Rheinland-Pfalz", url: "https://isb.rlp.de" },
  "Saarland": { bank: "SIKB", url: "https://www.sikb.de" },
  "Sachsen": { bank: "SAB – Sächsische Aufbaubank", url: "https://www.sab.sachsen.de" },
  "Sachsen-Anhalt": { bank: "IB Sachsen-Anhalt", url: "https://www.ib-sachsen-anhalt.de" },
  "Schleswig-Holstein": { bank: "IB.SH", url: "https://www.ib-sh.de" },
  "Thüringen": { bank: "Thüringer Aufbaubank", url: "https://www.aufbaubank.de" },
};

export function filterProgramme(nutzung: Nutzung, vorhaben: Vorhaben): Programm[] {
  return PROGRAMME.filter((p) => p.fuer.includes(nutzung) && p.vorhaben.includes(vorhaben));
}
