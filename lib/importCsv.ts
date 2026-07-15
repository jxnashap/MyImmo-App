// CSV-Import (C6 „Umzug von vermietet.de & Co."): reine Parse- und
// Zuordnungslogik ohne DB-Zugriff. Bewusst als Spalten-Mapping-Assistent
// gebaut statt eines hart codierten Fremdformat-Parsers — funktioniert damit
// mit Exporten aus vermietet.de, objego, Excel u. a. Prinzip wie überall:
// vorschlagen + bestätigen, importiert wird erst nach Nutzer-Bestätigung.

export type CsvTabelle = { headers: string[]; rows: string[][]; delimiter: string };

/**
 * CSV parsen: Trennzeichen (; , Tab) automatisch erkennen, Anführungszeichen
 * ("a;b", doppelte "" als Escape) und \r\n behandeln. Erste Zeile = Header.
 */
export function parseCsv(text: string): CsvTabelle {
  const inhalt = text.replace(/^﻿/, ""); // BOM (Excel-Export)
  const kandidaten = [";", ",", "\t"];
  const kopfzeile = inhalt.split(/\r?\n/, 1)[0] ?? "";
  // Trennzeichen: das mit den meisten Vorkommen AUSSERHALB von Quotes im Kopf.
  const zaehle = (d: string) => {
    let n = 0, inQ = false;
    for (const c of kopfzeile) {
      if (c === '"') inQ = !inQ;
      else if (c === d && !inQ) n++;
    }
    return n;
  };
  const delimiter = kandidaten.reduce((best, d) => (zaehle(d) > zaehle(best) ? d : best), ";");

  const zeilen: string[][] = [];
  let feld = "", zeile: string[] = [], inQ = false;
  const pushFeld = () => { zeile.push(feld); feld = ""; };
  const pushZeile = () => { pushFeld(); zeilen.push(zeile); zeile = []; };
  for (let i = 0; i < inhalt.length; i++) {
    const c = inhalt[i];
    if (inQ) {
      if (c === '"') {
        if (inhalt[i + 1] === '"') { feld += '"'; i++; } // Escape ""
        else inQ = false;
      } else feld += c;
    } else if (c === '"') inQ = true;
    else if (c === delimiter) pushFeld();
    else if (c === "\n") pushZeile();
    else if (c !== "\r") feld += c;
  }
  if (feld !== "" || zeile.length > 0) pushZeile();

  const nichtLeer = zeilen.filter((z) => z.some((f) => f.trim() !== ""));
  const headers = (nichtLeer[0] ?? []).map((h) => h.trim());
  return { headers, rows: nichtLeer.slice(1), delimiter };
}

// ---------------------------------------------------------- Feld-Definition --

export type ImportTyp = "objekte" | "mieter";

export type ImportFeld = {
  key: string;
  label: string;
  pflicht?: boolean;
  art: "text" | "zahl" | "datum";
  synonyme: string[]; // normalisierte Header-Namen für die Auto-Zuordnung
};

const norm = (s: string) =>
  s.toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");

export const IMPORT_FELDER: Record<ImportTyp, ImportFeld[]> = {
  objekte: [
    { key: "bezeichnung", label: "Bezeichnung / Name", pflicht: true, art: "text", synonyme: ["bezeichnung", "name", "objekt", "objektname", "immobilie", "einheit", "wohnung", "titel"] },
    { key: "adresse", label: "Adresse", art: "text", synonyme: ["adresse", "anschrift", "strasse", "strassehausnummer", "lage", "standort"] },
    { key: "typ", label: "Objekttyp", art: "text", synonyme: ["typ", "objekttyp", "art", "immobilientyp", "kategorie"] },
    { key: "kaufpreis", label: "Kaufpreis (€)", art: "zahl", synonyme: ["kaufpreis", "anschaffungskosten", "kaufsumme", "preis"] },
    { key: "kaufdatum", label: "Kaufdatum", art: "datum", synonyme: ["kaufdatum", "anschaffungsdatum", "erwerbsdatum", "kaufam"] },
    { key: "wert", label: "Aktueller Wert (€)", art: "zahl", synonyme: ["wert", "aktuellerwert", "marktwert", "verkehrswert"] },
    { key: "flaeche", label: "Wohnfläche (m²)", art: "zahl", synonyme: ["flaeche", "wohnflaeche", "qm", "m2", "groesse", "wohnflaecheqm", "flaecheqm", "flaechem2"] },
    { key: "baujahr", label: "Baujahr", art: "zahl", synonyme: ["baujahr", "bauj", "gebaut"] },
    { key: "miete", label: "Kaltmiete / Mo. (€)", art: "zahl", synonyme: ["miete", "kaltmiete", "nettomiete", "nettokaltmiete", "grundmiete", "mietemonat", "sollmiete"] },
    { key: "hausgeld", label: "Hausgeld / Mo. (€)", art: "zahl", synonyme: ["hausgeld", "wohngeld", "wegbeitrag"] },
    { key: "zimmer", label: "Zimmer", art: "zahl", synonyme: ["zimmer", "raeume", "zimmeranzahl", "anzahlzimmer"] },
  ],
  mieter: [
    { key: "vorname", label: "Vorname", art: "text", synonyme: ["vorname", "firstname"] },
    { key: "nachname", label: "Nachname", pflicht: true, art: "text", synonyme: ["nachname", "name", "mieter", "mietername", "lastname", "familienname"] },
    { key: "objekt", label: "Objekt (Name, für die Zuordnung)", art: "text", synonyme: ["objekt", "objektname", "immobilie", "wohnung", "einheit", "objektbezeichnung"] },
    { key: "einheit", label: "Einheit / Wohnungsnr.", art: "text", synonyme: ["einheit", "wohnungsnr", "whg", "wohnungsnummer", "lagebezeichnung"] },
    { key: "email", label: "E-Mail", art: "text", synonyme: ["email", "mail", "emailadresse"] },
    { key: "telefon", label: "Telefon", art: "text", synonyme: ["telefon", "tel", "telefonnummer", "handy", "mobil"] },
    { key: "kaltmiete", label: "Kaltmiete / Mo. (€)", art: "zahl", synonyme: ["kaltmiete", "miete", "nettomiete", "nettokaltmiete", "grundmiete"] },
    { key: "nk_vorauszahlung", label: "NK-Vorauszahlung / Mo. (€)", art: "zahl", synonyme: ["nkvorauszahlung", "nebenkosten", "nk", "betriebskosten", "vorauszahlung", "bkvorauszahlung", "nebenkostenvorauszahlung"] },
    { key: "kaution", label: "Kaution (€)", art: "zahl", synonyme: ["kaution", "mietkaution", "sicherheit"] },
    { key: "mietbeginn", label: "Mietbeginn", art: "datum", synonyme: ["mietbeginn", "einzug", "einzugsdatum", "vertragsbeginn", "beginn", "mietstart"] },
    { key: "mietende", label: "Mietende", art: "datum", synonyme: ["mietende", "auszug", "auszugsdatum", "vertragsende", "ende"] },
    { key: "flaeche", label: "Wohnfläche (m²)", art: "zahl", synonyme: ["flaeche", "wohnflaeche", "qm", "m2"] },
  ],
};

/** Auto-Zuordnung: Header → Feld-Key über normalisierte Synonyme. */
export function autoMap(headers: string[], typ: ImportTyp): Record<string, string> {
  const mapping: Record<string, string> = {}; // feldKey -> header
  const belegt = new Set<string>();
  for (const feld of IMPORT_FELDER[typ]) {
    for (const h of headers) {
      if (belegt.has(h)) continue;
      const nh = norm(h);
      if (feld.synonyme.some((syn) => nh === syn || nh.startsWith(syn))) {
        mapping[feld.key] = h;
        belegt.add(h);
        break;
      }
    }
  }
  return mapping;
}

// ---------------------------------------------------------- Wert-Konvertierung --

/** Deutsche/englische Zahl ("1.234,56", "1234.56", "1 200 €") → number | null. */
export function parseZahl(s: string | undefined): number | null {
  if (!s) return null;
  let t = s.replace(/[€\s]/g, "").trim();
  if (t === "") return null;
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ""); // 1.234 = tausender
  else t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** "31.12.2024", "2024-12-31", "31/12/2024" → ISO (YYYY-MM-DD) | null. */
export function parseDatum(s: string | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (m) {
    const jahr = m[3].length === 2 ? `20${m[3]}` : m[3];
    const monat = m[2].padStart(2, "0");
    const tag = m[1].padStart(2, "0");
    if (Number(monat) >= 1 && Number(monat) <= 12 && Number(tag) >= 1 && Number(tag) <= 31) {
      return `${jahr}-${monat}-${tag}`;
    }
  }
  return null;
}

export type ImportZeile = Record<string, string | number | null>;
export type ImportErgebnis = { zeilen: ImportZeile[]; fehler: string[] };

/** Zeilen anhand des Mappings in typisierte Datensätze wandeln + validieren. */
export function baueDatensaetze(
  tabelle: CsvTabelle,
  typ: ImportTyp,
  mapping: Record<string, string>, // feldKey -> header
): ImportErgebnis {
  const felder = IMPORT_FELDER[typ];
  const idx = new Map(tabelle.headers.map((h, i) => [h, i]));
  const fehler: string[] = [];
  const zeilen: ImportZeile[] = [];

  tabelle.rows.forEach((row, r) => {
    const rec: ImportZeile = {};
    let leer = true;
    for (const feld of felder) {
      const header = mapping[feld.key];
      const roh = header != null && idx.has(header) ? (row[idx.get(header)!] ?? "").trim() : "";
      if (roh !== "") leer = false;
      if (feld.art === "zahl") rec[feld.key] = parseZahl(roh);
      else if (feld.art === "datum") {
        const d = parseDatum(roh);
        if (roh !== "" && d == null) fehler.push(`Zeile ${r + 2}: „${roh}" ist kein gültiges Datum (${feld.label}).`);
        rec[feld.key] = d;
      } else rec[feld.key] = roh === "" ? null : roh;
    }
    if (leer) return; // komplett leere Zeile überspringen
    for (const feld of felder) {
      if (feld.pflicht && (rec[feld.key] == null || rec[feld.key] === "")) {
        fehler.push(`Zeile ${r + 2}: Pflichtfeld „${feld.label}" ist leer.`);
        return;
      }
    }
    zeilen.push(rec);
  });

  return { zeilen, fehler };
}
