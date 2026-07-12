export const eur = (n: number | null | undefined) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(n);

export const eur2 = (n: number | null | undefined) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
      }).format(n);

// „€ 860.000" — Schreibweise wie in der ursprünglichen App (Symbol vorne, gerundet)
export const euro = (n: number | null | undefined) =>
  n == null
    ? "–"
    : "€ " + new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(Math.round(n));

// Datum „2008-08-02" -> „2.8.2008" (de-DE, ohne führende Nullen).
// Reine Datums-Strings werden OHNE Date-Objekt zerlegt — new Date("YYYY-MM-DD")
// parst als UTC-Mitternacht und zeigt in Zeitzonen westlich von UTC (Nutzer im
// Ausland!) den Vortag an.
export const datum = (d: string | null | undefined) => {
  if (!d) return "—";
  const nurDatum = d.match(/^(\d{4})-(\d{2})-(\d{2})$/); // nur reine date-Spalten, keine Timestamps
  if (nurDatum) {
    return `${Number(nurDatum[3])}.${Number(nurDatum[2])}.${nurDatum[1]}`;
  }
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
};

// Adresse in Briefzeilen zerlegen: Straße + Hausnummer in eine Zeile,
// PLZ + Ort in die nächste. Akzeptiert „Str. 1, 23626 Ort", „Str. 1 23626 Ort"
// oder bereits zeilenweise eingegebene Adressen.
export function adressZeilen(addr: string | null | undefined): string[] {
  if (!addr) return [];
  const segmente = addr
    .split(/\r?\n|,\s*/)
    .map((z) => z.trim())
    .filter(Boolean);
  const zeilen: string[] = [];
  for (const seg of segmente) {
    // PLZ (4–5 Ziffern) gefolgt vom Ort innerhalb desselben Segments abtrennen.
    const m = seg.match(/^(.*\S)\s+(\d{4,5}\s+\S.*)$/);
    if (m) {
      zeilen.push(m[1].trim(), m[2].trim());
    } else {
      zeilen.push(seg);
    }
  }
  return zeilen;
}

// Umlagefähigkeit nach BetrKV §2 — wie in der alten App
export function istUmlagefaehig(kat: string | null): "ja" | "nein" | "unklar" {
  // Voll umlagefähige BetrKV-§2-Kategorien. Hinweis: "Versicherung" meint Sach-/Haftpflicht.
  const ja = ["Grundsteuer", "Versicherung", "Müll", "Abwasser", "Wasser", "Hausmeister", "Aufzug", "Allgemeinstrom", "Gartenpflege", "Straßenreinigung"];
  const nein = ["Reparatur", "Instandhaltung", "Verwaltung", "Makler"];
  // "Hausgeld / WEG" bewusst NICHT hier: enthält nicht-umlagefähige Anteile
  // (Verwaltung + Instandhaltungsrücklage, § 1 Abs. 2 BetrKV) → muss aufgeteilt/geprüft werden.
  if (!kat) return "unklar";
  if (ja.includes(kat)) return "ja";
  if (nein.includes(kat)) return "nein";
  return "unklar";
}
