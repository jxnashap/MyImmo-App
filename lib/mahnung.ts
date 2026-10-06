// Zahlungserinnerung / Mahnung aus einer offenen Miete (05.10.2026, Wunsch des Betreibers).
//
// EINE Stelle für den Sprung „offene Miete → vorausgefüllter Brief“: benutzt vom
// Rückstands-Wächter im Mietkonto UND von der Aufgabe „Mieteingang offen“ auf dem Dashboard.
//
// Versand: MyImmo verschickt die Mahnung NICHT selbst (Vorgabe des Betreibers: „wir halten
// uns aus dem Mailverkehr raus“). `briefMailLink` bereitet nur die Mail im Programm des
// Vermieters vor — Absender, „Gesendet“-Ordner und damit der Nachweis bleiben bei ihm.
// Reine Funktionen ohne Datenbank und ohne React.
import { dritterWerktag, monatLabel } from "@/lib/mietkonto";

export type ZahlungsBriefArt = "zahlungserinnerung" | "mahnung";

/**
 * Ist die Miete dieses Monats überfällig? Fällig am DRITTEN WERKTAG (§ 556b Abs. 1 BGB,
 * `dritterWerktag`) — vorher wäre eine Zahlungserinnerung schlicht verfrüht.
 */
export function mieteUeberfaellig(jahrMonat: string, heuteISO: string): boolean {
  return heuteISO.slice(0, 10) > dritterWerktag(jahrMonat);
}

/** ISO-Datum + n Tage, auf den Zahlen gerechnet (keine Ortszeit). */
function plusTage(iso: string, n: number): string {
  const [j, m, t] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(j, m - 1, t + n)).toISOString().slice(0, 10);
}

/** Zahlungsfrist im Brief: eine Woche ab heute. */
export const ZAHLUNGSFRIST_TAGE = 7;

/** Adresse des Brief-Generators, vorausgefüllt mit Betrag, Frist und Grund. */
export function zahlungsBriefUrl(o: {
  mieterId: string;
  jahrMonat: string;
  betrag: number;
  heuteISO: string;
  art: ZahlungsBriefArt;
}): string {
  const faellig = dritterWerktag(o.jahrMonat);
  // Datum ausgeschrieben wie die übrigen Briefdaten („5. Oktober 2026“), Apposition mit Artikel.
  const faelligText = `${Number(faellig.slice(8, 10))}. ${monatLabel(faellig.slice(0, 7))}`;
  const grund = `Es handelt sich um die Miete für ${monatLabel(o.jahrMonat)} (fällig am ${faelligText}, dem dritten Werktag des Monats, § 556b BGB).`;
  const q = new URLSearchParams({
    art: o.art,
    betrag: String(o.betrag),
    datum: plusTage(o.heuteISO, ZAHLUNGSFRIST_TAGE),
    grund,
  });
  return `/tenants/${o.mieterId}/dokument?${q.toString()}`;
}

// Bewusst schlicht: Eine Adresse, die hier nicht passt, landet NICHT im Link — lieber ein
// leeres An-Feld als ein Link, der eine fremde Zeichenkette (z. B. „?bcc=…“) mitträgt.
export const EMAIL = /^[^\s@?&#,;<>"]+@[^\s@?&#,;<>"]+\.[^\s@?&#,;<>"]+$/;

/**
 * `mailto:`-Link für die vorbereitete Mail. Das PDF hängt NICHT daran — ein mailto-Link
 * kann keine Anhänge tragen; der Text sagt deshalb „im Anhang“, und die Oberfläche lädt
 * das PDF vorher herunter (bzw. teilt es am Handy mit der Datei).
 */
export function briefMailLink(o: { an: string | null; betreff: string; mieterName: string; absender: string }): string {
  const an = o.an && EMAIL.test(o.an.trim()) ? o.an.trim() : "";
  const text = briefMailText(o);
  return `mailto:${an}?subject=${encodeURIComponent(o.betreff)}&body=${encodeURIComponent(text.replace(/\n/g, "\r\n"))}`;
}

/** Text der Mail — kurz; der Brief selbst steht im PDF. */
export function briefMailText(o: { betreff: string; mieterName: string; absender: string }): string {
  const anrede = o.mieterName.trim() ? `Guten Tag ${o.mieterName.trim()},` : "Guten Tag,";
  const gruss = o.absender.trim() ? `Mit freundlichen Grüßen\n${o.absender.trim()}` : "Mit freundlichen Grüßen";
  return `${anrede}\n\nim Anhang erhalten Sie mein Schreiben „${o.betreff}“ als PDF.\n\n${gruss}`;
}
