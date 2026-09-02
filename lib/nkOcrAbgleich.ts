// Abgleich der ausgelesenen Hausverwaltungs-Abrechnung mit den beim Mieter
// bereits angelegten Umlagepositionen.
//
// Warum Abgleich statt Anhängen: Die angelegten Positionen sind die VORLAGE
// der Abrechnung — der Vermieter hat sie einmal strukturiert (Schlüssel,
// § 35a-Einordnung, HKVO-Daten). Ein Upload, der einfach neue Zeilen anfügt,
// erzeugt Dubletten und wirft die Struktur weg. Stattdessen: erkannte Beträge
// den vorhandenen Positionen zuordnen (Betrag aktualisieren), nur wirklich
// Neues als neue Position vorschlagen — und benennen, was im Dokument FEHLT
// (klassisch: die Grundsteuer, die kommt vom Finanzamt, nicht von der
// Hausverwaltung).

export type BestehendePosition = { id: string; bezeichnung: string; betrag: number | null };
export type ErkanntePosition = { name: string; gesamt: number | null; anteil: number | null };

export type Abgleich<T extends BestehendePosition = BestehendePosition> = {
  /** Erkannte Position passt zu einer vorhandenen → Betrag aktualisieren. */
  treffer: { vorhanden: T; erkannt: ErkanntePosition }[];
  /** Im Dokument, aber beim Mieter nicht angelegt → als neue Position vorschlagen. */
  neu: ErkanntePosition[];
  /** Beim Mieter angelegt, aber nicht im Dokument → Hinweis, Betrag selbst ergänzen. */
  fehlend: T[];
};

// Synonymgruppen: Hausverwaltungen benennen dieselbe Kostenart verschieden.
// Jede Gruppe ist eine Menge von Wortstämmen; zwei Bezeichnungen gelten als
// gleich, wenn sie in derselben Gruppe treffen. Bewusst Wortstämme statt
// vollständiger Wörter, damit „Müllabfuhr", „Müllgebühren" und „Abfallentsorgung"
// zusammenfinden.
// REIHENFOLGE IST BEDEUTSAM: gruppeVon nimmt den ersten Treffer. Spezifische
// Stämme müssen vor allgemeineren stehen — „Warmwasser" enthält „wasser" und
// würde sonst der Kaltwasser-Gruppe zugeschlagen; „Abwasser" ebenso.
const GRUPPEN: string[][] = [
  ["muell", "abfall", "restmuell", "biotonne"],
  ["abwasser", "entwaesserung", "kanal", "schmutzwasser", "sielgebuehr"],
  ["niederschlag", "regenwasser", "oberflaechenwasser"],
  ["warmwasser", "wassererwaermung"],
  ["wasser", "frischwasser", "kaltwasser", "wasserversorgung", "wassergeld"],
  ["heizung", "heizkosten", "waerme", "brennstoff", "fernwaerme", "gas", "heizoel"],
  ["versicherung", "gebaeudeversicherung", "sachversicherung", "haftpflicht", "elementar"],
  ["hausmeister", "hauswart", "hausbetreuung", "objektbetreuung"],
  ["allgemeinstrom", "hausstrom", "beleuchtung", "treppenhausstrom", "betriebsstrom"],
  ["aufzug", "fahrstuhl", "lift", "aufzugswartung"],
  ["garten", "gruenanlage", "aussenanlage", "gruenpflege"],
  ["strassenreinigung", "gehwegreinigung"],
  ["winterdienst", "schneeraeumung", "raeumdienst", "streudienst"],
  ["schornsteinfeger", "kaminkehrer", "kehrgebuehr"],
  ["hausreinigung", "treppenhausreinigung", "gebaeudereinigung", "unterhaltsreinigung"],
  ["grundsteuer"],
  ["kabel", "antenne", "sat", "breitband"],
  ["ungeziefer", "schaedling"],
  ["wartung", "rauchmelder", "rauchwarnmelder"],
];

/** Bezeichnung auf vergleichbare Form bringen: klein, ohne Umlaute/Sonderzeichen. */
export function normalisiere(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

function gruppeVon(norm: string): number | null {
  for (let g = 0; g < GRUPPEN.length; g++) {
    if (GRUPPEN[g].some((stamm) => norm.includes(stamm))) return g;
  }
  return null;
}

/**
 * Passt eine erkannte Bezeichnung zu einer vorhandenen? Erst exakter/Teil-
 * stringvergleich, dann Synonymgruppe. Sonderfall Wasser/Warmwasser: „wasser"
 * steckt in „warmwasser" — deshalb entscheidet die Gruppenzuordnung VOR dem
 * Teilstring, sonst würde Warmwasser dem Kaltwasser zugeordnet.
 */
export function passtZusammen(a: string, b: string): boolean {
  const na = normalisiere(a);
  const nb = normalisiere(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ga = gruppeVon(na);
  const gb = gruppeVon(nb);
  if (ga != null || gb != null) return ga === gb;
  return na.includes(nb) || nb.includes(na);
}

/** Erkannte Positionen den vorhandenen zuordnen (je Position höchstens ein Treffer). */
export function ordneZu<T extends BestehendePosition>(
  bestehend: T[],
  erkannt: ErkanntePosition[],
): Abgleich<T> {
  const treffer: Abgleich<T>["treffer"] = [];
  const neu: ErkanntePosition[] = [];
  const belegt = new Set<string>();

  for (const e of erkannt) {
    const kandidat = bestehend.find((v) => !belegt.has(v.id) && passtZusammen(v.bezeichnung, e.name));
    if (kandidat) {
      belegt.add(kandidat.id);
      treffer.push({ vorhanden: kandidat, erkannt: e });
    } else {
      neu.push(e);
    }
  }

  const fehlend = bestehend.filter((v) => !belegt.has(v.id));
  return { treffer, neu, fehlend };
}
