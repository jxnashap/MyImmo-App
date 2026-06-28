// Zentrales DIN-5008-Form-B-Adressfeld für ALLE Brief-PDFs (Fensterumschlag).
// Eine einzige Quelle der Wahrheit: jede PDF-Erzeugung mit Briefanschrift ruft
// `zeichneAdressfeld()` auf, damit die Empfängeranschrift in jedem Dokument
// exakt gleich positioniert ist und im DIN-lang-Fenster vollständig sichtbar.
//
// Geometrie (DIN 5008 Form B, A4 Hochformat 210×297 mm):
//   • pdf-lib hat den Ursprung unten links → y immer von der Seitenhöhe abziehen.
//   • 1 mm = 2,8346 pt, A4 = 595,28 × 841,89 pt.
//   • Adressfeld: 20 mm von links, 45 mm von oben, 85 mm breit, 45 mm hoch.
//   • Zusatz-/Vermerkzone (optional, oben): 45–62,7 mm (max. 17,7 mm ≈ 5 Zeilen).
//   • Anschriftzone (Empfänger): ab 62,7 mm (max. 27,3 mm ≈ 6 Zeilen).
//   • Ohne Vermerkzone darf die Anschrift direkt bei 45 mm beginnen.

import { rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { adressZeilen } from "@/lib/format";

const MM = 2.8346;
const PAGE_H = 841.89; // A4-Höhe in pt

const INK = rgb(0.13, 0.13, 0.12);
const MUTED = rgb(0.49, 0.49, 0.47);

// Feste Maße des Adressfelds (in pt, y von oben gemessen → von PAGE_H abgezogen).
export const ADRESSFELD = {
  x: 20 * MM,                       // 56,69 — linke Kante
  breite: 85 * MM,                  // 240,94
  hoehe: 45 * MM,                   // 127,56
  feldTopY: PAGE_H - 45 * MM,       // 714,33 — Oberkante Feld
  anschriftTopY: PAGE_H - 62.7 * MM, // 664,16 — Oberkante Anschriftzone
  bottomY: PAGE_H - 90 * MM,        // 586,78 — Unterkante Feld (= 45 mm hoch)
} as const;

// WinAnsi-sichere Bereinigung (Umlaute/€ bleiben, exotische Zeichen → ?).
function sanitize(s: string): string {
  return (s ?? "")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .split("")
    .map((c) => (c.charCodeAt(0) > 255 && c !== "€" ? "?" : c))
    .join("");
}

// Baut die Anschriftzeilen nach DIN 5008 aus Name + Adressfeld eines Datensatzes:
//   Name/Firma · (Zusatz) · Straße + Hausnummer · PLZ + Ort  (keine Leerzeile).
// Fehlt die Anschrift, kommt ein sauberer Hinweis statt eines leeren Feldes.
export function adressfeldZeilen(
  name: string | null | undefined,
  adresse: string | null | undefined,
): string[] {
  const zeilen: string[] = [];
  const n = (name ?? "").trim();
  if (n) zeilen.push(n);
  const adr = adressZeilen(adresse);
  if (adr.length) {
    zeilen.push(...adr);
  } else {
    zeilen.push(
      n
        ? "(Anschrift fehlt - bitte im Profil ergänzen)"
        : "(Empfänger unvollständig - bitte Daten ergänzen)",
    );
  }
  return zeilen;
}

export type AdressfeldOpts = {
  // Empfänger-Anschrift (Anschriftzone), max. 6 Zeilen — über `adressfeldZeilen`.
  empfaenger: string[];
  // Optionale Vermerkzone (z. B. "Einschreiben", "Per Boten"), max. 5 Zeilen.
  vermerk?: string[];
  // Kleine Rücksendeangabe (Absenderzeile) ganz oben im Fenster, einzeilig.
  ruecksende?: string | null;
  // Schriftgröße der Anschrift (DIN: 10–11 pt). Standard 10,5.
  size?: number;
};

// Zeichnet das Adressfeld an der festen DIN-Position und gibt die Unterkante (y)
// des Feldes zurück, damit der Brieftext darunter beginnen kann (kein Überlapp).
export function zeichneAdressfeld(
  page: PDFPage,
  font: PDFFont,
  opts: AdressfeldOpts,
): number {
  const x = ADRESSFELD.x;
  const ruecksende = (opts.ruecksende ?? "").trim();
  const vermerk = (opts.vermerk ?? []).filter(Boolean).slice(0, 5);
  let empf = opts.empfaenger.filter(Boolean).slice(0, 6);

  // Schriftgröße ggf. verkleinern, damit 6 Zeilen sicher in die Anschriftzone
  // (max. 27,3 mm) passen — DIN: notfalls Größe/Umbruch anpassen.
  let size = opts.size ?? 10.5;
  let lh = size + 2.5;
  const zoneHoehe = 27.3 * MM;
  while (empf.length * lh > zoneHoehe && size > 8) {
    size -= 0.5;
    lh = size + 2.5;
  }

  // Hat das Feld eine Vermerk-/Rücksendezone, beginnt die Anschrift bei 62,7 mm;
  // sonst direkt an der Feldoberkante (45 mm).
  const hatVermerkzone = !!ruecksende || vermerk.length > 0;
  const anschriftTop = hatVermerkzone ? ADRESSFELD.anschriftTopY : ADRESSFELD.feldTopY;

  // Rücksendeangabe (klein) ganz oben.
  if (ruecksende) {
    page.drawText(sanitize(ruecksende), {
      x,
      y: ADRESSFELD.feldTopY - 7,
      size: 7,
      font,
      color: MUTED,
    });
  }

  // Vermerkzone (z. B. "Vertraulich", "Einschreiben") — dunkel/sichtbar.
  let vy = ADRESSFELD.feldTopY - (ruecksende ? 20 : 10);
  for (const v of vermerk) {
    page.drawText(sanitize(v), { x, y: vy, size: 9.5, font, color: INK });
    vy -= 13;
  }

  // Anschriftzone (Empfänger) — linksbündig, ohne Sperrsatz.
  let y = anschriftTop - size;
  for (const z of empf) {
    page.drawText(sanitize(z), { x, y, size, font, color: INK });
    y -= lh;
  }

  return ADRESSFELD.bottomY;
}
