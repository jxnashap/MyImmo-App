// DATEV-Export (D3): Buchungsstapel im DATEV-Format EXTF (Format-Kategorie 21).
// Reine Formatlogik ohne DB. Erzeugt eine importierbare CSV mit Kopfzeile
// (Metadaten), Spaltenüberschriften und Buchungszeilen.
//
// WICHTIG: Die Kontenzuordnung nutzt eine Standard-SKR03-Vorlage. Private
// Vermietung ist keine Buchführung — der Export dient der Übergabe an die
// Steuerkanzlei, die den Kontenrahmen final zuordnet. Keine Steuerberatung.

export type DatevBuchung = {
  buchungsdatum: string; // YYYY-MM-DD
  betrag: number;        // > 0
  konto: number;         // Sachkonto (Erlös/Aufwand)
  gegenkonto: number;    // i. d. R. Bank
  sollHaben: "S" | "H";  // Buchung auf Soll oder Haben des Kontos
  belegfeld: string;     // Beleg-/Objektreferenz
  buchungstext: string;
};

export type DatevQuelleEinnahme = { buchungsdatum: string | null; betrag: number | null; kategorie: string | null; beschreibung?: string | null; prop_id: string | null };
export type DatevQuelleKosten = { buchungsdatum: string | null; betrag: number | null; kategorie: string | null; beschreibung?: string | null; prop_id: string | null };

// Gegenkonto (Geldkonto) — Bank nach SKR03.
export const DATEV_GEGENKONTO = 1200;

// SKR03-Sachkonten je Kategorie (Standardvorlage, von der Kanzlei anpassbar).
export const SKR03_EINNAHMEN: Record<string, number> = {
  Miete: 8100,                    // Erlöse
  Nebenkostenabrechnung: 8105,    // Erlöse Nebenkosten
  Kaution: 1600,                  // durchlaufender Posten / Verbindlichkeit
  Sonstiges: 8200,
};
export const SKR03_KOSTEN: Record<string, number> = {
  Reparatur: 4260,          // Instandhaltung
  Instandhaltung: 4260,
  Modernisierung: 4260,
  Verwaltung: 4900,         // sonstige Kosten
  Versicherung: 4360,       // Versicherungen
  Grundsteuer: 4340,        // sonstige Grundstücksaufwendungen
  "Hausgeld / WEG": 4260,
  Makler: 4900,
  Sonstiges: 4900,
};
const DEFAULT_ERLOES = 8200;
const DEFAULT_AUFWAND = 4900;

const kontoEinnahme = (kat: string | null) => SKR03_EINNAHMEN[kat ?? ""] ?? DEFAULT_ERLOES;
const kontoKosten = (kat: string | null) => SKR03_KOSTEN[kat ?? ""] ?? DEFAULT_AUFWAND;

/** Einnahmen/Kosten eines Jahres in DATEV-Buchungen wandeln. */
export function baueDatevBuchungen(
  jahr: number,
  einnahmen: DatevQuelleEinnahme[],
  kosten: DatevQuelleKosten[],
  propName: (id: string | null) => string,
): DatevBuchung[] {
  const imJahr = (d: string | null) => !!d && d.slice(0, 4) === String(jahr);
  const buchungen: DatevBuchung[] = [];

  for (const e of einnahmen) {
    const betrag = Number(e.betrag) || 0;
    if (!imJahr(e.buchungsdatum) || !(betrag > 0)) continue;
    buchungen.push({
      buchungsdatum: e.buchungsdatum!,
      betrag,
      konto: kontoEinnahme(e.kategorie),  // Erlöskonto
      gegenkonto: DATEV_GEGENKONTO,       // Bank
      sollHaben: "H",                     // Ertrag → Haben
      belegfeld: propName(e.prop_id).slice(0, 36),
      buchungstext: `${e.kategorie ?? "Einnahme"}${e.beschreibung ? " " + e.beschreibung : ""}`.slice(0, 60),
    });
  }
  for (const k of kosten) {
    const betrag = Number(k.betrag) || 0;
    if (!imJahr(k.buchungsdatum) || !(betrag > 0)) continue;
    buchungen.push({
      buchungsdatum: k.buchungsdatum!,
      betrag,
      konto: kontoKosten(k.kategorie),    // Aufwandskonto
      gegenkonto: DATEV_GEGENKONTO,       // Bank
      sollHaben: "S",                     // Aufwand → Soll
      belegfeld: propName(k.prop_id).slice(0, 36),
      buchungstext: `${k.kategorie ?? "Kosten"}${k.beschreibung ? " " + k.beschreibung : ""}`.slice(0, 60),
    });
  }
  return buchungen.sort((a, b) => a.buchungsdatum.localeCompare(b.buchungsdatum));
}

// ------------------------------------------------------------- EXTF bauen ----

const q = (s: string) => `"${String(s ?? "").replace(/"/g, "")}"`;
const betragDe = (n: number) => n.toFixed(2).replace(".", ",");
const ddmm = (iso: string) => `${iso.slice(8, 10)}${iso.slice(5, 7)}`; // DDMM (Jahr aus WJ)
const yyyymmdd = (iso: string) => iso.slice(0, 10).replace(/-/g, "");

export type DatevMeta = {
  jahr: number;
  berater?: number;   // DATEV-Beraternummer (leer → Kanzlei setzt Bestand beim Import)
  mandant?: number;   // DATEV-Mandantennummer
  bezeichnung?: string;
  zeitstempel: string; // 17-stellig YYYYMMDDHHMMSSFFF (injizierbar → testbar)
};

/**
 * Vollständiger EXTF-Buchungsstapel als String (Semikolon, CRLF, mit UTF-8-BOM).
 * Kopfzeile (31 Felder) + 14 Standard-Spalten des Buchungsstapels.
 */
export function baueDatevExtf(buchungen: DatevBuchung[], meta: DatevMeta): string {
  const wjBeginn = `${meta.jahr}0101`;
  const datumVon = buchungen.length ? yyyymmdd(buchungen[0].buchungsdatum) : wjBeginn;
  const datumBis = buchungen.length ? yyyymmdd(buchungen[buchungen.length - 1].buchungsdatum) : `${meta.jahr}1231`;

  // Kopfzeile: 31 Felder gem. DATEV-Formatbeschreibung (Buchungsstapel, Kat. 21).
  const header = [
    q("EXTF"), "700", "21", q("Buchungsstapel"), "13",
    meta.zeitstempel, "", q(""), q(""), q(""),
    meta.berater != null ? String(meta.berater) : "", meta.mandant != null ? String(meta.mandant) : "",
    wjBeginn, "4", datumVon, datumBis,
    q((meta.bezeichnung ?? `MyImmo ${meta.jahr}`).slice(0, 30)), q(""), "1", "0",
    "0", q("EUR"), "", "", "", "", "", "", "", "", "",
  ].join(";");

  const spalten = [
    "Umsatz (ohne Soll/Haben-Kz)", "Soll/Haben-Kennzeichen", "WKZ Umsatz", "Kurs",
    "Basis-Umsatz", "WKZ Basis-Umsatz", "Konto", "Gegenkonto (ohne BU-Schlüssel)",
    "BU-Schlüssel", "Belegdatum", "Belegfeld 1", "Belegfeld 2", "Skonto", "Buchungstext",
  ].map(q).join(";");

  const zeilen = buchungen.map((b) =>
    [
      betragDe(b.betrag), q(b.sollHaben), q("EUR"), "", "", "",
      String(b.konto), String(b.gegenkonto), "", ddmm(b.buchungsdatum),
      q(b.belegfeld), q(""), "", q(b.buchungstext),
    ].join(";"),
  );

  return "﻿" + [header, spalten, ...zeilen].join("\r\n") + "\r\n";
}
