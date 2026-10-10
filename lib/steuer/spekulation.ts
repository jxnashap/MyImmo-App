// Spekulationsfrist § 23 EStG: Der Gewinn aus dem Verkauf einer vermieteten
// Immobilie ist nach 10 Jahren ab Anschaffung steuerfrei. Reine Rechenfunktion.
// Keine Steuerberatung.

import { fristendeNachJahren, tagDanach } from "@/lib/steuer/frist";

export type SpekulationErgebnis = {
  aktiv: boolean;             // Kaufdatum vorhanden?
  steuerfreiAb: string | null; // YYYY-MM-DD (Kaufdatum + 10 Jahre)
  steuerfrei: boolean;        // Frist bereits abgelaufen?
  tageVerbleibend: number;    // bis zur Steuerfreiheit (0 wenn erreicht)
  jahreVerbleibend: number;   // gerundet, für die Anzeige
};

const TAG_MS = 86_400_000;

export function berechneSpekulation(kaufdatum: string | null, heute: Date = new Date()): SpekulationErgebnis {
  if (!kaufdatum || !/^\d{4}-\d{2}-\d{2}$/.test(kaufdatum)) {
    return { aktiv: false, steuerfreiAb: null, steuerfrei: false, tageVerbleibend: 0, jahreVerbleibend: 0 };
  }
  // § 108 AO i.V.m. § 187 Abs. 1, § 188 Abs. 2 BGB: Der Anschaffungstag zählt
  // nicht mit; die 10-Jahres-Frist endet erst mit Ablauf des Jahrestags. Der
  // Verkauf AM Jahrestag ist noch steuerpflichtig — steuerfrei erst am Folgetag.
  // Kauf am 29.02.: Fristende am letzten Februartag (§ 188 Abs. 3 BGB, C19).
  const steuerfreiAb = tagDanach(fristendeNachJahren(kaufdatum, 10));
  const frei = new Date(`${steuerfreiAb}T00:00:00Z`);

  const heuteMs = Date.UTC(heute.getUTCFullYear(), heute.getUTCMonth(), heute.getUTCDate());
  const diffTage = Math.ceil((frei.getTime() - heuteMs) / TAG_MS);
  const steuerfrei = diffTage <= 0;

  return {
    aktiv: true,
    steuerfreiAb,
    steuerfrei,
    tageVerbleibend: steuerfrei ? 0 : diffTage,
    jahreVerbleibend: steuerfrei ? 0 : Math.round((diffTage / 365) * 10) / 10,
  };
}
