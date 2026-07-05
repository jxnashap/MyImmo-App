// Orchestrierung der Bewertung: wählt je Objektart/Nutzung das passende
// ImmoWertV-Verfahren, füllt fehlende Modellwerte mit dokumentierten Standard-
// annahmen und liefert ein einheitliches Ergebnis mit Herleitung + Liste der
// fehlenden Kennzahlen. REINE Funktion (kein DB/UI/Date) — `jahr` wird übergeben.

import {
  vergleichswert, ertragswert, sachwert, bodenwert,
  alterswertminderungProzent, type Herleitungszeile,
} from "./immowertv";

export type Verfahren = "vergleich" | "ertrag" | "sach";

export type Kennzahlen = {
  bodenrichtwertM2?: number | null;
  liegenschaftszinsProzent?: number | null;
  restnutzungsdauer?: number | null;
  vergleichspreisM2?: number | null;      // €/m² Wohn-/Nutzfläche
  vergleichsmieteM2?: number | null;      // €/m²/Monat ortsüblich
  bewirtschaftungskostenProzent?: number | null;
  gesamtnutzungsdauer?: number | null;
  nhkM2?: number | null;
  sachwertfaktor?: number | null;
  aussenanlagen?: number | null;
};

export type BewertungObjekt = {
  typ?: string | null;
  obj_status?: string | null;
  flaeche?: number | null;                // Wohn-/Nutzfläche
  grundstuecksflaeche?: number | null;
  baujahr?: number | null;
  miete?: number | null;                  // Monatskaltmiete (Objekt)
};

export type BewertungErgebnis = {
  verfahren: Verfahren;
  marktwert: number | null;
  spanne: { min: number; max: number } | null;
  mietwert: number | null;                // ortsübliche Monatskaltmiete
  herleitung: Herleitungszeile[];
  fehlend: string[];
  hinweis: string;
};

// Typische Gesamtnutzungsdauer (Jahre) je Objektart (Anlage 1 ImmoWertV, gerundet).
const GND: Record<string, number> = {
  Eigentumswohnung: 80, Einfamilienhaus: 80, Mehrfamilienhaus: 80,
  Ferienimmobilie: 80, Gewerbeimmobilie: 50, "Garage / Stellplatz": 60, Garagenkomplex: 60,
};
const DEFAULT_GND = 80;

// Standard-Bewirtschaftungskosten (% vom Rohertrag): Verwaltung + Instandhaltung
// + Mietausfallwagnis — grobe Modellannahme, im UI überschreibbar.
const DEFAULT_BEWIRTSCHAFTUNG = 22;

const num = (v: number | null | undefined): number | null =>
  v == null || !Number.isFinite(v) ? null : v;

/** Verfahren automatisch nach Nutzung/Objektart (manuell überschreibbar). */
export function verfahrenFuer(o: BewertungObjekt, override?: Verfahren | null): Verfahren {
  if (override) return override;
  const typ = o.typ ?? "";
  if (typ === "Grundstück") return "vergleich"; // reiner Bodenwert
  const kapitalanlage =
    o.obj_status === "Vermietet" ||
    ["Mehrfamilienhaus", "Gewerbeimmobilie", "Garagenkomplex"].includes(typ);
  return kapitalanlage ? "ertrag" : "vergleich";
}

/**
 * Hauptfunktion. `jahr` = Bewertungsjahr (für Restnutzungsdauer aus Baujahr).
 * Fehlende Pflicht-Kennzahlen landen in `fehlend`; der Wert ist dann null.
 */
export function bewerten(
  o: BewertungObjekt,
  k: Kennzahlen,
  jahr: number,
  override?: Verfahren | null,
): BewertungErgebnis {
  const verfahren = verfahrenFuer(o, override);
  const flaeche = num(o.flaeche) ?? 0;
  const grund = num(o.grundstuecksflaeche) ?? 0;
  const gnd = num(k.gesamtnutzungsdauer) ?? GND[o.typ ?? ""] ?? DEFAULT_GND;
  const alter = o.baujahr ? Math.max(0, jahr - o.baujahr) : null;
  const rnd = num(k.restnutzungsdauer) ?? (alter != null ? Math.max(1, gnd - alter) : null);
  const brw = num(k.bodenrichtwertM2);
  const bw = brw != null ? bodenwert(brw, grund) : null;

  // ortsübliche Monatsmiete (für Mietwert-Anzeige + Ertragswert-Rohertrag)
  const mieteM2 = num(k.vergleichsmieteM2);
  const mietwert = mieteM2 != null && flaeche > 0 ? mieteM2 * flaeche : num(o.miete);

  const fehlend: string[] = [];
  const need = (cond: boolean, label: string) => { if (!cond) fehlend.push(label); };

  // ── Grundstück: reiner Bodenwert ────────────────────────────────────────────
  if ((o.typ ?? "") === "Grundstück") {
    need(brw != null, "Bodenrichtwert (€/m²)");
    need(grund > 0, "Grundstücksfläche (m²)");
    const wert = brw != null && grund > 0 ? bodenwert(brw, grund) : null;
    return finalize("vergleich", wert, mietwert, [
      { label: "Bodenrichtwert", wert: brw ?? 0, einheit: "€/m²" },
      { label: "Grundstücksfläche", wert: grund, einheit: "m²" },
      { label: "Bodenwert = Marktwert", wert: wert ?? 0, einheit: "€" },
    ], fehlend);
  }

  if (verfahren === "vergleich") {
    const preis = num(k.vergleichspreisM2);
    need(preis != null, "Vergleichspreis (€/m²)");
    need(flaeche > 0, "Wohn-/Nutzfläche (m²)");
    if (preis == null || flaeche <= 0) return finalize("vergleich", null, mietwert, [], fehlend);
    const r = vergleichswert({ vergleichspreisM2: preis, flaeche });
    return finalize("vergleich", r.wert, mietwert, r.herleitung, fehlend);
  }

  if (verfahren === "ertrag") {
    const zins = num(k.liegenschaftszinsProzent);
    const jahresRohertrag = mietwert != null ? mietwert * 12 : null;
    need(jahresRohertrag != null && jahresRohertrag > 0, "Jahresrohertrag / ortsübliche Miete");
    need(brw != null, "Bodenrichtwert (€/m²)");
    need(zins != null, "Liegenschaftszinssatz (%)");
    need(rnd != null, "Restnutzungsdauer / Baujahr");
    if (jahresRohertrag == null || zins == null || bw == null || rnd == null) {
      return finalize("ertrag", null, mietwert, [], fehlend);
    }
    const bewk = num(k.bewirtschaftungskostenProzent) ?? DEFAULT_BEWIRTSCHAFTUNG;
    const r = ertragswert({
      jahresRohertrag, bewirtschaftungskostenProzent: bewk,
      bodenwert: bw, liegenschaftszinsProzent: zins, restnutzungsdauer: rnd,
    });
    return finalize("ertrag", r.wert, mietwert, r.herleitung, fehlend);
  }

  // ── Sachwert (Fallback / Spezialobjekte) ────────────────────────────────────
  const nhk = num(k.nhkM2);
  need(nhk != null, "Normalherstellungskosten (€/m² BGF)");
  need(flaeche > 0, "Fläche (m²)");
  need(rnd != null, "Restnutzungsdauer / Baujahr");
  if (nhk == null || flaeche <= 0 || rnd == null) return finalize("sach", null, mietwert, [], fehlend);
  const awm = alterswertminderungProzent(gnd - rnd, gnd);
  const r = sachwert({
    nhkM2: nhk, bgf: flaeche, alterswertminderungProzent: awm,
    aussenanlagen: num(k.aussenanlagen) ?? 0, bodenwert: bw ?? 0,
    sachwertfaktor: num(k.sachwertfaktor) ?? 1,
  });
  return finalize("sach", r.wert, mietwert, r.herleitung, fehlend);
}

function finalize(
  verfahren: Verfahren, marktwert: number | null, mietwert: number | null,
  herleitung: Herleitungszeile[], fehlend: string[],
): BewertungErgebnis {
  const spanne = marktwert != null ? { min: Math.round(marktwert * 0.92), max: Math.round(marktwert * 1.08) } : null;
  return {
    verfahren,
    marktwert: marktwert != null ? Math.round(marktwert) : null,
    spanne,
    mietwert: mietwert != null ? Math.round(mietwert) : null,
    herleitung,
    fehlend,
    hinweis: "Unverbindliche Schätzung nach ImmoWertV 2021 — ersetzt kein Gutachten.",
  };
}
