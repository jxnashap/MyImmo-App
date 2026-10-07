// Nebenkosten je OBJEKT und Jahr (Stufe 1, 07.10.2026, docs/zukunft/NK-NEU.md).
//
// Jede Kostenart steht EINMAL mit dem Gesamtbetrag des Hauses; der Schlüssel hängt an der
// Kostenart; diese Funktion verteilt cent-genau auf die Mieter. Was keinem Mieter zufällt
// (Leerstand, fehlende Angaben, Rest bei „Betrag je Wohnung“), bleibt beim Vermieter — die
// Summe aller Anteile plus Vermieteranteil ist immer genau der Gesamtbetrag.
//
// Reine Rechnung ohne Datenbank: dieselbe Funktion speist die Übersicht am Objekt, die
// Abrechnung des einzelnen Mieters (lib/nk.ts, Aufteilung „objekt“) und das PDF.

import { belegung, jahresTage } from "@/lib/nk";
import { verteileBetrag } from "@/lib/umlage";
import { zahlDe } from "@/lib/zahl";

export const NK_SCHLUESSEL = ["flaeche", "personen", "einheiten", "mea", "verbrauch", "direkt"] as const;
export type NkSchluessel = (typeof NK_SCHLUESSEL)[number];

export const SCHLUESSEL_LABEL: Record<NkSchluessel, string> = {
  flaeche: "Wohnfläche",
  personen: "Personen",
  einheiten: "Wohneinheiten",
  mea: "Miteigentumsanteile",
  verbrauch: "Verbrauch",
  direkt: "Betrag je Wohnung",
};

export const istSchluessel = (s: unknown): s is NkSchluessel =>
  typeof s === "string" && (NK_SCHLUESSEL as readonly string[]).includes(s);

/** Eine Kostenart des Hauses (Tabelle nk_objekt_kosten). */
export type NkObjektKosten = {
  id: string;
  bezeichnung: string;
  betrag: number;
  schluessel: NkSchluessel;
  umlagefaehig: boolean;
  lohnanteil?: number | null;
  art_35a?: string | null;
  /** Nur „verbrauch“: Gesamtverbrauch des Hauses laut Hauptzähler (inkl. Leerstand). */
  nenner?: number | null;
  /** „verbrauch“: Verbrauch je Mieter · „direkt“: Betrag je Mieter. Schlüssel = Mieter-ID. */
  werte?: Record<string, number> | null;
};

/** Grundlagen des Hauses für das Jahr (Tabelle nk_objekt_jahr). */
export type NkObjektBasis = {
  flaeche_gesamt: number | null;
  einheiten: number | null;
  mea_gesamt: number | null;
  /** Je Mieter-ID: Personen und Miteigentumsanteile seiner Wohnung. */
  mieter?: Record<string, { personen?: number | null; mea?: number | null }> | null;
};

export type NkObjektMieter = {
  id: string;
  name: string;
  flaeche: number | null;
  mietbeginn: string | null;
  mietende: string | null;
};

export type NkAnteil = { betrag: number; faktorText: string };

export type NkVerteilteKosten = {
  kosten: NkObjektKosten;
  /** Anteil je Mieter-ID (nur Mieter mit Belegung im Jahr). */
  anteile: Record<string, NkAnteil>;
  /** Bleibt beim Vermieter (Leerstand, Rest). */
  vermieter: number;
  /** Grund, warum die Position nicht (vollständig) verteilt werden konnte. */
  warnung?: string;
};

export type NkObjektErgebnis = {
  jahr: number;
  jahresTage: number;
  /** Mieter mit Belegung im Jahr, mit ihren Tagen. */
  mieter: (NkObjektMieter & { tage: number; monate: number })[];
  positionen: NkVerteilteKosten[];
  summeMieter: Record<string, number>;
  summeVermieter: number;
  summeGesamt: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const zahl = (n: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 }).format(n);
const pos = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0);

/**
 * Voreingestellter Schlüssel einer Kostenart. Gesetzlicher Regelfall ist die Wohnfläche
 * (§ 556a Abs. 1 BGB); Heiz- und Warmwasserkosten kommen beim Mehrfamilienhaus fast immer
 * schon je Wohnung vom Messdienst (Stufe 2 rechnet die HeizkostenV selbst).
 */
export function standardSchluessel(bezeichnung: string): NkSchluessel {
  const b = bezeichnung.toLowerCase();
  if (/heiz|warmwasser|wärme|waerme|fernwärme|fernwaerme/.test(b)) return "direkt";
  return "flaeche";
}

/**
 * Verteilt alle Kosten des Hauses für ein Jahr. Zeitanteilig nach Kalendertagen der Belegung
 * (wie lib/nk.ts); Leerstand bleibt beim Vermieter (BGH VIII ZR 159/05), weil der Nenner das
 * GANZE Haus über das GANZE Jahr ist und nicht die Summe der belegten Wohnungen.
 */
export function verteileObjektKosten(
  jahr: number,
  basis: NkObjektBasis,
  kosten: NkObjektKosten[],
  mieterAlle: NkObjektMieter[],
): NkObjektErgebnis {
  const JT = jahresTage(jahr);
  const mieter = mieterAlle
    .map((m) => ({ ...m, ...belegung(jahr, m.mietbeginn, m.mietende) }))
    .filter((m) => m.tage > 0);
  const ganz = (t: number) => t >= JT;
  const tageText = (t: number) => (ganz(t) ? "" : ` × ${t}/${JT} Tage`);
  const proMieter = basis.mieter ?? {};

  const positionen: NkVerteilteKosten[] = kosten.map((k) => {
    const betrag = r2(pos(k.betrag));
    const leer = (warnung?: string): NkVerteilteKosten => ({ kosten: k, anteile: {}, vermieter: betrag, warnung });
    if (!k.umlagefaehig) return { kosten: k, anteile: {}, vermieter: betrag };
    if (mieter.length === 0) return leer();

    // „Betrag je Wohnung“: der Mieter trägt genau seinen Betrag (z. B. aus der Heizkosten-
    // abrechnung des Messdienstes). Ein Rest bleibt beim Vermieter; mehr als der Gesamtbetrag
    // wird nicht verteilt.
    if (k.schluessel === "direkt") {
      const werte = mieter.map((m) => r2(pos(k.werte?.[m.id])));
      const summe = r2(werte.reduce((a, b) => a + b, 0));
      if (summe > betrag + 0.005) {
        return leer(`${k.bezeichnung}: Die Beträge je Wohnung (${zahl(summe)} €) sind höher als der Gesamtbetrag (${zahl(betrag)} €) — nicht verteilt.`);
      }
      const anteile: Record<string, NkAnteil> = {};
      mieter.forEach((m, i) => { anteile[m.id] = { betrag: werte[i], faktorText: "Betrag laut Einzelabrechnung" }; });
      const fehlt = mieter.filter((m) => !(pos(k.werte?.[m.id]) > 0)).map((m) => m.name);
      return {
        kosten: k, anteile, vermieter: r2(betrag - summe),
        warnung: fehlt.length ? `${k.bezeichnung}: Für ${fehlt.join(", ")} ist kein Betrag eingetragen.` : undefined,
      };
    }

    let gewichte: number[];
    let nenner: number;
    let text: (i: number) => string;
    let fehlt: string | undefined;

    if (k.schluessel === "flaeche") {
      const fg = pos(basis.flaeche_gesamt);
      gewichte = mieter.map((m) => pos(m.flaeche) * m.tage);
      nenner = fg * JT;
      text = (i) => `${zahl(pos(mieter[i].flaeche))}/${zahl(fg)} m²${tageText(mieter[i].tage)}`;
      if (!fg) fehlt = "Die Gesamtwohnfläche des Hauses fehlt";
      const ohne = mieter.filter((m) => !pos(m.flaeche)).map((m) => m.name);
      if (!fehlt && ohne.length) fehlt = `Wohnfläche fehlt bei ${ohne.join(", ")} (Anteil bleibt beim Vermieter)`;
    } else if (k.schluessel === "einheiten") {
      const n = pos(basis.einheiten);
      gewichte = mieter.map((m) => m.tage);
      nenner = n * JT;
      text = (i) => `1/${zahl(n)} Einheiten${tageText(mieter[i].tage)}`;
      if (!n) fehlt = "Die Zahl der Wohneinheiten fehlt";
    } else if (k.schluessel === "mea") {
      const g = pos(basis.mea_gesamt);
      const mea = (id: string) => pos(proMieter[id]?.mea);
      gewichte = mieter.map((m) => mea(m.id) * m.tage);
      nenner = g * JT;
      text = (i) => `${zahl(mea(mieter[i].id))}/${zahl(g)} MEA${tageText(mieter[i].tage)}`;
      if (!g) fehlt = "Die Miteigentumsanteile gesamt fehlen";
      const ohne = mieter.filter((m) => !mea(m.id)).map((m) => m.name);
      if (!fehlt && ohne.length) fehlt = `MEA fehlen bei ${ohne.join(", ")} (Anteil bleibt beim Vermieter)`;
    } else if (k.schluessel === "personen") {
      // Personentage. Eine leerstehende Wohnung zählt mit EINER Person — sonst trügen die
      // übrigen Mieter den Leerstand (vorsichtige Lesart, der Vermieter trägt ihn).
      const p = (id: string) => pos(proMieter[id]?.personen);
      gewichte = mieter.map((m) => p(m.id) * m.tage);
      const belegt = mieter.reduce((s, m) => s + m.tage, 0);
      const leerTage = Math.max(0, pos(basis.einheiten) * JT - belegt);
      // Ohne Einheitenzahl ist der Leerstand unbekannt — dann lieber gar nicht verteilen, als ihn
      // still den Mietern aufzuerlegen.
      nenner = pos(basis.einheiten) ? gewichte.reduce((a, b) => a + b, 0) + leerTage : 0;
      text = (i) => `${zahl(p(mieter[i].id))} Pers. × ${mieter[i].tage} Tage / ${zahl(nenner)} Personentage`;
      const ohne = mieter.filter((m) => !p(m.id)).map((m) => m.name);
      if (ohne.length) fehlt = `Personenzahl fehlt bei ${ohne.join(", ")} (Anteil bleibt beim Vermieter)`;
      if (!pos(basis.einheiten)) fehlt = "Die Zahl der Wohneinheiten fehlt (für den Leerstand nötig)";
    } else {
      // Verbrauch: gemessen, deshalb ohne Tage-Faktor. Nenner ist der Hauptzähler — fehlt er,
      // die Summe der Wohnungszähler (dann trägt niemand den Verbrauch leerer Wohnungen).
      const v = (id: string) => pos(k.werte?.[id]);
      gewichte = mieter.map((m) => v(m.id));
      const summe = gewichte.reduce((a, b) => a + b, 0);
      nenner = pos(k.nenner) || summe;
      text = (i) => `${zahl(v(mieter[i].id))}/${zahl(nenner)} Verbrauch`;
      const ohne = mieter.filter((m) => !v(m.id)).map((m) => m.name);
      if (ohne.length) fehlt = `Verbrauch fehlt bei ${ohne.join(", ")}`;
      if (pos(k.nenner) && summe > pos(k.nenner)) fehlt = "Die Wohnungszähler ergeben mehr als der Gesamtverbrauch";
    }

    const summeGew = gewichte.reduce((a, b) => a + b, 0);
    if (!(nenner > 0) || !(summeGew > 0)) return leer(`${k.bezeichnung}: ${fehlt ?? "Angaben fehlen"} — nicht verteilt.`);
    // Mehr als das ganze Haus kann nicht belegt sein (z. B. Mieterflächen größer als die
    // Gesamtfläche) — dann nicht über 100 % verteilen, sondern warnen.
    const ueber = summeGew > nenner * 1.000001;
    const leerGewicht = Math.max(0, nenner - summeGew);
    const teile = verteileBetrag(betrag, [...gewichte, leerGewicht]);
    const anteile: Record<string, NkAnteil> = {};
    mieter.forEach((m, i) => { anteile[m.id] = { betrag: teile[i], faktorText: text(i) }; });
    return {
      kosten: k,
      anteile,
      vermieter: teile[teile.length - 1],
      warnung: ueber
        ? `${k.bezeichnung}: Die Anteile der Mieter ergeben mehr als das ganze Haus — Grundlagen prüfen.`
        : fehlt ? `${k.bezeichnung}: ${fehlt}.` : undefined,
    };
  });

  const summeMieter: Record<string, number> = {};
  for (const m of mieter) summeMieter[m.id] = r2(positionen.reduce((s, p) => s + (p.anteile[m.id]?.betrag ?? 0), 0));
  const umlagefaehig = positionen.filter((p) => p.kosten.umlagefaehig);
  return {
    jahr,
    jahresTage: JT,
    mieter,
    positionen,
    summeMieter,
    summeVermieter: r2(umlagefaehig.reduce((s, p) => s + p.vermieter, 0)),
    summeGesamt: r2(umlagefaehig.reduce((s, p) => s + r2(pos(p.kosten.betrag)), 0)),
  };
}

/**
 * Die Positionen EINES Mieters im Format von lib/nk.ts (Aufteilung „objekt“): Gesamtbetrag als
 * `betrag` (= Gesamtkosten, BGH-Pflichtangabe), fertiger Anteil in `anteil`. Nicht umlagefähige
 * Kosten gehen mit, damit die Abrechnung sie als „nicht berechnet“ nennen kann.
 */
export function positionenFuerMieter(e: NkObjektErgebnis, mieterId: string) {
  // Ohne Belegung im Jahr nichts. Mit Belegung ALLE Kosten — auch eine, die mangels Angaben nicht
  // verteilt werden konnte (Anteil 0 + Warnung). Sonst fiele sie still aus der Abrechnung.
  if (!e.mieter.some((m) => m.id === mieterId)) return [];
  return e.positionen
    .map((p) => ({
      bezeichnung: p.kosten.bezeichnung,
      betrag: r2(pos(p.kosten.betrag)),
      umlageschluessel: SCHLUESSEL_LABEL[p.kosten.schluessel],
      umlagefaehig: p.kosten.umlagefaehig,
      jahr: e.jahr,
      aufteilung: "objekt" as const,
      anteil: p.anteile[mieterId]?.betrag ?? 0,
      faktor_text: p.anteile[mieterId]?.faktorText ?? null,
      lohnanteil: p.kosten.lohnanteil ?? null,
      art_35a: p.kosten.art_35a ?? null,
      warnung: p.warnung ?? null,
    }));
}

// ---------------------------------------------------------------------------
// Eingaben prüfen (rein — die Server-Action ruft das, Tests auch)
// ---------------------------------------------------------------------------


/**
 * Mengen (Verbrauch, Fläche, MEA, Personen) — NICHT über zahlDe(): Zähler haben drei
 * Nachkommastellen, „5123.456“ m³ ist kein Tausenderpunkt (CLAUDE.md, vierter Fund). Mit Komma
 * sind Punkte Tausender, sonst ist ein Punkt das Dezimalzeichen.
 */
export function mengeDe(roh: string | number | null | undefined): number | null {
  if (typeof roh === "number") return Number.isFinite(roh) && roh >= 0 ? roh : null;
  const t = (roh ?? "").trim().replace(/\s/g, "");
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export type NkKostenRoh = {
  id?: string | null;
  bezeichnung: string;
  betrag: string;
  schluessel: string;
  umlagefaehig: boolean;
  lohnanteil?: string | null;
  art35a?: string | null;
  nenner?: string | null;
  werte?: Record<string, string> | null;
};

export type NkKostenZeile = {
  bezeichnung: string;
  betrag: number;
  schluessel: NkSchluessel;
  umlagefaehig: boolean;
  lohnanteil: number | null;
  art_35a: "haushaltsnah" | "handwerker" | null;
  nenner: number | null;
  werte: Record<string, number>;
};

/** Eine Kostenzeile aus dem Formular prüfen. `mieterIds`: Mieter des Objekts (nur die zählen). */
export function pruefeKostenEingabe(
  roh: NkKostenRoh,
  mieterIds: Set<string>,
): { zeile: NkKostenZeile } | { error: string } {
  const bezeichnung = (roh.bezeichnung ?? "").trim().slice(0, 120);
  if (!bezeichnung) return { error: "Bitte eine Bezeichnung eingeben." };
  const betrag = zahlDe(roh.betrag);
  if (betrag == null || betrag < 0) return { error: "Bitte den Gesamtbetrag des Hauses eingeben." };
  if (!istSchluessel(roh.schluessel)) return { error: "Unbekannter Umlageschlüssel." };
  const lohn = roh.lohnanteil ? zahlDe(roh.lohnanteil) : null;
  if (lohn != null && (lohn < 0 || lohn > betrag)) return { error: "Der Lohnanteil kann nicht größer als der Betrag sein." };
  const art = roh.art35a === "haushaltsnah" || roh.art35a === "handwerker" ? roh.art35a : null;
  const werte: Record<string, number> = {};
  if (roh.schluessel === "verbrauch" || roh.schluessel === "direkt") {
    for (const [id, w] of Object.entries(roh.werte ?? {})) {
      if (!mieterIds.has(id) || !(w ?? "").trim()) continue;
      const n = roh.schluessel === "direkt" ? zahlDe(w) : mengeDe(w);
      if (n == null || n < 0) return { error: "Ein Wert je Wohnung ist keine gültige Zahl." };
      werte[id] = n;
    }
  }
  const nenner = roh.schluessel === "verbrauch" ? mengeDe(roh.nenner) : null;
  return {
    zeile: {
      bezeichnung,
      betrag: Math.round(betrag * 100) / 100,
      schluessel: roh.schluessel,
      umlagefaehig: !!roh.umlagefaehig,
      lohnanteil: lohn && lohn > 0 ? Math.round(lohn * 100) / 100 : null,
      art_35a: lohn && lohn > 0 ? art : null,
      nenner: nenner && nenner > 0 ? nenner : null,
      werte,
    },
  };
}

const schluesselName = (s: string) => s.trim().toLowerCase();

/**
 * Vorschläge aus dem Vorjahr: Kostenart, Schlüssel, umlagefähig und § 35a-Einordnung gehen mit;
 * Werte je Wohnung (Verbrauch, Messdienst-Beträge) und der Lohnanteil NICHT — sie gelten nur für
 * ein Jahr. Der Betrag ist ein Vorschlag (quelle „vorjahr“, die Oberfläche markiert ihn).
 */
export function vorschlaegeAusVorjahr(vorjahr: NkObjektKosten[], vorhanden: string[]) {
  const da = new Set(vorhanden.map(schluesselName));
  return vorjahr
    .filter((k) => !da.has(schluesselName(k.bezeichnung)))
    .map((k) => ({
      bezeichnung: k.bezeichnung,
      betrag: k.betrag,
      schluessel: k.schluessel,
      umlagefaehig: k.umlagefaehig,
      art_35a: k.art_35a ?? null,
      quelle: "vorjahr" as const,
    }));
}

/** Vorschläge aus den gebuchten Kosten (lib/nkAusBuchungen.ts), ohne schon vorhandene. */
export function vorschlaegeAusBuchungen(v: { bezeichnung: string; betrag: number }[], vorhanden: string[]) {
  const da = new Set(vorhanden.map(schluesselName));
  return v
    .filter((x) => !da.has(schluesselName(x.bezeichnung)))
    .map((x) => ({
      bezeichnung: x.bezeichnung,
      betrag: x.betrag,
      schluessel: standardSchluessel(x.bezeichnung),
      umlagefaehig: true,
      art_35a: null,
      quelle: "buchungen" as const,
    }));
}
