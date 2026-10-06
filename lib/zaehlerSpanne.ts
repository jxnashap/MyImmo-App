// Gemeldete Zählerstände → Verbrauch im Abrechnungsjahr (Verknüpfungs-Audit 06.10.2026, Paket C).
//
// Vorher erreichten die Zählerstände, die ein Mieter im Portal meldet, die NK-Abrechnung nie:
// Die Übernahme schreibt in `verbrauch` (je Objekt, ohne Mieter), die Abrechnung rechnet mit dem
// von Hand eingetragenen `verbrauch_mieter`. Diese Funktion zeigt dem Vermieter auf der NK-Seite
// erster und letzter Stand je Zähler-Art im Jahr samt Differenz — zum Übertragen, nicht still
// übernommen: Welcher Zähler zu welcher Position gehört, weiß nur er. Rein, ohne Datenbank.

export type ZaehlerMeldung = { art: string | null; zaehlernummer?: string | null; stand: number | string | null; einheit: string | null; ablesedatum: string };
export type ZaehlerSpanne = {
  art: string;
  zaehlernummer: string | null;
  einheit: string | null;
  von: { datum: string; stand: number };
  bis: { datum: string; stand: number };
  verbrauch: number;
  /** Erster Stand bis Ende Januar UND letzter ab Dezember — deckt das Jahr annähernd ab. */
  ganzesJahr: boolean;
};

/**
 * `meldungen` sollten Dezember des Vorjahres bis Januar des Folgejahres umfassen (Ablesung
 * zum Jahreswechsel). Je Art (und Einheit) erster und letzter Stand; weniger als zwei Stände
 * oder ein fallender Zähler (Tausch) → kein Eintrag.
 */
export function zaehlerSpanne(meldungen: ZaehlerMeldung[], jahr: number): ZaehlerSpanne[] {
  const gruppen = new Map<string, { datum: string; stand: number; art: string; nr: string | null; einheit: string | null }[]>();
  for (const m of meldungen) {
    const stand = Number(m.stand);
    if (!m.art || !Number.isFinite(stand) || !/^\d{4}-\d{2}-\d{2}/.test(m.ablesedatum)) continue;
    // Je Zähler (Nummer), sonst je Art + Einheit — zwei Wasserzähler dürfen nicht verrechnet werden.
    const nr = (m.zaehlernummer ?? "").trim() || null;
    const key = `${m.art}|${nr ?? ""}|${m.einheit ?? ""}`;
    const g = gruppen.get(key) ?? [];
    g.push({ datum: m.ablesedatum.slice(0, 10), stand, art: m.art, nr, einheit: m.einheit });
    gruppen.set(key, g);
  }
  const out: ZaehlerSpanne[] = [];
  for (const g of gruppen.values()) {
    if (g.length < 2) continue;
    g.sort((a, b) => a.datum.localeCompare(b.datum));
    const von = g[0], bis = g[g.length - 1];
    if (bis.stand < von.stand) continue;
    out.push({
      art: von.art,
      zaehlernummer: von.nr,
      einheit: von.einheit,
      von: { datum: von.datum, stand: von.stand },
      bis: { datum: bis.datum, stand: bis.stand },
      verbrauch: Math.round((bis.stand - von.stand) * 1000) / 1000,
      ganzesJahr: von.datum <= `${jahr}-01-31` && bis.datum >= `${jahr}-12-01`,
    });
  }
  return out;
}
