// Termin über Bank- und Makler-Link (06.10.2026, Vorgabe des Betreibers): Die Bank (bzw. der
// Makler) gibt 1–3 Termine zur Auswahl ODER hinterlässt eine Telefonnummer für einen Rückruf.
// Reine Helfer ohne Datenbank (prüfbar). Die Datenbank prüft Zeitpunkte, Telefonnummer und
// Mengen ein zweites Mal (`freigabe_public_termin`, Migration 20261006120000).

import type { FreigabeArt } from "@/lib/freigabeCode";

export type TerminModus = "termine" | "rueckruf";
export type TerminStatus = "offen" | "bestaetigt" | "abgelehnt" | "erledigt";

export const TERMIN_MAX_VORSCHLAEGE = 3;
export const TERMIN_MAX_TAGE = 180;

/** Was die Link-Seite über ihre eigenen Vorschläge sieht (ohne Telefonnummer, ohne Name). */
export type OeffentlicherTermin = {
  modus: TerminModus;
  vorschlaege: string[];
  ort: string | null;
  status: TerminStatus;
  gewaehlt: string | null;
  antwort: string | null;
  created_at: string;
};

/** Zeile für den Eigentümer. */
export type FreigabeTerminZeile = {
  id: string;
  art: FreigabeArt;
  token: string;
  modus: TerminModus;
  vorschlaege: string[];
  ort: string | null;
  name: string | null;
  telefon: string | null;
  nachricht: string | null;
  status: TerminStatus;
  gewaehlt: string | null;
  antwort: string | null;
  created_at: string;
};
export const TERMIN_SPALTEN = "id,art,token,modus,vorschlaege,ort,name,telefon,nachricht,status,gewaehlt,antwort,created_at";

/**
 * „2026-10-09T14:30“ aus einem `datetime-local`-Feld ist eine BERLINER Ortszeit — der Server läuft
 * in UTC. Ohne Umrechnung läge jeder Termin eine bzw. zwei Stunden daneben (Sommer-/Winterzeit).
 * Gibt ISO in UTC zurück oder null bei ungültiger Eingabe.
 */
export function berlinZuIso(lokal: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(lokal ?? "").trim());
  if (!m) return null;
  const [j, mo, t, h, mi] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || t < 1 || t > 31 || h > 23 || mi > 59) return null;
  const wunsch = Date.UTC(j, mo - 1, t, h, mi);
  // Versatz Berlins zu diesem Zeitpunkt bestimmen (zweimal, wegen der Umstellungsnacht).
  let utc = wunsch;
  for (let i = 0; i < 2; i++) utc = wunsch - versatzMs(utc);
  const probe = new Date(utc);
  const zurueck = berlinTeile(probe);
  // Gibt es die Uhrzeit nicht (Sprung im März), ist das Ergebnis eine andere Uhrzeit → ungültig.
  if (zurueck.j !== j || zurueck.mo !== mo || zurueck.t !== t || zurueck.h !== h || zurueck.mi !== mi) return null;
  return probe.toISOString();
}

function berlinTeile(d: Date) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(d);
  const w = (typ: string) => Number(f.find((p) => p.type === typ)?.value);
  return { j: w("year"), mo: w("month"), t: w("day"), h: w("hour"), mi: w("minute") };
}

function versatzMs(utc: number): number {
  const b = berlinTeile(new Date(utc));
  return Date.UTC(b.j, b.mo - 1, b.t, b.h, b.mi) - Math.floor(utc / 60000) * 60000;
}

/** „Do., 09.10.2026, 14:30 Uhr“ — immer in Berliner Zeit. */
export function terminText(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }) + " Uhr";
}

/** Telefonnummer: Ziffern, Leerzeichen, + ( ) / -; mindestens 6 Ziffern. Wie die Datenbank. */
export function telefonGueltig(s: string): boolean {
  const t = String(s ?? "").trim();
  return /^\+?[0-9 ()/-]{6,30}$/.test(t) && t.replace(/\D/g, "").length >= 6;
}

/** `tel:`-Link nur aus Ziffern und führendem + (kein Text durch die Hintertür). */
export function telLink(s: string): string | null {
  if (!telefonGueltig(s)) return null;
  const t = s.trim();
  return `tel:${t.startsWith("+") ? "+" : ""}${t.replace(/\D/g, "")}`;
}

export const TERMIN_STATUS_TEXT: Record<TerminStatus, string> = {
  offen: "Wartet auf Antwort",
  bestaetigt: "Bestätigt",
  abgelehnt: "Keiner passt",
  erledigt: "Erledigt",
};

/** Antwort der Datenbank → Meldung auf der Link-Seite. */
export function terminMeldung(antwort: string | null | undefined): string | null {
  switch (antwort) {
    case "ok": return null;
    case "offen": return "Es gibt schon einen offenen Vorschlag. Bitte warten Sie die Antwort des Eigentümers ab.";
    case "limit": return "Über diesen Link wurden schon viele Termine vorgeschlagen. Bitte den Eigentümer direkt kontaktieren.";
    case "format": return "Bitte 1 bis 3 Zeitpunkte in den nächsten 180 Tagen angeben bzw. eine gültige Telefonnummer.";
    default: return "Dieser Link ist abgelaufen oder wurde widerrufen. Bitte die Seite neu laden.";
  }
}

/** Wohin der Eigentümer springt. */
export function terminOrt(art: FreigabeArt, propId: string | null): string {
  if (art === "bank") return propId ? `/properties/${propId}/beleihung#termin` : "/properties";
  return "/makler#termin";
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsZeit = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Ein einzelner Termin als .ics (RFC 5545), Beginn in UTC, Dauer in Minuten. */
export function terminIcs(t: { start: string; minuten?: number; titel: string; ort?: string | null; beschreibung?: string | null; uid: string }): string {
  const beginn = new Date(t.start);
  const ende = new Date(beginn.getTime() + (t.minuten ?? 60) * 60000);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MyImmo//Freigabe-Termin//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${t.uid}`,
    `DTSTAMP:${icsZeit(new Date())}`,
    `DTSTART:${icsZeit(beginn)}`,
    `DTEND:${icsZeit(ende)}`,
    `SUMMARY:${esc(t.titel)}`,
    ...(t.ort ? [`LOCATION:${esc(t.ort)}`] : []),
    ...(t.beschreibung ? [`DESCRIPTION:${esc(t.beschreibung)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
