// Gebuchte Kosten → Nebenkostenabrechnung (Verknüpfungs-Audit 06.10.2026, Paket C).
//
// Vorher tippte der Vermieter Grundsteuer, Müll oder Versicherung zweimal: einmal unter
// Ausgaben (für die Anlage V), dann noch einmal in die NK-Abrechnung — kein NK-Pfad las die
// Tabelle `kosten`. Diese Datei fasst die umlagefähigen Buchungen eines Objekts und Jahres
// je Kategorie zusammen; die Oberfläche bietet sie als Vorschlag an (nie still übernommen).
// Rein, ohne Datenbank.

import { istUmlagefaehig } from "@/lib/format";

export type KostenBuchung = {
  prop_id: string | null;
  buchungsdatum: string | null;
  kategorie: string | null;
  betrag: number | string | null;
};

export type NkVorschlag = { bezeichnung: string; kategorie: string; betrag: number; anzahl: number };

/** Kategorie → Bezeichnung in der Abrechnung (wie die Vorlagen des Verteilers). */
const BEZEICHNUNG: Record<string, string> = {
  Versicherung: "Gebäudeversicherung",
  Müll: "Müllabfuhr",
  Wasser: "Wasser / Abwasser",
  Abwasser: "Wasser / Abwasser",
};

export function nkBezeichnung(kategorie: string): string {
  return BEZEICHNUNG[kategorie] ?? kategorie;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Umlagefähige Kosten eines Objekts im Kalenderjahr, je Abrechnungs-Bezeichnung summiert.
 * `unklar`: Kategorien, die teils umlagefähig sind (Hausgeld/WEG — Verwaltung und Rücklage
 * sind es nicht, § 1 Abs. 2 BetrKV) — sie werden genannt, aber nicht vorgeschlagen.
 */
export function nkAusBuchungen(
  kosten: KostenBuchung[],
  propId: string,
  jahr: number,
): { vorschlaege: NkVorschlag[]; unklar: { kategorie: string; betrag: number }[] } {
  const j = String(jahr);
  const summen = new Map<string, NkVorschlag>();
  const unklar = new Map<string, number>();
  for (const k of kosten) {
    if (k.prop_id !== propId || !(k.buchungsdatum ?? "").startsWith(j)) continue;
    const kat = (k.kategorie ?? "").trim();
    const betrag = Number(k.betrag) || 0;
    if (!kat || betrag <= 0) continue;
    const art = istUmlagefaehig(kat);
    if (art === "ja") {
      const bez = nkBezeichnung(kat);
      const v = summen.get(bez) ?? { bezeichnung: bez, kategorie: kat, betrag: 0, anzahl: 0 };
      v.betrag = r2(v.betrag + betrag);
      v.anzahl += 1;
      summen.set(bez, v);
    } else if (art === "unklar" && kat.startsWith("Hausgeld")) {
      unklar.set(kat, r2((unklar.get(kat) ?? 0) + betrag));
    }
  }
  return {
    vorschlaege: [...summen.values()].sort((a, b) => b.betrag - a.betrag),
    unklar: [...unklar.entries()].map(([kategorie, betrag]) => ({ kategorie, betrag })),
  };
}
