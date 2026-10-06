// Materialkatalog des Sanierungsrechners — Richtwerte mit Quelle und Stand.
//
// ALTERT: Preise ändern sich laufend und je Markt. Prüfzyklus in
// docs/app-entwicklung/07 Volatile Kennzahlen und Pruefzyklus.md. Ändert sich ein Wert, nur hier
// ändern — die Tests rechnen mit eigenem Testkatalog und hängen nicht an diesen Zahlen.
//
// WIE ERHOBEN (05.10.2026): Preise von den Produktseiten (schema.org-Preis, ohne Streichpreis) bei
// OBI, toom und Globus, je mit zweiter Quelle zur Gegenprüfung. Hornbach und Bauhaus blockieren
// automatische Abrufe — dort nichts übernommen. Verbrauch aus den technischen Merkblättern der
// Hersteller; Knauf, Alpina, Henkel und Lugato stichprobenhaft selbst nachgelesen.
// Verschnitt (lib/sanierung/rechner.ts) ist eine Annahme, keine Herstellerangabe.

import type { Katalog } from "@/lib/sanierung/rechner";

export const KATALOG_STAND = "05.10.2026";

export const KATALOG: Katalog = {
  // https://www.obi.de/p/6565014/knauf-multifinish-spachtelmasse-25-kg · https://toom.de/p/gipsspachtelmasse-multi-finish-25-kg/2350317
  // Knauf Technisches Blatt P511.de (08/2013): „Auftragsdicke 1 mm 1,1 kg/m²“, „Auftragsdicke 2mm 2,3 kg/m²“.
  spachtel: {
    id: "spachtel",
    name: "Flächenspachtel (Gips)",
    produkt: "Knauf Multi-Finish 25 kg",
    einheit: "kg",
    gebinde: 25,
    gebindeName: "Sack 25 kg",
    verbrauch: { min: 0.55, max: 1.1 },
    preis: 37.99,
    quelle: {
      preis: "OBI 37,99 €, toom 38,99 €",
      verbrauch: "Knauf (Blatt P511): 1,1 kg/m² je mm Schichtdicke; 0,5–1 mm für eine glatte Wand ist eine Annahme",
      stand: KATALOG_STAND,
    },
  },
  // https://www.globus-baumarkt.de/p/mem-super-tiefgrund-10-l-0779050052/ · https://toom.de/p/super-tiefgrund-10-l/3351051
  // (OBI 39,99 €, nur im Markt — Ausreißer, nicht übernommen). MEM Merkblatt 05/2022: „Je Anstrich ca. 0,2 Liter/m²“,
  // Verarbeitung: „… und den Vorgang wiederholen“ → zwei Anstriche.
  tiefengrund: {
    id: "tiefengrund",
    name: "Tiefengrund",
    produkt: "MEM Super-Tiefgrund 10 l",
    einheit: "l",
    gebinde: 10,
    gebindeName: "Kanister 10 l",
    verbrauch: { min: 0.2, max: 0.4 },
    preis: 49.99,
    quelle: {
      preis: "Globus und toom je 49,99 € (OBI 39,99 €, nur im Markt)",
      verbrauch: "MEM: ca. 0,2 l/m² je Anstrich, der Hersteller sieht zwei Anstriche vor — also ein bis zwei",
      stand: KATALOG_STAND,
    },
  },
  // https://www.obi.de/p/9402033/alpinaweiss-wandfarbe-das-original-weiss-matt-10-l · https://toom.de/p/alpinaweiss-das-original-10-l/8101376
  // Alpina TI 24316 (05/2024): „Ca. 118 ml/m² pro Arbeitsgang auf glattem Untergrund. Auf rauen Flächen entsprechend mehr.“
  wandfarbe: {
    id: "wandfarbe",
    name: "Wandfarbe weiß",
    produkt: "Alpinaweiß Das Original 10 l",
    einheit: "l",
    gebinde: 10,
    gebindeName: "Eimer 10 l",
    verbrauch: { min: 0.118, max: 0.118 },
    preis: 54.99,
    quelle: {
      preis: "OBI und toom je 54,99 €",
      verbrauch: "Alpina: ca. 118 ml/m² je Anstrich auf glattem Untergrund; auf rauen Flächen mehr, ohne Zahl",
      stand: KATALOG_STAND,
    },
  },
  // https://www.obi.de/p/4574273/erfurt-rauhfaser-tapete-classico-20-00-x-0-53-m · Globus 8,49 €
  // Erfurt Produktprogramm 2024: „Rollenmaß: 20,0 x 0,53 m/10,6 m2“.
  raufaser: {
    id: "raufaser",
    name: "Raufasertapete",
    produkt: "Erfurt Rauhfaser Classico 20 × 0,53 m",
    einheit: "m²",
    gebinde: 10.6,
    gebindeName: "Rolle 10,6 m²",
    verbrauch: { min: 1, max: 1 },
    preis: 8.29,
    quelle: { preis: "OBI 8,29 €, Globus 8,49 €", verbrauch: "Erfurt: 10,6 m² je Rolle", stand: KATALOG_STAND },
  },
  // https://www.obi.de/p/9595117/metylan-tapetenkleister-raufaser-180-g-paket-transparent · Globus 7,59 €, toom 7,99 €
  // Henkel Merkblatt METYLAN Raufaser: 180 g → „Reichweite 25-29 m²“ (Raufaser).
  kleister: {
    id: "kleister",
    name: "Tapetenkleister",
    produkt: "Metylan Raufaser 180 g",
    einheit: "m²",
    gebinde: 25,
    gebindeName: "Paket 180 g",
    verbrauch: { min: 1, max: 1 },
    preis: 7.29,
    quelle: {
      preis: "OBI 7,29 €, Globus 7,59 €, toom 7,99 €",
      verbrauch: "Henkel: ein Paket reicht für 25–29 m² — gerechnet mit 25 m²",
      stand: KATALOG_STAND,
    },
  },
  // https://www.obi.de/p/8255861/kaindl-excellent-laminat-8-mm-eiche-ferrara (19,40 € / 1,868 m²)
  // Vergleich: toom EGGER Home 8 mm NK 32 13,92 €/m²; Spanne NK 32, 8 mm bei OBI/toom rund 8–18 €/m².
  laminat: {
    id: "laminat",
    name: "Laminat (Klick, NK 32)",
    produkt: "Kaindl Excellent 8 mm",
    einheit: "m²",
    gebinde: 1.868,
    gebindeName: "Paket 1,868 m²",
    verbrauch: { min: 1, max: 1 },
    preis: 19.4,
    quelle: {
      preis: "OBI 19,40 € je Paket (10,39 €/m²); je nach Dekor rund 8–18 €/m² bei OBI und toom",
      verbrauch: "Bodenfläche",
      stand: KATALOG_STAND,
    },
  },
  // https://toom.de/p/vinylboden-rigid-hatting-oak-beige-4-mm/7741450 (31,48 € / 1,75 m²; Streichpreis bei toom nicht erkennbar)
  // Vergleich: OBI Klick-Vinyl Eiche Bologna 3,5 mm SPC 16,99 €/m².
  vinyl: {
    id: "vinyl",
    name: "Vinyl (Klick, SPC)",
    produkt: "d-c-floor Rigid 4 mm",
    einheit: "m²",
    gebinde: 1.75,
    gebindeName: "Pack 1,75 m²",
    verbrauch: { min: 1, max: 1 },
    preis: 31.48,
    quelle: { preis: "toom 31,48 € je Pack (17,99 €/m²), OBI vergleichbar 16,99 €/m²", verbrauch: "Bodenfläche", stand: KATALOG_STAND },
  },
  // https://www.obi.de/p/3627429/selitac-trittschalldaemmung-fuer-parkett-und-laminat-2-2-mm-15-m- · Globus 23,25 €
  trittschall: {
    id: "trittschall",
    name: "Trittschalldämmung",
    produkt: "Selitac Faltplatte 2,2 mm",
    einheit: "m²",
    gebinde: 15,
    gebindeName: "Packung 15 m²",
    verbrauch: { min: 1, max: 1 },
    preis: 23.99,
    quelle: { preis: "OBI 23,99 €, Globus 23,25 €", verbrauch: "Bodenfläche", stand: KATALOG_STAND },
  },
  // https://www.obi.de/p/7343502/kosche-sockelleiste-16-mm-x-58-mm-x-2-500-mm-weiss · toom vergleichbar 10,99 €
  sockelleiste: {
    id: "sockelleiste",
    name: "Sockelleiste MDF weiß",
    produkt: "Kosche 16 × 58 mm, 2,50 m",
    einheit: "m",
    gebinde: 2.5,
    gebindeName: "Stück 2,50 m",
    verbrauch: { min: 1, max: 1 },
    preis: 8.99,
    quelle: { preis: "OBI 8,99 €, toom vergleichbar 10,99 €", verbrauch: "Raumumfang", stand: KATALOG_STAND },
  },
  // https://www.obi.de/p/1473271/bodenfliese-feinsteinzeug-iron-grey-grau-glasiert-matt-60-cm-x-60-cm (28,78 € / 1,44 m²)
  // Vergleich: https://www.globus-baumarkt.de/p/bodenfliese-feinsteinzeug-beton-60-x-60-cm-grau-0776057961/ 17,99 €/m²,
  // toom Metro 60 × 60 17,99 €/m². Eine identische Fliese bei zwei Märkten gibt es nicht — nur die Spanne.
  // Für Wände gilt derselbe Preis; Steingut-Wandfliesen kosten bei OBI/Globus 9,99–22,99 €/m².
  fliese: {
    id: "fliese",
    name: "Fliesen (Feinsteinzeug 60 × 60)",
    produkt: "OBI Iron grey 60 × 60 cm",
    einheit: "m²",
    gebinde: 1.44,
    gebindeName: "Paket 1,44 m²",
    verbrauch: { min: 1, max: 1 },
    preis: 28.78,
    quelle: {
      preis: "OBI 28,78 € je Paket (19,99 €/m²); vergleichbar Globus und toom je 17,99 €/m², üblich rund 18–23 €/m²",
      verbrauch: "Fliesenfläche",
      stand: KATALOG_STAND,
    },
  },
  // https://www.obi.de/p/1766096/pci-flexmoertel-fliesenkleber-25-kg · toom 54,99 €
  // PCI Merkblatt 9/25: „ca. 2,8 kg/m²“ bei Zahnung 8 mm, „ca. 3,6 kg/m²“ bei 10 mm (leicht profilierte Fliesen).
  // Für Großformate verlangt die Praxis oft zusätzlich Kleber auf der Fliesenrückseite — dafür nennt PCI keine Zahl.
  fliesenkleber: {
    id: "fliesenkleber",
    name: "Fliesenkleber (Flex)",
    produkt: "PCI Flexmörtel 25 kg",
    einheit: "kg",
    gebinde: 25,
    gebindeName: "Sack 25 kg",
    verbrauch: { min: 2.8, max: 3.6 },
    preis: 48.99,
    quelle: {
      preis: "OBI 48,99 €, toom 54,99 €",
      verbrauch: "PCI: ca. 2,8 kg/m² (Zahnung 8 mm) bis 3,6 kg/m² (10 mm); große Fliesen brauchen eher mehr",
      stand: KATALOG_STAND,
    },
  },
  // https://www.obi.de/p/8242257/lugato-fugenmoertel-fugengrau-5-kg-zementgrau (Marktplatz-Preis; Hornbach 9,95 € nur aus
  // einer Suchzusammenfassung). Lugato Merkblatt 08/2026 (https://www.lugato.de/fileadmin/user_upload/fg_tm_DE_rz.pdf):
  // 30 × 60 cm, 10 mm dick, Fuge 5 mm → „ca. 0,41 kg/m²“; 60 × 60 cm, 10 mm, Fuge 3 mm → „ca. 0,16 kg/m²“.
  fugenmoertel: {
    id: "fugenmoertel",
    name: "Fugenmörtel",
    produkt: "Lugato Fugengrau 5 kg",
    einheit: "kg",
    gebinde: 5,
    gebindeName: "Eimer 5 kg",
    verbrauch: { min: 0.16, max: 0.41 },
    preis: 9.99,
    quelle: {
      preis: "OBI 9,99 €, Hornbach rund 9,95 €",
      verbrauch: "Lugato: ca. 0,16 kg/m² (60 × 60, Fuge 3 mm) bis 0,41 kg/m² (30 × 60, Fuge 5 mm); bei Fußbodenheizung empfiehlt Lugato einen flexiblen Fugenmörtel",
      stand: KATALOG_STAND,
    },
  },
  // https://www.obi.de/p/1892728/knauf-sanitaer-silikon-weiss-300-ml · toom 11,99 € (andere EAN)
  // Knauf Datenblatt 09/2026 (https://bilder.obi.de/a61db67b-d0ee-4f0a-bea4-0fe9c08ddc23/document.pdf):
  // „Verbrauch Fugenmeter pro Kartusche bei 6 x 6 mm Fugenbreite = 8 m“ (ein älteres toom-Blatt nennt 12 m — 300 ml ÷ 36 ml/m
  // ergibt 8,3 m, deshalb 8 m).
  silikon: {
    id: "silikon",
    name: "Sanitär-Silikon",
    produkt: "Knauf Sanitär-Silikon 300 ml",
    einheit: "m",
    gebinde: 8,
    gebindeName: "Kartusche 300 ml",
    verbrauch: { min: 1, max: 1 },
    preis: 11.79,
    quelle: {
      preis: "OBI 11,79 €, toom 11,99 €",
      verbrauch: "Knauf: 8 m Fuge je Kartusche bei 6 × 6 mm — gerechnet für die Fuge zwischen Boden und Wand",
      stand: KATALOG_STAND,
    },
  },
};
