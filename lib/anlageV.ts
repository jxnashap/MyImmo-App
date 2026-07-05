// Anlage V (Einkünfte aus Vermietung und Verpachtung) — reine Berechnung.
// Aggregiert die vorhandenen Buchungen (Einnahmen, Kosten, Kredite) je Objekt
// und Jahr und ordnet sie den Positionen der Anlage V zu. AfA wird aus dem
// Kaufpreis geschätzt (Gebäudeanteil × Satz) und ist im UI editierbar.
// Hinweis: Hilfestellung zur Steuererklärung, keine Steuerberatung.

import type { Einnahme, Kosten, Kredit, Property } from "@/lib/types";

export type AfaParams = {
  gebaeudeAnteil: number; // % des Kaufpreises, der auf das Gebäude entfällt
  satz: number | null; // AfA-Satz in % p.a. (null = automatisch je Baujahr)
};

export const AFA_DEFAULT: AfaParams = { gebaeudeAnteil: 80, satz: null };

/** AfA-Satz nach Baujahr, § 7 Abs. 4 S. 1 Nr. 2 EStG. */
export function afaSatzAusBaujahr(baujahr: number | null | undefined): number {
  if (!baujahr) return 2; // unbekannt → Regelfall 2 %
  if (baujahr >= 2023) return 3; // Neubau ab 2023
  if (baujahr < 1925) return 2.5; // vor 1925
  return 2; // 1925–2022
}

export type AnlageVEinnahmen = {
  miete: number; // Kaltmiete (Zeile 9)
  umlagen: number; // vereinnahmte Nebenkosten (Zeile 13)
  sonstige: number; // sonstige Einnahmen (Zeile 14)
  summe: number;
};

export type AnlageVWerbungskosten = {
  afa: number; // Gebäude-AfA (Zeile 33 ff.)
  schuldzinsen: number; // Zeile 37
  erhaltung: number; // Erhaltungsaufwand (Zeile 40 ff.)
  verwaltung: number; // Verwaltungskosten (Zeile 46)
  grundsteuer: number; // Grundsteuer/öff. Lasten (Zeile 47)
  versicherung: number; // Versicherungen (Zeile 47)
  hausgeldSonstige: number; // Hausgeld/WEG + Sonstiges (Zeile 47/50)
  summe: number;
};

export type AnlageVObjekt = {
  propId: string | null;
  name: string;
  adresse: string | null;
  einnahmen: AnlageVEinnahmen;
  werbungskosten: AnlageVWerbungskosten;
  ueberschuss: number; // Einnahmen − Werbungskosten
  afaBasis: number; // Bemessungsgrundlage der AfA (Gebäudewert)
  afaSatz: number; // verwendeter AfA-Satz in % (für Anzeige)
  afaMethode: "auto" | "degressiv" | "manuell" | "keine";
};

export type AnlageVErgebnis = {
  jahr: number;
  objekte: AnlageVObjekt[];
  gesamt: AnlageVObjekt; // Summe über alle Objekte
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const jahrVon = (d: string | null | undefined) => (d ? Number(d.slice(0, 4)) : NaN);
const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

const KOSTEN_BUCKET: Record<string, keyof Omit<AnlageVWerbungskosten, "afa" | "schuldzinsen" | "summe">> = {
  Reparatur: "erhaltung",
  Instandhaltung: "erhaltung",
  Verwaltung: "verwaltung",
  Makler: "verwaltung",
  Grundsteuer: "grundsteuer",
  Versicherung: "versicherung",
  "Hausgeld / WEG": "hausgeldSonstige",
  Sonstiges: "hausgeldSonstige",
};

function leereWk(): AnlageVWerbungskosten {
  return { afa: 0, schuldzinsen: 0, erhaltung: 0, verwaltung: 0, grundsteuer: 0, versicherung: 0, hausgeldSonstige: 0, summe: 0 };
}
function leereEin(): AnlageVEinnahmen {
  return { miete: 0, umlagen: 0, sonstige: 0, summe: 0 };
}

export function berechneAnlageV(
  jahr: number,
  properties: Property[],
  einnahmen: Einnahme[],
  kosten: Kosten[],
  kredite: Kredit[],
  afa: AfaParams,
): AnlageVErgebnis {
  // Eine Gruppe je Objekt, plus optional „ohne Objekt".
  const gruppen = new Map<string | null, AnlageVObjekt>();
  const hole = (propId: string | null): AnlageVObjekt => {
    if (!gruppen.has(propId)) {
      const p = properties.find((x) => x.id === propId);
      gruppen.set(propId, {
        propId,
        name: p?.bezeichnung ?? "Ohne Objektzuordnung",
        adresse: p?.adresse ?? null,
        einnahmen: leereEin(),
        werbungskosten: leereWk(),
        ueberschuss: 0,
        afaBasis: 0,
        afaMethode: "auto",
        afaSatz: 0,
      });
    }
    return gruppen.get(propId)!;
  };

  // Objekte mit Stammdaten immer anlegen (auch ohne Buchungen → für AfA).
  for (const p of properties) hole(p.id);

  // Einnahmen
  for (const e of einnahmen) {
    if (jahrVon(e.buchungsdatum) !== jahr) continue;
    const betrag = Number(e.betrag) || 0;
    const g = hole(e.prop_id);
    if (e.kategorie === "Miete") {
      const nk = Number(e.nk_anteil) || 0;
      g.einnahmen.miete += betrag - nk;
      g.einnahmen.umlagen += nk;
    } else if (e.kategorie === "Nebenkostenabrechnung") g.einnahmen.umlagen += betrag;
    else if (e.kategorie === "Kaution") continue; // durchlaufend, nicht steuerbar
    else g.einnahmen.sonstige += betrag;
  }

  // Laufende Kosten
  for (const k of kosten) {
    if (jahrVon(k.buchungsdatum) !== jahr) continue;
    const betrag = Number(k.betrag) || 0;
    const g = hole(k.prop_id);
    const bucket = (k.kategorie && KOSTEN_BUCKET[k.kategorie]) || "hausgeldSonstige";
    g.werbungskosten[bucket] += betrag;
  }

  // AfA + Schuldzinsen je Objekt
  for (const p of properties) {
    const g = hole(p.id);
    const kaufpreis = Number(p.kaufpreis) || 0;
    // Gebäudeanteil: Objekt-Override → globaler Regler
    const gebAnteil = p.afa_gebaeudeanteil ?? afa.gebaeudeAnteil;
    g.afaBasis = r2((kaufpreis * gebAnteil) / 100);
    const methode = (p.afa_methode as "auto" | "degressiv" | "manuell" | "keine") ?? "auto";
    g.afaMethode = methode;
    if (methode === "keine") {
      // Grundstücke sind nicht abschreibbar (§ 7 EStG) — keine AfA.
      g.werbungskosten.afa = 0;
      g.afaSatz = 0;
    } else if (methode === "manuell" && p.afa_betrag != null) {
      // Fester Jahresbetrag (deckt § 7b Sonder-AfA / Denkmal § 7i/§ 7h ab)
      g.werbungskosten.afa = r2(Number(p.afa_betrag));
      g.afaSatz = g.afaBasis > 0 ? r2((g.werbungskosten.afa / g.afaBasis) * 100) : 0;
    } else if (methode === "degressiv") {
      // § 7 Abs. 5a EStG: 5 % geometrisch-degressiv vom Restbuchwert.
      // Vereinfachung: kein Wechsel zu linear, keine Monats-Zeitanteiligkeit im 1. Jahr.
      const start = p.afa_start_jahr ?? p.baujahr ?? jahr;
      const n = Math.max(0, jahr - start); // 0 = 1. AfA-Jahr
      g.werbungskosten.afa = r2(g.afaBasis * 0.05 * Math.pow(0.95, n));
      g.afaSatz = 5;
    } else {
      const satz = afa.satz ?? afaSatzAusBaujahr(p.baujahr); // global-Override nur bei "auto"
      g.afaSatz = satz;
      g.werbungskosten.afa = r2((g.afaBasis * satz) / 100);
    }
    // Schuldzinsen geschätzt aus aktueller Restschuld × Zinssatz.
    const propKredite = kredite.filter((kr) => kr.prop_id === p.id);
    g.werbungskosten.schuldzinsen = r2(
      sum(propKredite.map((kr) => ((Number(kr.restschuld) || 0) * (Number(kr.zinssatz) || 0)) / 100)),
    );
  }

  // Summen je Objekt + Rundung
  const objekte = [...gruppen.values()].map((g) => {
    const e = g.einnahmen;
    e.miete = r2(e.miete); e.umlagen = r2(e.umlagen); e.sonstige = r2(e.sonstige);
    e.summe = r2(e.miete + e.umlagen + e.sonstige);
    const w = g.werbungskosten;
    w.erhaltung = r2(w.erhaltung); w.verwaltung = r2(w.verwaltung); w.grundsteuer = r2(w.grundsteuer);
    w.versicherung = r2(w.versicherung); w.hausgeldSonstige = r2(w.hausgeldSonstige);
    w.summe = r2(w.afa + w.schuldzinsen + w.erhaltung + w.verwaltung + w.grundsteuer + w.versicherung + w.hausgeldSonstige);
    g.ueberschuss = r2(e.summe - w.summe);
    return g;
  });

  // Leere Objekte ohne jede Bewegung ausblenden (keine Einnahmen, keine WK).
  const sichtbar = objekte.filter((g) => g.einnahmen.summe !== 0 || g.werbungskosten.summe !== 0);

  // Gesamtsumme
  const gesamt: AnlageVObjekt = {
    propId: null,
    name: "Gesamt (alle Objekte)",
    adresse: null,
    einnahmen: {
      miete: r2(sum(sichtbar.map((g) => g.einnahmen.miete))),
      umlagen: r2(sum(sichtbar.map((g) => g.einnahmen.umlagen))),
      sonstige: r2(sum(sichtbar.map((g) => g.einnahmen.sonstige))),
      summe: r2(sum(sichtbar.map((g) => g.einnahmen.summe))),
    },
    werbungskosten: {
      afa: r2(sum(sichtbar.map((g) => g.werbungskosten.afa))),
      schuldzinsen: r2(sum(sichtbar.map((g) => g.werbungskosten.schuldzinsen))),
      erhaltung: r2(sum(sichtbar.map((g) => g.werbungskosten.erhaltung))),
      verwaltung: r2(sum(sichtbar.map((g) => g.werbungskosten.verwaltung))),
      grundsteuer: r2(sum(sichtbar.map((g) => g.werbungskosten.grundsteuer))),
      versicherung: r2(sum(sichtbar.map((g) => g.werbungskosten.versicherung))),
      hausgeldSonstige: r2(sum(sichtbar.map((g) => g.werbungskosten.hausgeldSonstige))),
      summe: r2(sum(sichtbar.map((g) => g.werbungskosten.summe))),
    },
    ueberschuss: r2(sum(sichtbar.map((g) => g.ueberschuss))),
    afaBasis: r2(sum(sichtbar.map((g) => g.afaBasis))),
    afaSatz: 0,
    afaMethode: "auto",
  };

  return { jahr, objekte: sichtbar, gesamt };
}

// Anlage-V-Positionen als flache Liste (für Anzeige + CSV).
export const ANLAGE_V_POSITIONEN: { key: string; label: string; bereich: "einnahme" | "wk" }[] = [
  { key: "miete", label: "Mieteinnahmen (Kaltmiete) — Zeile 9", bereich: "einnahme" },
  { key: "umlagen", label: "Umlagen / Nebenkosten — Zeile 13", bereich: "einnahme" },
  { key: "sonstige", label: "Sonstige Einnahmen — Zeile 14", bereich: "einnahme" },
  { key: "afa", label: "AfA Gebäude — Zeile 33", bereich: "wk" },
  { key: "schuldzinsen", label: "Schuldzinsen — Zeile 37", bereich: "wk" },
  { key: "erhaltung", label: "Erhaltungsaufwand — Zeile 40", bereich: "wk" },
  { key: "verwaltung", label: "Verwaltungskosten — Zeile 46", bereich: "wk" },
  { key: "grundsteuer", label: "Grundsteuer / öffentl. Lasten — Zeile 47", bereich: "wk" },
  { key: "versicherung", label: "Versicherungen — Zeile 47", bereich: "wk" },
  { key: "hausgeldSonstige", label: "Hausgeld / sonstige Kosten — Zeile 47", bereich: "wk" },
];

export function wertVon(o: AnlageVObjekt, key: string): number {
  if (key in o.einnahmen) return (o.einnahmen as unknown as Record<string, number>)[key];
  if (key in o.werbungskosten) return (o.werbungskosten as unknown as Record<string, number>)[key];
  return 0;
}
