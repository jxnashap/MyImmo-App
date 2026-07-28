// Sortierung der Immobilien-Liste — rein und testbar.
// Der Wert steht in der URL-Query (?sort=…), damit die Serverseite die Liste
// direkt sortiert rendert (kein Client-State, teilbare Links).

export type SortObjekt = {
  bezeichnung: string;
  adresse?: string | null;
  typ?: string | null;
  wert?: number | null;
  kaufpreis?: number | null;
  miete?: number | null;
  flaeche?: number | null;
  baujahr?: number | null;
};

export const SORT_OPTIONEN = [
  { value: "name", label: "Name (A–Z)" },
  { value: "name_desc", label: "Name (Z–A)" },
  { value: "wert_desc", label: "Wert (hoch → niedrig)" },
  { value: "wert", label: "Wert (niedrig → hoch)" },
  { value: "miete_desc", label: "Miete (hoch → niedrig)" },
  { value: "miete", label: "Miete (niedrig → hoch)" },
  { value: "rendite_desc", label: "Rendite (hoch → niedrig)" },
  { value: "flaeche_desc", label: "Fläche (groß → klein)" },
  { value: "baujahr_desc", label: "Baujahr (neu → alt)" },
  { value: "baujahr", label: "Baujahr (alt → neu)" },
  { value: "typ", label: "Objekttyp" },
] as const;

export type SortWert = (typeof SORT_OPTIONEN)[number]["value"];

const istSort = (v: string | undefined): v is SortWert =>
  !!v && SORT_OPTIONEN.some((o) => o.value === v);

/** Wert eines Objekts: aktueller Wert, ersatzweise der Kaufpreis. */
const wertVon = (p: SortObjekt) => p.wert ?? p.kaufpreis ?? 0;

/** Bruttorendite in % — 0, wenn nicht bestimmbar (landet damit hinten). */
const renditeVon = (p: SortObjekt) => {
  const w = wertVon(p);
  return w > 0 && p.miete ? ((p.miete * 12) / w) * 100 : 0;
};

const nameCmp = (a: SortObjekt, b: SortObjekt) =>
  a.bezeichnung.localeCompare(b.bezeichnung, "de", { sensitivity: "base", numeric: true });

/**
 * Sortiert eine Kopie der Liste. Unbekannter/fehlender Wert → Name A–Z.
 * Zahlen-Sortierungen setzen fehlende Angaben ans Ende (nicht an den Anfang),
 * damit leere Felder die Liste nicht anführen; Gleichstand wird nach Name gelöst.
 */
export function sortiereObjekte<T extends SortObjekt>(liste: T[], sort?: string): T[] {
  const s: SortWert = istSort(sort) ? sort : "name";
  const kopie = [...liste];

  // absteigend: große Werte zuerst, fehlende (0) ans Ende
  const desc = (f: (p: SortObjekt) => number) => (a: T, b: T) => {
    const va = f(a), vb = f(b);
    if (va === vb) return nameCmp(a, b);
    if (va === 0) return 1;
    if (vb === 0) return -1;
    return vb - va;
  };
  // aufsteigend: kleine Werte zuerst, fehlende (0) trotzdem ans Ende
  const asc = (f: (p: SortObjekt) => number) => (a: T, b: T) => {
    const va = f(a), vb = f(b);
    if (va === vb) return nameCmp(a, b);
    if (va === 0) return 1;
    if (vb === 0) return -1;
    return va - vb;
  };

  switch (s) {
    case "name_desc": return kopie.sort((a, b) => nameCmp(b, a));
    case "wert_desc": return kopie.sort(desc(wertVon));
    case "wert": return kopie.sort(asc(wertVon));
    case "miete_desc": return kopie.sort(desc((p) => p.miete ?? 0));
    case "miete": return kopie.sort(asc((p) => p.miete ?? 0));
    case "rendite_desc": return kopie.sort(desc(renditeVon));
    case "flaeche_desc": return kopie.sort(desc((p) => p.flaeche ?? 0));
    case "baujahr_desc": return kopie.sort(desc((p) => p.baujahr ?? 0));
    case "baujahr": return kopie.sort(asc((p) => p.baujahr ?? 0));
    case "typ": return kopie.sort((a, b) => (a.typ ?? "").localeCompare(b.typ ?? "", "de") || nameCmp(a, b));
    default: return kopie.sort(nameCmp);
  }
}
