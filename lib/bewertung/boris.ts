// Amtliche Bodenrichtwert-Portale je Bundesland (Ansicht überall kostenlos).
// Der Nutzer schlägt dort den Bodenrichtwert (€/m²) für sein Objekt nach und
// trägt ihn in den Bewertungs-Assistenten ein. Stand: 17.07.2026.

export type BorisPortal = { land: string; portal: string; url: string };

// Zentrales Portal (12 Länder gebündelt, ohne BW/Saarland/Sachsen/Sachsen-Anhalt).
export const BORIS_D = {
  portal: "BORIS-D (bundesweit, gebündelt)",
  url: "https://www.bodenrichtwerte-boris.de",
};

export const BORIS_LAENDER: BorisPortal[] = [
  { land: "Baden-Württemberg", portal: "BORIS-BW", url: "https://www.gutachterausschuesse-bw.de/borisbw/" },
  { land: "Bayern", portal: "BORIS Bayern", url: "https://www.boris-bayern.de" },
  { land: "Berlin", portal: "BORIS Berlin (FIS-Broker)", url: "https://fbinter.stadt-berlin.de/boris/" },
  { land: "Brandenburg", portal: "BORIS Brandenburg", url: "https://www.boris-brandenburg.de/boris-bb/" },
  { land: "Bremen", portal: "BRW-Karte Bremen", url: "https://www.gutachterausschuss.bremen.de" },
  { land: "Hamburg", portal: "BORIS.HH", url: "https://www.hamburg.de/bsw/gutachterausschuss/" },
  { land: "Hessen", portal: "BORIS Hessen", url: "https://hvbg.hessen.de/immobilienwerte/boris-hessen" },
  { land: "Mecklenburg-Vorpommern", portal: "Geoportal MV", url: "https://www.geoportal-mv.de" },
  { land: "Niedersachsen", portal: "Immobilienmarkt.NI", url: "https://immobilienmarkt.niedersachsen.de" },
  { land: "Nordrhein-Westfalen", portal: "BORIS.NRW", url: "https://www.boris.nrw.de" },
  { land: "Rheinland-Pfalz", portal: "GeoBasisViewer RLP", url: "https://maps.rlp.de" },
  { land: "Saarland", portal: "Geoportal Saarland", url: "https://geoportal.saarland.de" },
  { land: "Sachsen", portal: "BORIS Sachsen", url: "https://www.boris.sachsen.de" },
  { land: "Sachsen-Anhalt", portal: "LVermGeo Sachsen-Anhalt", url: "https://www.lvermgeo.sachsen-anhalt.de/de/gdp-kostenfreier-brw.html" },
  { land: "Schleswig-Holstein", portal: "Digitaler Atlas Nord (GAA SH)", url: "https://www.schleswig-holstein.de/DE/GAA/" },
  { land: "Thüringen", portal: "BORIS-TH (TLBG)", url: "https://tlbg.thueringen.de/wertermittlung/" },
];

// Standard-Liegenschaftszinssätze (Default, wenn kein Grundstücksmarktbericht
// vorliegt) — Quelle: Gutachterausschüsse (Bandbreiten aus Masterplan §10).
export const LZ_DEFAULT = {
  efh: 2.5,
  etw: 3.0,
  mfh: 3.2,
  wohnGeschaeft: 4.0,
};
