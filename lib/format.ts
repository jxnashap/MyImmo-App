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

// Prozent deutsch: „4,4 %" (Komma, geschütztes Leerzeichen vor %).
// Ersetzt die verstreuten `toFixed(1) + "%"`-Stellen mit Dezimalpunkt.
export const prozent = (n: number | null | undefined, dez = 1) =>
  n == null || !Number.isFinite(n)
    ? "—"
    : `${n.toLocaleString("de-DE", { minimumFractionDigits: dez, maximumFractionDigits: dez })} %`;

// Zahl deutsch mit fester Nachkommastellen-Zahl: „19,4", „1.400".
export const zahl = (n: number | null | undefined, dez = 0) =>
  n == null || !Number.isFinite(n)
    ? "—"
    : n.toLocaleString("de-DE", { minimumFractionDigits: dez, maximumFractionDigits: dez });

// Stunde (0–23) in deutscher Zeit — unabhängig davon, in welcher Zone der
// Server läuft (Vercel = UTC).
//
// ACHTUNG, Falle: `Intl…({hour:"numeric",hour12:false}).format()` liefert in
// de-DE den String „11 Uhr" — `Number("11 Uhr")` ist NaN. Genau daran ist die
// Dashboard-Begrüßung gescheitert: Beide Vergleiche gegen NaN sind false,
// also stand dort rund um die Uhr „Guten Abend". Deshalb formatToParts.
export function stundeInDE(jetzt: Date = new Date()): number {
  const teil = new Intl.DateTimeFormat("de-DE", { hour: "numeric", hour12: false, timeZone: "Europe/Berlin" })
    .formatToParts(jetzt)
    .find((p) => p.type === "hour");
  const h = Number(teil?.value);
  return Number.isFinite(h) ? h % 24 : 12; // im Zweifel neutral „Guten Tag"
}

// Tageszeit-Begrüßung fürs Dashboard.
export function begruessung(jetzt: Date = new Date()): "Guten Morgen" | "Guten Tag" | "Guten Abend" {
  const h = stundeInDE(jetzt);
  if (h < 11) return "Guten Morgen";
  if (h < 18) return "Guten Tag";
  return "Guten Abend";
}
