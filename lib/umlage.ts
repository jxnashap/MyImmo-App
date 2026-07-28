// Nebenkosten-Verteiler — reine Berechnungslogik (ohne Abhängigkeiten).
// Verteilt Gesamtkosten je Position nach Flächenanteil (m²) oder zu gleichen
// Teilen je Einheit auf die Mieter. Optional zeitanteilig nach belegten Monaten
// (für unterjährige Mieterwechsel). Geteilt zwischen Live-Vorschau (Client) und
// Server-Action, damit Anzeige und gespeicherte Werte identisch sind.

export type UmlageSchluessel = "flaeche" | "gleich";

// § 35a EStG: Einordnung des Arbeits-/Lohnkostenanteils einer Position.
export type Art35a = "" | "haushaltsnah" | "handwerker";

export type UmlageZeile = {
  bezeichnung: string;
  betrag: number; // Gesamtbetrag der Position
  schluessel: UmlageSchluessel;
  lohnanteil?: number; // davon Arbeits-/Lohnkosten (§ 35a), 0 = keiner
  art35a?: Art35a;     // haushaltsnah | handwerker | "" (kein Ausweis)
};

export type UmlageMieter = {
  id: string;
  name: string;
  flaeche: number; // m²
  monate?: number; // belegte Monate im Abrechnungsjahr (0..12) — nur für die Anzeige
  /**
   * Belegte KALENDERTAGE im Abrechnungsjahr. Maßgeblich für die Verteilung.
   *
   * Vorher gewichtete der Verteiler nach Monaten, während die daraus erzeugte
   * NK-Abrechnung ('zeit'-Positionen, lib/nk.ts) tagesgenau rechnete. Ein
   * Einzug am 20.03. ergab im Verteiler 10/12 = 83,3 %, in der Abrechnung
   * 287/365 = 78,6 % derselben Kostenart — je nach gewähltem Weg ein anderes
   * Ergebnis für denselben Mieter. Beide Wege rechnen jetzt tagesgenau.
   */
  tage?: number;
};

export type UmlageOptions = {
  zeitanteilig: boolean;
  /** Kalendertage des Abrechnungsjahres (365/366) — Bezugsgröße der Gewichtung. */
  jahresTage?: number;
  referenzFlaeche?: number; // Gesamtwohnfläche des Objekts (für zeitanteilige Verteilung)
  // Zahl der Wohneinheiten (für den "gleich"-Schlüssel beim Zeitanteiligen):
  // Bei einem Mieterwechsel in derselben Wohnung gibt es MEHR Mieter-Datensätze
  // als Einheiten — die Referenz muss die Einheiten zählen, sonst gilt eine
  // ganzjährig belegte Wohnung fälschlich als halb leer.
  anzahlEinheiten?: number;
};

export type UmlageAnteil = {
  bezeichnung: string;
  schluessel: string; // gespeicherter Umlageschlüssel: "Fläche" | "Einheit"
  betrag: number;
  lohnanteil?: number; // anteiliger § 35a-Arbeitskostenanteil dieses Mieters
  art35a?: Art35a;
};

export type UmlageErgebnisMieter = {
  id: string;
  name: string;
  flaeche: number;
  monate: number;
  anteilProzent: number; // Flächenanteil in %
  positionen: UmlageAnteil[];
  summe: number;
};

export type UmlageErgebnis = {
  perMieter: UmlageErgebnisMieter[];
  totalFlaeche: number;
  zeilenSummen: number[]; // tatsächlich umgelegter Betrag je Zeile
  zeilenNichtUmgelegt: number[]; // wegen Leerstand nicht umgelegter Betrag je Zeile
  gesamt: number;
  nichtUmgelegt: number; // Summe nicht umgelegt (Leerstand)
};

// Ein-/Ausgabe der Server-Action (hier definiert, da "use server"-Dateien
// nur async Funktionen exportieren dürfen).
export type VerteilenInput = {
  propId: string;
  jahr: number;
  zeitanteilig: boolean;
  zeilen: UmlageZeile[];
  mieter: { id: string; flaeche: number }[];
};

export type VerteilenErgebnis = {
  ok: boolean;
  positionen: number; // Anzahl geschriebener Positionen
  mieter: number; // Anzahl belieferter Mieter
  gesamt: number; // verteilte Gesamtsumme
  nichtUmgelegt: number; // nicht umgelegt (Leerstand)
  fehler?: string;
};

/** Schlüssel-Mapping in die gespeicherte Bezeichnung (mieter_positionen.umlageschluessel). */
export function schluesselLabel(s: UmlageSchluessel): string {
  return s === "gleich" ? "Einheit" : "Fläche";
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const monateVon = (m: UmlageMieter) =>
  m.monate == null ? 12 : Math.max(0, Math.min(12, m.monate));

const tageVon = (m: UmlageMieter, jahresTage: number) =>
  Math.max(0, Math.min(jahresTage, m.tage ?? 0));

/**
 * Verteilt einen Betrag cent-genau anhand von Gewichten.
 * Rundungsrest (Cents) wird per größtem Nachkommarest vergeben, sodass die
 * Summe der Anteile exakt dem Ausgangsbetrag entspricht.
 */
export function verteileBetrag(betrag: number, gewichte: number[]): number[] {
  const n = gewichte.length;
  if (n === 0) return [];
  const summe = gewichte.reduce((a, b) => a + (b > 0 ? b : 0), 0);
  if (summe <= 0) return gewichte.map(() => 0);

  const cents = Math.round(betrag * 100);
  const roh = gewichte.map((g) => (cents * (g > 0 ? g : 0)) / summe);
  const floor = roh.map((r) => Math.floor(r));
  const verteilt = floor.reduce((a, b) => a + b, 0);
  let rest = cents - verteilt;

  const reihenfolge = roh
    .map((r, i) => ({ i, f: r - Math.floor(r) }))
    .sort((a, b) => b.f - a.f);

  const res = floor.slice();
  let k = 0;
  while (rest > 0 && reihenfolge.length > 0) {
    res[reihenfolge[k % reihenfolge.length].i] += 1;
    rest -= 1;
    k += 1;
  }
  return res.map((c) => c / 100);
}

/** Berechnet die komplette Verteilung über alle Positionen und Mieter. */
export function berechneUmlage(
  zeilen: UmlageZeile[],
  mieter: UmlageMieter[],
  opts: UmlageOptions = { zeitanteilig: false },
): UmlageErgebnis {
  const zeitanteilig = opts.zeitanteilig;
  const jahresTage = (opts.jahresTage ?? 0) > 0 ? (opts.jahresTage as number) : 365;
  // Tagesgenau nur, wenn für JEDEN Mieter Tage vorliegen. Sonst monatsweise
  // wie bisher — eine Mischung aus beidem wäre schlechter als beide Verfahren
  // einzeln, weil sich die Bezugsgrößen nicht decken.
  const tagesgenau = mieter.length > 0 && mieter.every((m) => m.tage != null);
  const zeitEinheit = tagesgenau ? jahresTage : 12;
  const zeitVon = (m: UmlageMieter) => (tagesgenau ? tageVon(m, jahresTage) : monateVon(m));
  const sumFlaeche = mieter.reduce((s, m) => s + (m.flaeche > 0 ? m.flaeche : 0), 0);
  // Referenzfläche fürs Zeitanteilige: die Gesamtwohnfläche des Objekts, wenn
  // hinterlegt — sie zählt jede Einheit genau EINMAL und ist daher bei einem
  // Mieterwechsel in derselben Wohnung korrekt (die Summe der Mieterflächen
  // würde die Wohnung doppelt zählen). Ist keine hinterlegt, dient die Summe
  // der Mieterflächen als Näherung. Über-Verteilung ist durch die faktor-
  // Kappung (min(1, …)) ohnehin ausgeschlossen.
  const referenzFlaeche = (opts.referenzFlaeche ?? 0) > 0 ? (opts.referenzFlaeche as number) : sumFlaeche;
  const anzahl = (opts.anzahlEinheiten ?? 0) > 0 ? (opts.anzahlEinheiten as number) : mieter.length;

  const perMieter: UmlageErgebnisMieter[] = mieter.map((m) => ({
    id: m.id,
    name: m.name,
    flaeche: m.flaeche,
    monate: monateVon(m),
    anteilProzent: sumFlaeche > 0 ? ((m.flaeche > 0 ? m.flaeche : 0) / sumFlaeche) * 100 : 0,
    positionen: [],
    summe: 0,
  }));

  const zeilenSummen: number[] = [];
  const zeilenNichtUmgelegt: number[] = [];

  for (const z of zeilen) {
    const istFlaeche = z.schluessel !== "gleich";
    const basis = istFlaeche
      ? mieter.map((m) => (m.flaeche > 0 ? m.flaeche : 0))
      : mieter.map(() => 1);
    const gewichte = zeitanteilig ? basis.map((b, i) => b * zeitVon(mieter[i])) : basis;
    const sumGew = gewichte.reduce((a, b) => a + b, 0);

    let allocated: number;
    if (zeitanteilig) {
      const referenz = istFlaeche ? referenzFlaeche * zeitEinheit : anzahl * zeitEinheit;
      const faktor = referenz > 0 ? Math.min(1, sumGew / referenz) : 0;
      allocated = r2(z.betrag * faktor);
    } else {
      allocated = z.betrag;
    }

    const anteile = verteileBetrag(allocated, gewichte);
    // Tatsächlich verteilte Summe (kann 0 sein, wenn alle Gewichte 0 sind, z.B.
    // Flächen-Schlüssel ohne hinterlegte Mieterflächen). Der Rest gilt dann als
    // nicht umgelegt, statt still zu verschwinden.
    const verteilt = r2(anteile.reduce((a, b) => a + b, 0));
    zeilenSummen.push(verteilt);
    zeilenNichtUmgelegt.push(r2(z.betrag - verteilt));

    // § 35a: Lohnanteil mit denselben Gewichten und derselben (zeitanteiligen)
    // Skalierung verteilen — capped auf den umgelegten Betrag der Position.
    const lohnGesamt = Math.min(z.lohnanteil ?? 0, z.betrag > 0 ? z.betrag : 0);
    const lohnAllocated = z.betrag > 0 ? r2(lohnGesamt * (allocated / z.betrag)) : 0;
    const lohnAnteile = lohnAllocated > 0 ? verteileBetrag(lohnAllocated, gewichte) : gewichte.map(() => 0);

    anteile.forEach((a, i) => {
      perMieter[i].positionen.push({
        bezeichnung: z.bezeichnung,
        schluessel: schluesselLabel(z.schluessel),
        betrag: a,
        lohnanteil: lohnAnteile[i] || 0,
        art35a: z.art35a || undefined,
      });
      perMieter[i].summe = r2(perMieter[i].summe + a);
    });
  }

  const gesamt = r2(perMieter.reduce((s, m) => s + m.summe, 0));
  const nichtUmgelegt = r2(zeilenNichtUmgelegt.reduce((a, b) => a + b, 0));

  return { perMieter, totalFlaeche: sumFlaeche, zeilenSummen, zeilenNichtUmgelegt, gesamt, nichtUmgelegt };
}

// ---------------------------------------------------------------------------
// Sichtbarkeit des Nebenkosten-Verteilers
// ---------------------------------------------------------------------------
// Der Verteiler teilt Gesamtkosten auf MEHRERE Mietparteien auf. Bei einer
// einzelnen Einheit (ETW, EFH) gibt es nichts zu verteilen — dort landen die
// Kosten ohnehin vollständig beim einzigen Mieter. Deshalb wird das Werkzeug
// nur angeboten, wenn das Objekt tatsächlich mehrere Parteien hat.
//
// Wichtig: Das betrifft NUR den Verteiler. Die Frage, welche Kosten
// umlagefähig sind (BetrKV), und die NK-Abrechnung je Mieter gibt es
// unverändert für jeden Objekttyp — auch für die ETW.

/** Objekttypen, die von Haus aus mehrere Einheiten haben. */
export const MEHRPARTEIEN_TYPEN = ["Mehrfamilienhaus", "Garagenkomplex"];

export function zeigeVerteiler(p: {
  typ?: string | null;
  einheiten_anzahl?: number | null;
  mieterAnzahl?: number;
}): boolean {
  if (MEHRPARTEIEN_TYPEN.includes(p.typ ?? "")) return true;
  if ((p.einheiten_anzahl ?? 0) > 1) return true;
  return (p.mieterAnzahl ?? 0) > 1;
}
