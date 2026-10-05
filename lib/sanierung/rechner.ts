// Sanierungsrechner, Stufe 1: Materialkosten (05.10.2026, Vorgabe des Betreibers:
// „hauptsächlich erstmal Materialkosten; den Lohn gibt der Nutzer selbst ein — wir stellen nur
// den Rechner“).
//
// Ablauf: Raum (Länge × Breite × Höhe, Fenster/Türen) → Flächen → gewählte Maßnahmen →
// Materialmenge VON–BIS → ganze Gebinde → Kosten VON–BIS. Dazu Lohn (Stunden × eigener
// Stundensatz) und eigene Posten (z. B. „Bad komplett“ mit dem Betrag, den der Nutzer kennt).
//
// WARUM VON–BIS: Hersteller geben den Verbrauch als Spanne an (Spachtel je nach Untergrund),
// Verschnitt hängt vom Raum ab. Eine einzige Zahl („17,3 kg“) täte so, als wüsste der Rechner
// mehr als der Hersteller — dieselbe Scheingenauigkeit, die bei der Schulden-Uhr bewusst
// vermieden ist.
//
// WARUM ÜBER ALLE RÄUME GERUNDET: Gekauft wird für die ganze Wohnung, nicht je Zimmer. Fünf
// Räume mit je 3 kg Spachtel sind EIN 20-kg-Sack, nicht fünf.
//
// Reine Funktionen; der Katalog (Preise, Verbrauch, Quellen) kommt als Parameter, damit die
// Rechnung ohne die alternden Preise prüfbar ist. Eine Schätzung, kein Kostenvoranschlag.

export type MaterialId =
  | "spachtel"
  | "tiefengrund"
  | "wandfarbe"
  | "raufaser"
  | "kleister"
  | "laminat"
  | "vinyl"
  | "trittschall"
  | "sockelleiste"
  | "fliese"
  | "fliesenkleber"
  | "fugenmoertel"
  | "silikon";

export type Spanne = { min: number; max: number };

export type Material = {
  id: MaterialId;
  name: string;
  /** Beispielprodukt, auf das sich Preis und Verbrauch beziehen. */
  produkt: string;
  /** Mengeneinheit des Verbrauchs und des Gebindes. */
  einheit: "kg" | "l" | "m²" | "m";
  /** Menge je Gebinde in `einheit` (Sack 20 kg → 20; Rolle mit 17,7 m² → 17.7). */
  gebinde: number;
  gebindeName: string;
  /** Verbrauch je m² Fläche (bei Sockelleisten je m Umfang), je Anstrich bzw. Lage. */
  verbrauch: Spanne;
  /** Preis je Gebinde, brutto. */
  preis: number;
  quelle: { preis: string; verbrauch: string; stand: string };
};

export type Katalog = Record<MaterialId, Material>;

/**
 * `fliesenwand` = Umfang × Fliesenhöhe (abzüglich des Anteils der Öffnungen, der in diese Höhe
 * fällt). Wird in einem Raum die Wand gefliest, ist `wand` für Spachteln, Tapezieren und Streichen
 * nur noch der Rest darüber — sonst würde dieselbe Fläche gefliest UND gestrichen.
 */
export type FlaechenArt = "wand" | "decke" | "boden" | "umfang" | "fliesenwand";

export type MassnahmeId =
  | "spachteln"
  | "grundieren"
  | "tapezieren"
  | "wand_streichen"
  | "decke_streichen"
  | "laminat"
  | "vinyl"
  | "boden_fliesen"
  | "wand_fliesen";

type Bedarf = {
  material: MaterialId;
  flaechen: FlaechenArt[];
  /** Anstriche bzw. Lagen (Farbe: 2). */
  lagen?: number;
  /** Zuschlag für Verschnitt als Anteil (0.05 = 5 %), von–bis. Eine ANNAHME, im Katalog belegt. */
  zuschlag?: Spanne;
};

export type Massnahme = { id: MassnahmeId; label: string; bedarf: Bedarf[]; hinweis?: string };

/** Verschnitt: Annahme von MyImmo (keine Herstellerangabe) — in der Oberfläche so benannt. */
export const VERSCHNITT_BODEN: Spanne = { min: 0.05, max: 0.1 };
export const VERSCHNITT_TAPETE: Spanne = { min: 0.1, max: 0.15 };
export const VERSCHNITT_LEISTE: Spanne = { min: 0.05, max: 0.1 };
export const VERSCHNITT_FLIESE: Spanne = { min: 0.1, max: 0.15 };

export const MASSNAHMEN: Massnahme[] = [
  {
    id: "spachteln",
    label: "Wände spachteln",
    bedarf: [{ material: "spachtel", flaechen: ["wand"] }],
    hinweis: "Flächig glätten. Große Löcher und Risse brauchen mehr.",
  },
  {
    id: "grundieren",
    label: "Wände & Decke grundieren",
    bedarf: [{ material: "tiefengrund", flaechen: ["wand", "decke"] }],
  },
  {
    id: "tapezieren",
    label: "Wände mit Raufaser tapezieren",
    bedarf: [
      { material: "raufaser", flaechen: ["wand"], zuschlag: VERSCHNITT_TAPETE },
      { material: "kleister", flaechen: ["wand"], zuschlag: VERSCHNITT_TAPETE },
    ],
  },
  {
    id: "wand_streichen",
    label: "Wände streichen (2 Anstriche)",
    bedarf: [{ material: "wandfarbe", flaechen: ["wand"], lagen: 2 }],
    hinweis: "Farbverbrauch für glatten Untergrund — auf Raufaser braucht es mehr, der Hersteller nennt keine Zahl.",
  },
  {
    id: "decke_streichen",
    label: "Decke streichen (2 Anstriche)",
    bedarf: [{ material: "wandfarbe", flaechen: ["decke"], lagen: 2 }],
  },
  {
    id: "laminat",
    label: "Laminat verlegen",
    bedarf: [
      { material: "laminat", flaechen: ["boden"], zuschlag: VERSCHNITT_BODEN },
      { material: "trittschall", flaechen: ["boden"], zuschlag: VERSCHNITT_BODEN },
      { material: "sockelleiste", flaechen: ["umfang"], zuschlag: VERSCHNITT_LEISTE },
    ],
    hinweis: "Sockelleisten über den ganzen Umfang, ohne Abzug für Türen.",
  },
  {
    id: "vinyl",
    label: "Vinyl (Klick) verlegen",
    bedarf: [
      { material: "vinyl", flaechen: ["boden"], zuschlag: VERSCHNITT_BODEN },
      { material: "sockelleiste", flaechen: ["umfang"], zuschlag: VERSCHNITT_LEISTE },
    ],
    hinweis: "Ohne Trittschall — viele Klick-Vinyls haben ihn eingebaut. Sonst Laminat-Trittschall dazurechnen.",
  },
  {
    id: "boden_fliesen",
    label: "Boden fliesen",
    bedarf: [
      { material: "fliese", flaechen: ["boden"], zuschlag: VERSCHNITT_FLIESE },
      { material: "fliesenkleber", flaechen: ["boden"] },
      { material: "fugenmoertel", flaechen: ["boden"] },
      { material: "silikon", flaechen: ["umfang"] },
    ],
    hinweis: "Silikon für die Anschlussfuge Boden–Wand über den ganzen Umfang. Fliesenpreis schwankt stark — eigenen Preis eintragen.",
  },
  {
    id: "wand_fliesen",
    label: "Wände fliesen",
    bedarf: [
      { material: "fliese", flaechen: ["fliesenwand"], zuschlag: VERSCHNITT_FLIESE },
      { material: "fliesenkleber", flaechen: ["fliesenwand"] },
      { material: "fugenmoertel", flaechen: ["fliesenwand"] },
    ],
    hinweis: "Bis zur Fliesenhöhe; darüber zählt die Wand für Spachteln, Tapezieren und Streichen weiter.",
  },
];

export type Raum = {
  id: string;
  name: string;
  /** Meter. */
  laenge: number;
  breite: number;
  hoehe: number;
  /** Fenster und Türen in m² — wird von der Wandfläche abgezogen. */
  oeffnungen: number;
  /** Bis zu welcher Höhe die Wand gefliest wird (m); fehlt sie oder ist 0: bis zur Decke. */
  fliesenhoehe?: number;
  massnahmen: MassnahmeId[];
};

export type Flaechen = Record<FlaechenArt, number>;

const pos = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);
const rund2 = (v: number) => Math.round(v * 100) / 100;

export function flaechen(r: Pick<Raum, "laenge" | "breite" | "hoehe" | "oeffnungen" | "fliesenhoehe">): Flaechen {
  const l = pos(r.laenge);
  const b = pos(r.breite);
  const h = pos(r.hoehe);
  const umfang = 2 * (l + b);
  // Fliesenhöhe nie über der Raumhöhe; ohne Angabe bis zur Decke. Von den Öffnungen zählt der
  // Anteil, der in die geflieste Höhe fällt (Näherung: gleichmäßig über die Höhe verteilt).
  const fh = pos(r.fliesenhoehe ?? 0) > 0 ? Math.min(pos(r.fliesenhoehe ?? 0), h) : h;
  const anteil = h > 0 ? fh / h : 0;
  return {
    wand: rund2(Math.max(0, umfang * h - pos(r.oeffnungen))),
    decke: rund2(l * b),
    boden: rund2(l * b),
    umfang: rund2(umfang),
    fliesenwand: rund2(Math.max(0, umfang * fh - pos(r.oeffnungen) * anteil)),
  };
}

export type LohnPosten = { bezeichnung: string; stunden: number; satz: number };
export type EigenerPosten = { bezeichnung: string; betrag: number };

export type SanierungEingabe = {
  raeume: Raum[];
  /** Eigene Preise je Gebinde — schlagen den Katalog. */
  preise?: Partial<Record<MaterialId, number>>;
  lohn?: LohnPosten[];
  eigene?: EigenerPosten[];
};

export type MaterialZeile = {
  material: Material;
  /** Benötigte Menge in `material.einheit`, von–bis (zwei Nachkommastellen). */
  menge: Spanne;
  /** Ganze Gebinde, von–bis. */
  gebinde: Spanne;
  /** Verwendeter Preis je Gebinde (eigener Preis, sonst Katalog). */
  preis: number;
  eigenerPreis: boolean;
  kosten: Spanne;
};

export type SanierungErgebnis = {
  material: MaterialZeile[];
  materialKosten: Spanne;
  lohn: number;
  eigene: number;
  gesamt: Spanne;
  /** Summe der Flächen aller Räume — zur Kontrolle in der Oberfläche. */
  flaechen: Flaechen;
};

/** Ganze Gebinde; ein Hauch Toleranz gegen Rundungsreste (40 / 20 = 2, nicht 3). */
export function gebindeFuer(menge: number, jeGebinde: number): number {
  if (!(menge > 0) || !(jeGebinde > 0)) return 0;
  return Math.ceil(menge / jeGebinde - 1e-9);
}

export function berechneSanierung(eingabe: SanierungEingabe, katalog: Katalog): SanierungErgebnis {
  const mengen = new Map<MaterialId, Spanne>();
  const summe: Flaechen = { wand: 0, decke: 0, boden: 0, umfang: 0, fliesenwand: 0 };

  for (const raum of eingabe.raeume) {
    const roh = flaechen(raum);
    // Geflieste Wand wird nicht auch noch gespachtelt, tapeziert oder gestrichen.
    const wandGefliest = raum.massnahmen.includes("wand_fliesen");
    const f: Flaechen = wandGefliest ? { ...roh, wand: rund2(Math.max(0, roh.wand - roh.fliesenwand)) } : { ...roh, fliesenwand: 0 };
    for (const k of Object.keys(summe) as FlaechenArt[]) summe[k] = rund2(summe[k] + f[k]);
    // Jede Maßnahme zählt je Raum einmal, auch wenn sie doppelt angehakt ankommt.
    for (const id of new Set(raum.massnahmen)) {
      const m = MASSNAHMEN.find((x) => x.id === id);
      if (!m) continue;
      for (const b of m.bedarf) {
        const mat = katalog[b.material];
        const flaeche = b.flaechen.reduce((s, art) => s + f[art], 0);
        const lagen = b.lagen ?? 1;
        const z = b.zuschlag ?? { min: 0, max: 0 };
        const alt = mengen.get(b.material) ?? { min: 0, max: 0 };
        mengen.set(b.material, {
          min: alt.min + flaeche * mat.verbrauch.min * lagen * (1 + z.min),
          max: alt.max + flaeche * mat.verbrauch.max * lagen * (1 + z.max),
        });
      }
    }
  }

  const material: MaterialZeile[] = [];
  for (const [id, menge] of mengen) {
    if (!(menge.max > 0)) continue;
    const mat = katalog[id];
    const eigener = eingabe.preise?.[id];
    const eigenerPreis = typeof eigener === "number" && Number.isFinite(eigener) && eigener >= 0;
    const preis = eigenerPreis ? eigener : mat.preis;
    const gebinde = { min: gebindeFuer(menge.min, mat.gebinde), max: gebindeFuer(menge.max, mat.gebinde) };
    material.push({
      material: mat,
      menge: { min: rund2(menge.min), max: rund2(menge.max) },
      gebinde,
      preis,
      eigenerPreis,
      kosten: { min: rund2(gebinde.min * preis), max: rund2(gebinde.max * preis) },
    });
  }
  // Feste Reihenfolge wie im Katalog, nicht nach Reihenfolge der Räume.
  const reihenfolge = Object.keys(katalog) as MaterialId[];
  material.sort((a, b) => reihenfolge.indexOf(a.material.id) - reihenfolge.indexOf(b.material.id));

  const materialKosten = {
    min: rund2(material.reduce((s, z) => s + z.kosten.min, 0)),
    max: rund2(material.reduce((s, z) => s + z.kosten.max, 0)),
  };
  const lohn = rund2((eingabe.lohn ?? []).reduce((s, p) => s + pos(p.stunden) * pos(p.satz), 0));
  const eigene = rund2((eingabe.eigene ?? []).reduce((s, p) => s + pos(p.betrag), 0));

  return {
    material,
    materialKosten,
    lohn,
    eigene,
    gesamt: { min: rund2(materialKosten.min + lohn + eigene), max: rund2(materialKosten.max + lohn + eigene) },
    flaechen: summe,
  };
}
