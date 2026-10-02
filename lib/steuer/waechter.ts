// Steuer-Wächter über ALLE Objekte und Anlage-V-Vorjahresvergleich (02.10.2026).
//
// Der 15 %-Wächter (§ 6 Abs. 1 Nr. 1a EStG) und die Spekulationsfrist (§ 23 EStG) liefen bisher
// nur auf der Objektseite — wer fünf Objekte hat, musste fünf Seiten öffnen, um zu sehen, ob
// irgendwo eine Grenze droht. Hier dieselben Rechnungen (keine neuen Regeln) als eine Liste.
// Reine Funktionen, keine Steuerberatung.

import { berechneAnschaffungsnah, type AnschaffungsnahErgebnis, type AnschaffungsnahKosten } from "@/lib/steuer/anschaffungsnah";
import { berechneSpekulation, type SpekulationErgebnis } from "@/lib/steuer/spekulation";
import type { AnlageVObjekt } from "@/lib/anlageV";

export type WaechterObjekt = {
  id: string;
  bezeichnung: string;
  typ?: string | null;
  kaufpreis: number | null;
  kaufdatum?: string | null;
  afa_gebaeudeanteil?: number | null;
};

export type WaechterZeile = {
  id: string;
  name: string;
  /** null = kein abschreibbares Gebäude (Grundstück). */
  anschaffungsnah: AnschaffungsnahErgebnis | null;
  spekulation: SpekulationErgebnis;
  /** Sortier- und Hervorhebungsgrund: etwas verlangt Aufmerksamkeit. */
  achtung: boolean;
};

/** Spekulationsfrist endet in höchstens so vielen Tagen → hervorheben (Verkauf erwägen/abwarten). */
export const SPEKULATION_BALD_TAGE = 365;

export function steuerWaechter(
  objekte: WaechterObjekt[],
  kosten: (AnschaffungsnahKosten & { prop_id: string | null })[],
  heute: Date = new Date(),
): WaechterZeile[] {
  const zeilen = objekte.map((p) => {
    const abschreibbar = (p.typ ?? "") !== "Grundstück";
    const anschaffungsnah = abschreibbar
      ? berechneAnschaffungsnah(
          { kaufpreis: p.kaufpreis, gebaeudeanteilProzent: p.afa_gebaeudeanteil ?? null, kaufdatum: p.kaufdatum ?? null },
          kosten.filter((k) => k.prop_id === p.id),
          heute,
        )
      : null;
    const spekulation = berechneSpekulation(p.kaufdatum ?? null, heute);
    const achtung =
      anschaffungsnah?.status === "warnung" ||
      anschaffungsnah?.status === "ueberschritten" ||
      (spekulation.aktiv && !spekulation.steuerfrei && spekulation.tageVerbleibend <= SPEKULATION_BALD_TAGE);
    return { id: p.id, name: p.bezeichnung, anschaffungsnah, spekulation, achtung };
  });
  // Achtung zuerst, sonst Reihenfolge der Objekte.
  return [...zeilen.filter((z) => z.achtung), ...zeilen.filter((z) => !z.achtung)];
}

export type VergleichZeile = { label: string; vorjahr: number; jahr: number; delta: number; prozent: number | null };

/** Anlage-V-Summen eines Jahres gegen das Vorjahr — nur Positionen, die in einem der beiden Jahre vorkommen. */
export function anlageVVergleich(jahr: AnlageVObjekt, vorjahr: AnlageVObjekt): VergleichZeile[] {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const paare: [string, number, number][] = [
    ["Mieteinnahmen (kalt)", vorjahr.einnahmen.miete, jahr.einnahmen.miete],
    ["Umlagen", vorjahr.einnahmen.umlagen, jahr.einnahmen.umlagen],
    ["Sonstige Einnahmen", vorjahr.einnahmen.sonstige, jahr.einnahmen.sonstige],
    ["AfA", vorjahr.werbungskosten.afa, jahr.werbungskosten.afa],
    ["Schuldzinsen", vorjahr.werbungskosten.schuldzinsen, jahr.werbungskosten.schuldzinsen],
    ["Erhaltungsaufwand", vorjahr.werbungskosten.erhaltung, jahr.werbungskosten.erhaltung],
    ["Verwaltung", vorjahr.werbungskosten.verwaltung, jahr.werbungskosten.verwaltung],
    ["Grundsteuer", vorjahr.werbungskosten.grundsteuer, jahr.werbungskosten.grundsteuer],
    ["Versicherungen", vorjahr.werbungskosten.versicherung, jahr.werbungskosten.versicherung],
    ["Hausgeld / Sonstiges", vorjahr.werbungskosten.hausgeldSonstige, jahr.werbungskosten.hausgeldSonstige],
    ["Überschuss", vorjahr.ueberschuss, jahr.ueberschuss],
  ];
  return paare
    .filter(([label, v, j]) => label === "Überschuss" || v !== 0 || j !== 0)
    .map(([label, v, j]) => ({
      label,
      vorjahr: v,
      jahr: j,
      delta: r2(j - v),
      // Prozent nur, wenn das Vorjahr eine echte Basis hat (sonst „neu“ statt +∞ %).
      prozent: v !== 0 ? Math.round(((j - v) / Math.abs(v)) * 1000) / 10 : null,
    }));
}
