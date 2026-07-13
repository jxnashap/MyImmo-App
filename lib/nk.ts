// Nebenkosten-Abrechnung — reine Berechnungslogik (ohne Abhängigkeiten).
// Quelle der Umlagebeträge: mieter_positionen (je Mieter, optional je Jahr).
// Optional: CO₂-Kostenaufteilung nach CO2KostAufG (lib/co2.ts) — der
// Vermieteranteil mindert als Gutschrift die vom Mieter zu tragende Summe.

import { co2Aufteilung, CO2_STUFEN } from "@/lib/co2";

export type NkRawPosition = {
  bezeichnung: string;
  betrag: number | null;
  umlageschluessel: string | null;
  umlagefaehig: boolean | null;
  jahr: number | null;
  // 'voll' (Default) | 'zeit' (Jahreskosten nach Belegungstagen)
  // | 'verbrauch' (Zwischenablesung) | 'gradtag' (Gradtagszahlen, Heizung)
  aufteilung?: string | null;
  verbrauch_mieter?: number | null; // z. B. kWh des Mieters (nur 'verbrauch')
  verbrauch_gesamt?: number | null; // Gesamtverbrauch des Jahres (nur 'verbrauch')
  // Anzeige-Spalten im Layout der klassischen Betriebskostenabrechnung:
  gesamt_betrag?: number | null; // Gesamtkosten des Hauses (Spalte „Betriebskostenabrechnung")
  basis_text?: string | null; // z. B. "5 Wohnungen", "352,16 qm", "manuell"
  anteil_text?: string | null; // z. B. "1" oder "67,08 qm"
};

export type NkTenant = {
  vorname: string | null;
  nachname: string | null;
  mieter_adresse: string | null;
  einheit: string | null;
  flaeche: number | null;
  mietbeginn: string | null;
  mietende: string | null;
  nk_vorauszahlung: number | null;
};

export type NkProperty = {
  bezeichnung: string | null;
  adresse: string | null;
};

export type NkLine = {
  bezeichnung: string;
  umlageschluessel: string | null;
  betrag: number; // bei 'zeit' bereits der anteilige Betrag
  basis?: number; // Jahresgesamtkosten (nur bei 'zeit')
  faktorText?: string; // z. B. "181/365 Tage" (nur bei 'zeit')
  // Spalten der klassischen Betriebskostenabrechnung (Anzeige, optional):
  gesamtBetrag?: number | null; // Gesamtkosten des Hauses
  basisText?: string | null; // Umlage-Basis, z. B. "5 Wohnungen"
  anteilText?: string | null; // Anteil der Wohnung, z. B. "67,08 qm"
};

// Eingaben von der Brennstoffrechnung (Tabelle nk_co2, je Mieter + Jahr).
export type NkCo2Input = {
  co2_kg: number | null;
  co2_kosten: number | null;
  flaeche: number | null;
  gewerbe: boolean | null;
};

export type NkCo2 = {
  spez: number; // kg CO₂ / m² · a
  stufeLabel: string; // z. B. "37 bis < 42"
  mieterProzent: number;
  vermieterProzent: number;
  kostenGesamt: number;
  vermieterAnteil: number; // Gutschrift zugunsten Mieter
  mieterAnteil: number;
  geschaetzt: boolean; // Kosten aus BEHG-Referenzpreis geschätzt
  gewerbe: boolean;
};

export type NkAbrechnung = {
  jahr: number;
  mieterName: string;
  mieterAdresse: string | null;
  objekt: string;
  objektAdresse: string | null;
  einheit: string | null;
  flaeche: number | null;
  zeitraumVon: string; // YYYY-MM-DD
  zeitraumBis: string; // YYYY-MM-DD
  monate: number; // belegte Monate im Abrechnungsjahr (0..12)
  positionen: NkLine[]; // umlagefähige Positionen
  ausgenommen: NkLine[]; // nicht umlagefähige (nur Hinweis)
  umlageGesamt: number;
  co2: NkCo2 | null; // CO₂-Aufteilung (null = kein CO₂-Block erfasst)
  kostenNachCo2: number; // umlageGesamt − CO₂-Vermieteranteil
  nkVorauszahlungMonat: number;
  vorauszahlungGeleistet: number;
  saldo: number; // > 0 = Guthaben (Erstattung), < 0 = Nachzahlung
};

function ym(d: Date): number {
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

/** Belegte volle Monate im Abrechnungsjahr aus Mietbeginn/-ende. */
export function monateImJahr(
  jahr: number,
  mietbeginn: string | null,
  mietende: string | null,
): { von: string; bis: string; monate: number } {
  const jahresStart = new Date(Date.UTC(jahr, 0, 1));
  const jahresEnde = new Date(Date.UTC(jahr, 11, 31));

  const beginn = mietbeginn ? new Date(mietbeginn) : jahresStart;
  const ende = mietende ? new Date(mietende) : jahresEnde;

  const von = beginn > jahresStart ? beginn : jahresStart;
  const bis = ende < jahresEnde ? ende : jahresEnde;

  if (von > bis) {
    return {
      von: jahresStart.toISOString().slice(0, 10),
      bis: jahresEnde.toISOString().slice(0, 10),
      monate: 0,
    };
  }

  const monate = Math.min(12, Math.max(0, ym(bis) - ym(von) + 1));
  return {
    von: von.toISOString().slice(0, 10),
    bis: bis.toISOString().slice(0, 10),
    monate,
  };
}

const rund2 = (n: number) => Math.round(n * 100) / 100;

/** CO₂-Aufteilung aus den nk_co2-Eingaben (null, wenn nichts Brauchbares erfasst). */
export function nkCo2Aus(input: NkCo2Input | null | undefined, jahr: number): NkCo2 | null {
  if (!input) return null;
  const kg = input.co2_kg ?? 0;
  const m2 = input.flaeche ?? 0;
  if (!(kg > 0) || !(m2 > 0)) return null;

  const geschaetzt = input.co2_kosten == null;
  const a = co2Aufteilung({
    co2Kg: kg,
    co2Kosten: input.co2_kosten,
    flaeche: m2,
    jahr,
    gewerbe: !!input.gewerbe,
  });
  if (!(a.kostenGesamt > 0)) return null;

  const stufe = CO2_STUFEN[a.stufeIndex];
  const stufeLabel = stufe.max == null ? `ab ${stufe.min}` : `${stufe.min} bis < ${stufe.max}`;

  return {
    spez: a.spez,
    stufeLabel,
    mieterProzent: a.mieterProzent,
    vermieterProzent: a.vermieterProzent,
    kostenGesamt: a.kostenGesamt,
    vermieterAnteil: a.vermieterAnteil,
    mieterAnteil: a.mieterAnteil,
    geschaetzt,
    gewerbe: !!input.gewerbe,
  };
}

const TAG_MS = 86_400_000;

/** Kalendertage des Jahres (365/366). */
export function jahresTage(jahr: number): number {
  return Math.round((Date.UTC(jahr + 1, 0, 1) - Date.UTC(jahr, 0, 1)) / TAG_MS);
}

/** Tage von..bis einschließlich (ISO-Daten, UTC-Mitternacht). */
export function belegungsTage(von: string, bis: string): number {
  const t = (new Date(bis).getTime() - new Date(von).getTime()) / TAG_MS + 1;
  return Math.max(0, Math.round(t));
}

// Gradtagszahlen je Monat (Promille, Summe 1000) — STANDARDTABELLE nach
// VDI 2067 / üblicher Abrechnungspraxis; im Zweifel amtliche Werte prüfen.
export const GRADTAGSZAHLEN = [170, 150, 130, 80, 40, 20, 0, 0, 30, 80, 120, 180] as const;

/**
 * Gradtags-Promille des Belegungszeitraums von..bis (beide im selben Jahr,
 * einschließlich). Volle Monate zählen voll, Übergangsmonate tagegenau
 * anteilig. Rückgabe als exakter Bruchwert (0..1000).
 */
export function gradtagsPromille(jahr: number, von: string, bis: string): number {
  const vonD = new Date(von);
  const bisD = new Date(bis);
  let summe = 0;
  for (let m = 0; m < 12; m++) {
    const mStart = Date.UTC(jahr, m, 1);
    const mEnde = Date.UTC(jahr, m + 1, 0); // letzter Tag des Monats
    const tageImMonat = new Date(mEnde).getUTCDate();
    const von_ = Math.max(mStart, vonD.getTime());
    const bis_ = Math.min(mEnde, bisD.getTime());
    if (von_ > bis_) continue;
    const belegt = Math.round((bis_ - von_) / TAG_MS) + 1;
    summe += GRADTAGSZAHLEN[m] * (belegt / tageImMonat);
  }
  return summe;
}

export function berechneNk(
  jahr: number,
  tenant: NkTenant,
  property: NkProperty | null,
  positionen: NkRawPosition[],
  co2Input?: NkCo2Input | null,
): NkAbrechnung {
  // Belegungszeitraum zuerst — der Tage-Faktor gilt für 'zeit'-Positionen.
  const { von, bis, monate } = monateImJahr(jahr, tenant.mietbeginn, tenant.mietende);
  const jahrestage = jahresTage(jahr);
  const tage = monate === 0 ? 0 : belegungsTage(von, bis);
  const faktor = tage / jahrestage;

  // Positionen des Jahres (oder ohne Jahresangabe = Altbestand) berücksichtigen.
  const relevant = positionen.filter((p) => p.jahr == null || p.jahr === jahr);

  const zahl = (n: number) =>
    new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(n);

  // Anteil einer 'zeit'-Position (auch Fallback bei fehlenden Verbrauchsdaten).
  const zeitAnteil = (basis: number, hinweis = ""): Omit<NkLine, "bezeichnung" | "umlageschluessel"> => ({
    betrag: rund2(basis * faktor),
    basis,
    faktorText: `${tage}/${jahrestage} Tage${hinweis}`,
  });

  const umlagefaehig: NkLine[] = relevant
    .filter((p) => p.umlagefaehig === true)
    .map((p) => {
      const basis = p.betrag ?? 0;
      const kopf = {
        bezeichnung: p.bezeichnung,
        umlageschluessel: p.umlageschluessel,
        gesamtBetrag: p.gesamt_betrag ?? null,
        basisText: p.basis_text ?? null,
        anteilText: p.anteil_text ?? null,
      };

      if (p.aufteilung === "zeit") {
        // Betrag = Jahresgesamtkosten → tagegenau nach Belegung aufteilen.
        return { ...kopf, ...zeitAnteil(basis) };
      }

      if (p.aufteilung === "verbrauch") {
        // Zwischenablesung: exakt nach gemessenem Verbrauchsanteil.
        const vm = p.verbrauch_mieter;
        const vg = p.verbrauch_gesamt;
        if (vm == null || vg == null || !(vg > 0) || vm < 0) {
          // Ohne brauchbare Verbrauchsdaten kein Absturz: tagegenauer Fallback.
          return { ...kopf, ...zeitAnteil(basis, " — Verbrauchsdaten fehlen") };
        }
        return {
          ...kopf,
          betrag: rund2(basis * (vm / vg)),
          basis,
          faktorText: `${zahl(vm)}/${zahl(vg)} Verbrauch`,
        };
      }

      if (p.aufteilung === "gradtag") {
        // Heizkosten nach Gradtagszahlen der Belegungsmonate (Übergangsmonat
        // tagegenau gewichtet).
        const promille = monate === 0 ? 0 : gradtagsPromille(jahr, von, bis);
        return {
          ...kopf,
          betrag: rund2(basis * (promille / 1000)),
          basis,
          faktorText: `${Math.round(promille)}/1000 Gradtagszahlen`,
        };
      }

      return { ...kopf, betrag: basis };
    });

  const ausgenommen: NkLine[] = relevant
    .filter((p) => p.umlagefaehig !== true)
    .map((p) => ({
      bezeichnung: p.bezeichnung,
      umlageschluessel: p.umlageschluessel,
      betrag: p.betrag ?? 0,
    }));

  const umlageGesamt = rund2(umlagefaehig.reduce((s, p) => s + p.betrag, 0));

  // CO₂-Gutschrift: Der Vermieteranteil mindert die Mieterlast. Der
  // Mieteranteil steckt bereits in den Heizkosten-Positionen — er wird nur
  // ausgewiesen, NICHT addiert (keine Doppelzählung).
  const co2 = nkCo2Aus(co2Input, jahr);
  const kostenNachCo2 = rund2(umlageGesamt - (co2?.vermieterAnteil ?? 0));

  const nkVorauszahlungMonat = tenant.nk_vorauszahlung ?? 0;
  const vorauszahlungGeleistet = nkVorauszahlungMonat * monate;
  const saldo = rund2(vorauszahlungGeleistet - kostenNachCo2);

  const mieterName =
    [tenant.vorname, tenant.nachname].filter(Boolean).join(" ") || "Mieter";

  return {
    jahr,
    mieterName,
    mieterAdresse: tenant.mieter_adresse,
    objekt: property?.bezeichnung || "—",
    objektAdresse: property?.adresse ?? null,
    einheit: tenant.einheit,
    flaeche: tenant.flaeche,
    zeitraumVon: von,
    zeitraumBis: bis,
    monate,
    positionen: umlagefaehig,
    ausgenommen,
    umlageGesamt,
    co2,
    kostenNachCo2,
    nkVorauszahlungMonat,
    vorauszahlungGeleistet,
    saldo,
  };
}

export function deDatum(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
}
