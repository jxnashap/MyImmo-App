// Rücklauf über Bank- und Makler-Link (06.10.2026): Was Bank oder Makler über ihren Link
// zurückschicken, landet im EINGANG des Eigentümers — nicht direkt im Archiv. Reine Helfer,
// ohne Datenbank (prüfbar). Die Datenbank prüft Typ, Größe und Mengen ein zweites Mal
// (`freigabe_public_hochladen`, Migration 20261006090000).

import type { FreigabeArt } from "@/lib/freigabeCode";

export const EINGANG_MAX_BYTES = 8 * 1024 * 1024;
export const EINGANG_TYPEN = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export type EingangTyp = (typeof EINGANG_TYPEN)[number];

/** Was das Formular im Datei-Dialog anbietet. Entscheidend ist aber der Dateikopf (unten). */
export const EINGANG_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";

/**
 * Typ aus den ERSTEN BYTES, nicht aus Dateiname oder Browser-Angabe — beides bestimmt der
 * Absender. Eine umbenannte HTML-Datei „vertrag.pdf“ fällt hier durch.
 */
export function erkenneEingangTyp(b: Uint8Array): EingangTyp | null {
  const ist = (pos: number, ...werte: number[]) => werte.every((w, i) => b[pos + i] === w);
  if (b.length >= 5 && ist(0, 0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf"; // %PDF-
  if (b.length >= 3 && ist(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (b.length >= 8 && ist(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (b.length >= 12 && ist(0, 0x52, 0x49, 0x46, 0x46) && ist(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp"; // RIFF….WEBP
  return null;
}

/** Dateiname ohne Pfad und Steuerzeichen, höchstens 200 Zeichen. */
export function bereinigeDateiname(name: string): string {
  const ohnePfad = String(name ?? "").split(/[\\/]/).pop() ?? "";
  const sauber = ohnePfad.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (sauber || "Dokument").slice(0, 200);
}

export type EingangStatus = "neu" | "uebernommen" | "verworfen";

export const EINGANG_STATUS_TEXT: Record<EingangStatus, string> = {
  neu: "Eingegangen",
  uebernommen: "Übernommen",
  verworfen: "Nicht übernommen",
};

/** Antwort der Datenbank → Meldung für Bank oder Makler. */
export function hochladeMeldung(antwort: string | null | undefined): string | null {
  switch (antwort) {
    case "ok": return null;
    case "limit": return "Über diesen Link wurden schon viele Dateien geschickt. Bitte später erneut versuchen oder den Eigentümer direkt kontaktieren.";
    case "format": return "Nur PDF, JPG, PNG oder WebP bis 8 MB.";
    default: return "Dieser Link ist abgelaufen oder wurde widerrufen. Bitte die Seite neu laden.";
  }
}

/** Wohin der Eigentümer im Eingang springt. */
export function eingangOrt(art: FreigabeArt, propId: string | null): string {
  if (art === "bank") return propId ? `/properties/${propId}/beleihung#eingang` : "/properties";
  return "/makler#eingang";
}

/** Spalten für Listen — NIE `datei_data` (bis 11 MB je Zeile). */
export const EINGANG_SPALTEN = "id,art,token,absender,nachricht,datei_name,datei_type,datei_size,status,notiz_id,created_at,entschieden_am";

export type EingangZeile = {
  id: string;
  art: FreigabeArt;
  token: string;
  absender: string | null;
  nachricht: string | null;
  datei_name: string;
  datei_type: string;
  datei_size: number;
  status: EingangStatus;
  notiz_id: string | null;
  created_at: string;
  entschieden_am: string | null;
};
