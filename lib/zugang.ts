// Zugang einer Zustellung im Mieterportal (Gesamtprüfung P4, B43, 09.10.2026).
//
// Eine Erklärung wirkt erst mit ZUGANG (§ 130 BGB), und den muss der Vermieter beweisen. Dass ein
// Dokument im Portal liegt, belegt ihn nicht — Rechtsprechung zum Mail-/Portal-Zugang gibt es nur
// für Unternehmer (BGH VII ZR 895/21), zu Verbrauchern ist sie offen (Anwaltsfrage 1). Belegt ist
// nur der ABRUF (`zustellungen.gelesen_am`, gesetzt von der Datei-Route). Vorher meldete die App
// „Im Mieterportal zugestellt ✓“ — ohne Hinweis, und ohne zu sagen, dass die Hinweis-Mail ohne
// eingerichteten Versand nie hinausgeht.
//
// Reine Funktionen und Texte — EINE Stelle für Brief-Versand, NK-Zustellung, Archiv-Zustellung
// und die Dashboard-Aufgabe.
import type { Ergebnis } from "@/lib/benachrichtigung";

/** Steht vor dem Zustellen in der Bestätigungskarte und nach dem Zustellen in der Meldung. */
export const ZUGANG_HINWEIS =
  "Zugegangen ist das Dokument erst, wenn der Mieter es im Portal abruft — das siehst du auf der Mieterseite. Bei Fristsachen (Nebenkostenabrechnung, Mieterhöhung) zusätzlich per Post oder Bote zustellen.";

/** Ab so vielen Tagen ohne Abruf erscheint eine Aufgabe auf dem Dashboard. */
export const NICHT_ABGERUFEN_TAGE = 7;

/**
 * Was ist aus der Hinweis-Mail geworden? Ein Satz für die Meldung nach dem Zustellen — oder
 * `null`, wenn es nichts zu sagen gibt (verschickt, Demo). Bei mehreren Empfängern zählt das
 * schlechteste Ergebnis.
 */
export function hinweisMailText(ergebnisse: Ergebnis[]): string | null {
  if (ergebnisse.length === 0) return null;
  if (ergebnisse.includes("kein_versand")) {
    return "Keine Hinweis-Mail: Der Mailversand ist nicht eingerichtet — der Mieter sieht das Dokument erst bei seinem nächsten Besuch im Portal.";
  }
  if (ergebnisse.includes("fehler") || ergebnisse.includes("kein_konto")) {
    return "Die Hinweis-Mail an den Mieter ließ sich nicht verschicken — der Mieter sieht das Dokument erst bei seinem nächsten Besuch im Portal.";
  }
  if (ergebnisse.includes("abbestellt")) {
    return "Der Mieter hat Hinweis-Mails abbestellt — er sieht das Dokument bei seinem nächsten Besuch im Portal.";
  }
  if (ergebnisse.includes("gebremst")) return "Eine Hinweis-Mail ging in den letzten Minuten schon hinaus — keine zweite.";
  return null;
}

const tageVor = (iso: string, n: number) => {
  const [j, m, t] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(j, m - 1, t - n)).toISOString().slice(0, 10);
};

/** Wie weit das Dashboard zurückschaut — ältere Zustellungen sind erledigt oder vergessen. */
export const ZUSTELL_FENSTER_TAGE = 120;
export const zustellFensterAb = (heuteISO: string) => tageVor(heuteISO, ZUSTELL_FENSTER_TAGE);

/** Zustellung aus der Datenbank, soweit die Aufgabe sie braucht (eine Zeile je Portal-Konto). */
export type ZustellungOffen = {
  notiz_id: string | null;
  mieter_id: string | null;
  titel: string | null;
  zugestellt_am: string;
  gelesen_am: string | null;
  zurueckgezogen_am: string | null;
};

/**
 * Dokumente, die seit mindestens `NICHT_ABGERUFEN_TAGE` Tagen KEIN Konto abgerufen hat — eines
 * je Dokument, auch wenn es an mehrere Konten ging. Zurückgezogene zählen nicht.
 */
export function nichtAbgerufen(zeilen: ZustellungOffen[], heuteISO: string): ZustellungOffen[] {
  const grenze = tageVor(heuteISO, NICHT_ABGERUFEN_TAGE);
  const gruppen = new Map<string, ZustellungOffen[]>();
  for (const z of zeilen) {
    if (z.zurueckgezogen_am || !z.mieter_id) continue;
    const k = z.notiz_id ?? `${z.mieter_id}|${z.titel ?? ""}`;
    gruppen.set(k, [...(gruppen.get(k) ?? []), z]);
  }
  const offen: ZustellungOffen[] = [];
  for (const g of gruppen.values()) {
    if (g.some((z) => z.gelesen_am)) continue;
    const erste = [...g].sort((a, b) => a.zugestellt_am.localeCompare(b.zugestellt_am))[0];
    if (erste.zugestellt_am.slice(0, 10) <= grenze) offen.push(erste);
  }
  return offen.sort((a, b) => a.zugestellt_am.localeCompare(b.zugestellt_am));
}
