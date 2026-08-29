// Mapping localStorage-Format → PDF-Format für den Kreditantrag.
//
// Eigene Datei, weil genau hier ein Fehler steckte: Die Route prüfte auf
// `kaufpreis`, die im Browser gespeicherte KaufAuswahl heißt das Feld aber
// `kp` (lib/kauf/auswahl.ts). Ergebnis: Das PDF ging ohne Objektteil zur Bank.
// Inline in der Route war das nicht testbar (Auth + Supabase nötig) — als
// reine Funktion ist es das, siehe tests/kreditantrag.test.ts.

import type { KreditObjekt } from "@/lib/pdf/kreditantragPdf";

/** Rohform, wie sie aus dem localStorage bzw. dem Formularfeld hereinkommt. */
export type AuswahlEingang = Partial<KreditObjekt> & { kp?: number };

/**
 * Baut den Objektteil des Kreditantrags.
 * @param auswahl  gewähltes Objekt (localStorage-Format) oder null
 * @param eigenkapital  aus der Selbstauskunft berechnet
 * @param wunschDarlehen  aus dem Darlehenswunsch; 0 = aus Gesamtinvest − EK ableiten
 */
export function baueKreditObjekt(
  auswahl: AuswahlEingang | null | undefined,
  eigenkapital: number,
  wunschDarlehen: number,
): KreditObjekt | null {
  // `kp` ist das echte Feld; `kaufpreis` bleibt als Alias erlaubt (ältere
  // gespeicherte Stände und Direktaufrufe der Route).
  const kaufpreis = Number(auswahl?.kp ?? auswahl?.kaufpreis) || 0;
  if (!auswahl || kaufpreis <= 0) return null;

  const gesamtInvest = Number(auswahl.gesamtInvest) || 0;
  return {
    name: auswahl.name ?? "",
    adresse: auswahl.adresse ?? "",
    kaufpreis,
    gesamtInvest,
    eigenkapital,
    darlehen: wunschDarlehen > 0 ? wunschDarlehen : Math.max(0, gesamtInvest - eigenkapital),
    kaltmiete: Number(auswahl.kaltmiete) || 0,
  };
}
