// Mietkonto für den Mieter: Soll und bestätigte Zahlungen je Monat (02.10.2026, Schritt 6
// aus docs/zukunft/MIETERPORTAL-AUSBAU.md § 9). Reine Funktion, prüfbar.
//
// VORSICHT IM WORTLAUT: Grundlage sind die Buchungen des VERMIETERS. Fehlt dort eine Zahlung,
// heißt das nicht, dass der Mieter nicht gezahlt hat — vielleicht ist sie nur nicht gebucht.
// Deshalb gibt es hier kein „Rückstand“ und keine Summe „du schuldest“, sondern
// „bestätigt“ / „teilweise bestätigt“ / „noch nicht bestätigt“, und daneben den Weg, den
// Vermieter darauf anzusprechen. Ein falsches „Rückstand 900 €“ im Portal wäre ein Streit,
// den die App ausgelöst hat.
//
// Das Soll rechnet DIESELBE Funktion wie das Mietkonto des Vermieters (`sollFuerMonat`),
// mit den Miet-Zeiträumen aus der Sicht `miet_zeitraeume_portal`.
import { sollFuerMonat, dritterWerktag, ymPlus, zuJahrMonat, type MietkontoMieter, type MietkontoZeitraum } from "@/lib/mietkonto";
import { mieteBezahlt } from "@/lib/mietStatus";

export type KontoZahlung = {
  buchungsdatum: string | null;
  kategorie: string | null;
  betrag: number | null;
  soll_monat?: string | null;
};

export type KontoStatus = "bestaetigt" | "teilweise" | "offen" | "noch_nicht_faellig";

export type KontoMonat = {
  jahrMonat: string;
  soll: number;
  ist: number;
  status: KontoStatus;
  /** Fälligkeit (3. Werktag, § 556b Abs. 1 BGB). */
  faellig: string;
};

export const KONTO_MONATE = 12;
// „Bestätigt“ über `mieteBezahlt` (lib/mietStatus.ts) — DIESELBE Toleranz wie beim Vermieter
// (Audit P7, B11: vorher 0,50 € hier und 1,00 € dort → 999,20 € von 1.000 € hieß beim Vermieter
// „bezahlt“, beim Mieter „teilweise“).

const rund = (x: number) => Math.round(x * 100) / 100;

export function mieterKonto(
  mieter: MietkontoMieter,
  zeitraeume: MietkontoZeitraum[],
  zahlungen: KontoZahlung[],
  heute: string,
): KontoMonat[] {
  const heuteYm = heute.slice(0, 7);
  // Zahlungen im MIETmonat (soll_monat schlägt das Buchungsdatum), Miete und Nebenkosten.
  const ist = new Map<string, number>();
  for (const z of zahlungen) {
    const kat = (z.kategorie ?? "").toLowerCase();
    if (kat !== "miete" && kat !== "nebenkosten") continue;
    const ym = z.soll_monat ?? zuJahrMonat(z.buchungsdatum);
    if (!ym) continue;
    ist.set(ym, (ist.get(ym) ?? 0) + (z.betrag ?? 0));
  }

  const monate: KontoMonat[] = [];
  for (let i = 0; i < KONTO_MONATE; i++) {
    const ym = ymPlus(heuteYm, -i);
    const soll = sollFuerMonat(mieter, zeitraeume, ym);
    if (!soll || soll.gesamt <= 0) continue;
    const faellig = dritterWerktag(ym);
    const betrag = rund(ist.get(ym) ?? 0);
    let status: KontoStatus;
    if (mieteBezahlt(soll.gesamt, betrag)) status = "bestaetigt";
    else if (betrag > 0) status = "teilweise";
    else if (heute < faellig) status = "noch_nicht_faellig";
    else status = "offen";
    monate.push({ jahrMonat: ym, soll: rund(soll.gesamt), ist: betrag, status, faellig });
  }
  return monate; // neuester Monat zuerst
}

export const KONTO_STATUS_TEXT: Record<KontoStatus, string> = {
  bestaetigt: "bestätigt",
  teilweise: "teilweise bestätigt",
  offen: "noch nicht bestätigt",
  noch_nicht_faellig: "noch nicht fällig",
};
