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
  bedingung?: string;           // "kommt laut deinen Angaben in Frage, wenn …" (§ 34i: Info, keine Empfehlung)
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
    bedingung: "das Gebäude Effizienzhaus 40 erfüllt und nicht mit Öl/Gas beheizt wird (297 Selbstnutzer, 298 auch Vermieter) — ohne Einkommens-/Kindergrenze.",
    hinweis: "Nachhaltigkeitsanforderungen (QNG teils nötig); Antrag vor Kaufvertrag/Baubeginn.",
    url: "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Neubau/F%C3%B6rderprodukte/Klimafreundlicher-Neubau-Wohngeb%C3%A4ude-(297-298)/",
  },
  {
    key: "kfw261",
    name: "KfW 261 – Wohngebäude: Sanierung zum Effizienzhaus",
    traeger: "KfW", art: "kredit",
    fuer: ["vermieten", "eigennutzen"], vorhaben: ["sanierung", "kauf_bestand"],
    text: "Kredit mit Tilgungszuschuss für die Komplettsanierung zum Effizienzhaus — auch beim Kauf frisch sanierten Bestands.",
    bedingung: "du ein Bestandsgebäude auf mindestens Effizienzhaus 85 (oder Denkmal) sanierst — Selbstnutzer wie Vermieter, der Tilgungszuschuss steigt mit dem Zielstandard.",
    hinweis: "Energieeffizienz-Experte (dena-Liste) ist Pflicht.",
    url: "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/F%C3%B6rderprodukte/Bundesf%C3%B6rderung-f%C3%BCr-effiziente-Geb%C3%A4ude-Wohngeb%C3%A4ude-Kredit-(261-262)/",
  },
  {
    key: "kfw458",
    name: "KfW 458 – Heizungsförderung (Zuschuss)",
    traeger: "KfW", art: "zuschuss",
    fuer: ["vermieten", "eigennutzen"], vorhaben: ["heizung", "sanierung"],
    text: "Zuschuss für den Tausch auf Wärmepumpe & Co. — Basis 30 %, mit Boni bis 70 % (Selbstnutzer).",
    bedingung: "das Gebäude mindestens 5 Jahre alt ist und du eine erneuerbare Heizung einbaust — Antrag vor Auftragsvergabe (Vertrag mit aufschiebender Bedingung).",
    hinweis: "Vermieter erhalten nur die Grundförderung (~30–35 %), keine Einkommens-/Speed-Boni.",
    url: "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/F%C3%B6rderprodukte/Heizungsf%C3%B6rderung-f%C3%BCr-Privatpersonen-Wohngeb%C3%A4ude-(458)/",
  },
  {
    key: "bafa",
    name: "BAFA BEG EM – Einzelmaßnahmen (Dämmung, Fenster, Anlagentechnik)",
    traeger: "BAFA", art: "zuschuss",
    fuer: ["vermieten", "eigennutzen"], vorhaben: ["sanierung"],
    text: "Zuschuss (i. d. R. 15–20 %) für Gebäudehülle und Anlagentechnik außer Heizung.",
    bedingung: "das Gebäude mindestens 5 Jahre alt ist, du an Hülle/Technik (nicht Heizung → KfW 458) saniert und einen Energieeffizienz-Experten einbindest — Selbstnutzer wie Vermieter.",
    hinweis: "Antrag vor Beauftragung; Energieeffizienz-Experte nötig; iSFP-Bonus möglich.",
    url: "https://www.bafa.de/DE/Energie/Effiziente_Gebaeude/effiziente_gebaeude_node.html",
  },
  {
    key: "kfw124",
    name: "KfW 124 – Wohneigentumsprogramm",
    traeger: "KfW", art: "kredit",
    fuer: ["eigennutzen"], vorhaben: ["kauf_bestand", "neubau"],
    text: "Bis 100.000 € günstiger Kredit für selbstgenutztes Wohneigentum — ohne Einkommensgrenze.",
    bedingung: "du das Objekt selbst bewohnst (oder unentgeltlich an Angehörige überlässt) und vor Kaufvertrag/Baubeginn beantragst — der breiteste Basiskredit, kein Energiestandard nötig.",
    url: "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Neubau/F%C3%B6rderprodukte/Wohneigentumsprogramm-(124)/",
  },
  {
    key: "kfw300",
    name: "KfW 300 – Wohneigentum für Familien (Neubau)",
    traeger: "KfW", art: "kredit",
    fuer: ["eigennutzen"], vorhaben: ["neubau"],
    text: "Stark zinsverbilligter Kredit für Familien mit Kind beim klimafreundlichen Neubau/Ersterwerb.",
    bedingung: "mind. 1 Kind unter 18 im Haushalt lebt, das zu versteuernde Haushaltseinkommen ≤ 90.000 € (+10.000 € je weiterem Kind) ist, du selbst einziehst und das Haus Effizienzhaus 40 erreicht.",
    hinweis: "Einkommensgrenze (90.000 € zvE + Staffel je Kind); mind. 1 Kind unter 18 im Haushalt.",
    url: "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Neubau/F%C3%B6rderprodukte/Wohneigentum-f%C3%BCr-Familien-(300)/",
  },
  {
    key: "kfw308",
    name: "KfW 308 – Jung kauft Alt (Bestandskauf + Sanierung)",
    traeger: "KfW", art: "kredit",
    fuer: ["eigennutzen"], vorhaben: ["kauf_bestand"],
    text: "Günstiger Kredit für Familien, die sanierungsbedürftigen Bestand kaufen (schlechte Effizienzklasse) und binnen 4,5 J. sanieren.",
    bedingung: "mind. 1 Kind unter 18, Haushaltseinkommen ≤ 90.000 € zvE (+ je Kind), Selbstnutzung und das gekaufte Gebäude hat Energieklasse F, G oder H (Sanierungspflicht auf EH 85 EE binnen 4,5 J.).",
    // Quelle (geprüft 20.07.2026): kfw.de – Wohneigentum für Familien – Bestandserwerb (308).
    // Sanierungsziel ist Effizienzhaus 85 EE (nicht 70); ab 03.08.2026 alternativ über
    // energetische Einzelmaßnahmen erfüllbar, Förderhöchstbeträge angehoben.
    hinweis: "Einkommensgrenze wie KfW 300 (90.000 € zvE + 10.000 € je weiterem Kind); Sanierungspflicht auf EH 85 EE (ab 03.08.2026 auch per Einzelmaßnahmen).",
    url: "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/F%C3%B6rderprodukte/Wohneigentum-f%C3%BCr-Familien-Bestandserwerb-(308)/",
  },
  {
    key: "kfw159",
    name: "KfW 159 – Altersgerecht Umbauen / Einbruchschutz",
    traeger: "KfW", art: "kredit",
    fuer: ["vermieten", "eigennutzen"], vorhaben: ["sanierung"],
    text: "Bis 50.000 € Kredit für Barrierereduzierung (Bad, Aufzug, Zugänge) — unabhängig vom Alter.",
    bedingung: "du Barrieren reduzierst (bodengleiche Dusche, Türverbreiterung, Aufzug, Zugänge) — altersunabhängig, Selbstnutzer wie Vermieter, Antrag vor Vorhabensbeginn.",
    url: "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/F%C3%B6rderprodukte/Altersgerecht-Umbauen-(159)/",
  },
  {
    key: "steuer35c",
    name: "§ 35c EStG – Steuerbonus energetische Sanierung",
    traeger: "Steuer", art: "steuer",
    fuer: ["eigennutzen"], vorhaben: ["sanierung", "heizung"],
    text: "20 % der Sanierungskosten (max. 40.000 €) direkt von der Steuerschuld — Alternative zu BAFA/KfW, ohne Antrag vorab.",
    bedingung: "das Gebäude über 10 Jahre alt und ausschließlich selbstgenutzt ist und eine Fachunternehmer-Bescheinigung vorliegt — entweder § 35c oder BAFA/KfW-Zuschuss für dieselbe Maßnahme, nie beides.",
    hinweis: "Nur Selbstnutzung, Gebäude älter als 10 Jahre, Fachunternehmer-Bescheinigung; nicht mit BEG kombinierbar (gleiche Maßnahme). Keine Steuerberatung.",
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

// ============================================================================
// Auto-Förderkredit für den Finanzierungs-Stack (Kaufpreis-Segment).
// § 34i GewO: reine Rechnung/Information — "kommt laut deinen Angaben in Frage",
// KEINE Empfehlung, KEINE Vermittlung. Nur KfW-KREDITE, die den Kaufpreis
// mitfinanzieren (nicht Zuschüsse 458/BAFA; nicht Sanierungskredite 261/159,
// da gesamtInvest keine Sanierungskosten enthält).
// Beträge: Stand 07/2026. ⚠️ KfW 308 hebt laut kfw.de ab 03.08.2026 an —
// Zahlen dann hier aktualisieren (KFW_STAND anpassen).
// ============================================================================

export const KFW_STAND = "07/2026";

export type Energieklasse = "A+" | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";

export type FoerderKontext = {
  nutzung: Nutzung;                     // "eigennutzen" | "vermieten"
  vorhaben: "neubau" | "kauf_bestand";
  einWohneinheit: boolean;              // Auto-Matching nur für 1-WE-Objekte (EFH/ETW)
  kinder: number;                       // Kinder < 18 im Haushalt
  zveJahr: number;                      // zu versteuerndes Haushaltseinkommen €/Jahr (0 = unbekannt)
  eh40: boolean;                        // Neubau erreicht Effizienzhaus 40
  keineFossileHeizung: boolean;         // keine Öl/Gas(/Biomasse)-Heizung
  qng: boolean;                         // QNG-Nachhaltigkeitszertifikat (hebt Höchstbetrag)
  energieklasse?: Energieklasse;        // Energieausweis des Bestandsobjekts
  restbedarf: number;                   // gesamtInvest − eingesetztes Eigenkapital (≥ 0)
};

export type FoerderKreditTreffer = {
  key: string;
  name: string;
  hoechstbetrag: number;                // programmatische Obergrenze im Kontext (EUR)
  segment: number;                      // min(hoechstbetrag, restbedarf) — der Balkenwert
  bedingung: string;                    // "kommt laut deinen Angaben in Frage, wenn …"
  url: string;
};

// Einkommensgrenze der Familienprogramme (300/308): 90k + 10k je weiterem Kind.
export function foerderEinkommensgrenze(kinder: number): number {
  return 90_000 + Math.max(0, kinder - 1) * 10_000;
}

// Höchstbeträge je Wohneinheit (Auto-Matching: 1 WE).
export function kfw300Betrag(kinder: number, qng: boolean): number {
  if (kinder >= 5) return qng ? 270_000 : 220_000;
  if (kinder >= 3) return qng ? 250_000 : 200_000;
  return qng ? 220_000 : 170_000;       // 1–2 Kinder
}
export function kfw308Betrag(kinder: number): number {
  if (kinder >= 3) return 150_000;
  if (kinder === 2) return 125_000;
  return 100_000;                       // 1 Kind
}
export function kfw297_298Betrag(qng: boolean): number {
  return qng ? 150_000 : 100_000;
}
const KFW124_BETRAG = 100_000;

const istFGH = (k?: Energieklasse) => k === "F" || k === "G" || k === "H";
// Direkte Produktseiten (geprüft 21.07.2026, alle HTTP 200) — nicht die Übersicht.
const KFW_PRODUKT: Record<string, string> = {
  "KfW 124": "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Neubau/F%C3%B6rderprodukte/Wohneigentumsprogramm-(124)/",
  "KfW 300": "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Neubau/F%C3%B6rderprodukte/Wohneigentum-f%C3%BCr-Familien-(300)/",
  "KfW 308": "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Bestehende-Immobilie/F%C3%B6rderprodukte/Wohneigentum-f%C3%BCr-Familien-Bestandserwerb-(308)/",
  "KfW 297": "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Neubau/F%C3%B6rderprodukte/Klimafreundlicher-Neubau-Wohngeb%C3%A4ude-(297-298)/",
  "KfW 298": "https://www.kfw.de/inlandsfoerderung/Privatpersonen/Neubau/F%C3%B6rderprodukte/Klimafreundlicher-Neubau-Wohngeb%C3%A4ude-(297-298)/",
};
const deckel = (betrag: number, restbedarf: number) =>
  Math.max(0, Math.min(betrag, Math.max(0, restbedarf)));

// Alle in Frage kommenden KfW-Erwerbskredite (ungedeckelt sortiert nach
// Höchstbetrag absteigend). Für die Anzeige aller Optionen (Nutzer wählt selbst).
export function foerderKredite(k: FoerderKontext): FoerderKreditTreffer[] {
  if (!k.einWohneinheit) return [];
  const grenze = foerderEinkommensgrenze(k.kinder);
  const familienBerechtigt = k.kinder >= 1 && k.zveJahr > 0 && k.zveJahr <= grenze; // zvE>0-Guard!
  const out: Omit<FoerderKreditTreffer, "segment">[] = [];
  const add = (key: string, name: string, betrag: number, bedingung: string) =>
    out.push({ key, name, hoechstbetrag: betrag, bedingung, url: KFW_PRODUKT[key] });

  if (k.nutzung === "eigennutzen") {
    if (k.vorhaben === "neubau") {
      if (familienBerechtigt && k.eh40 && k.keineFossileHeizung)
        add("KfW 300", "KfW 300 – Wohneigentum für Familien", kfw300Betrag(k.kinder, k.qng),
          `mind. 1 Kind < 18, zvE ≤ ${grenze.toLocaleString("de-DE")} €, Effizienzhaus 40 ohne fossile Heizung, Selbstnutzung`);
      if (k.eh40 && k.keineFossileHeizung)
        add("KfW 297", "KfW 297 – Klimafreundlicher Neubau", kfw297_298Betrag(k.qng),
          `das Gebäude Effizienzhaus 40 erfüllt und nicht mit Öl/Gas beheizt wird${k.qng ? " (mit QNG-Zertifikat)" : ""}`);
      add("KfW 124", "KfW 124 – Wohneigentumsprogramm", KFW124_BETRAG,
        "du das Objekt selbst bewohnst — Basiskredit, kein Energiestandard nötig");
    } else {
      if (familienBerechtigt && istFGH(k.energieklasse))
        add("KfW 308", "KfW 308 – Jung kauft Alt", kfw308Betrag(k.kinder),
          `mind. 1 Kind < 18, zvE ≤ ${grenze.toLocaleString("de-DE")} €, Energieklasse F/G/H, Sanierung auf EH 85 EE binnen 4,5 J.`);
      add("KfW 124", "KfW 124 – Wohneigentumsprogramm", KFW124_BETRAG,
        "du das Objekt selbst bewohnst — Basiskredit, kein Energiestandard nötig");
    }
  } else if (k.vorhaben === "neubau" && k.eh40 && k.keineFossileHeizung) {
    add("KfW 298", "KfW 298 – Klimafreundlicher Neubau (Vermietung)", kfw297_298Betrag(k.qng),
      `das vermietete Gebäude Effizienzhaus 40 erfüllt und nicht mit Öl/Gas beheizt wird${k.qng ? " (mit QNG-Zertifikat)" : ""}`);
    // Vermieteter Bestand: kein Erwerbs-Förderkredit (124 nur Selbstnutzer).
  }

  // Reihenfolge = Push-Reihenfolge (spezifischeres zuerst); stabil nach Betrag absteigend.
  return out
    .map((t) => ({ ...t, segment: deckel(t.hoechstbetrag, k.restbedarf) }))
    .sort((a, b) => b.hoechstbetrag - a.hoechstbetrag);
}

// Bestpassender (= betragsmäßig größter erfüllbarer) Erwerbs-Förderkredit.
// "Größter zinsverbilligter Betrag" ist ein rechnerisches Kriterium, KEINE
// Wertung i. S. § 34i — die UI listet alle Treffer, der Nutzer entscheidet.
export function foerderKredit(k: FoerderKontext): FoerderKreditTreffer | null {
  return foerderKredite(k)[0] ?? null;
}
