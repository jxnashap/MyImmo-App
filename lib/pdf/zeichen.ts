// EINE Zeichen-Bereinigung für alle PDF-Builder (Design-Scan 06.10.2026).
//
// Die eingebauten Standardschriften (Helvetica/Times) kennen nur WinAnsi. Bis hierhin hatte jeder
// Builder eine eigene Kopie von sanitize(), und alle machten aus jedem Zeichen jenseits von Latin-1
// ein „?“: Die Demo-Mieterin „Yılmaz“ hieß in jedem Brief „Y?lmaz“ (ı zerfällt bei NFKD nicht), im
// Jahresbericht stand „Kreditrate ? Zins“ (echtes Minuszeichen U+2212). Reihenfolge hier:
// (1) feste Ersatztabelle für Buchstaben ohne Zerlegung und gängige Satzzeichen, (2) NFKD und
// Akzente abstreifen (Č→C, ș→s), (3) erst dann „?“ (z. B. Kyrillisch).

const ERSATZ: Record<string, string> = {
  "ı": "i", "İ": "I", "ł": "l", "Ł": "L", "đ": "d", "Đ": "D", "ħ": "h", "Ħ": "H", "ŋ": "n", "Ŋ": "N",
  "ſ": "s", "ĸ": "k", "œ": "oe", "Œ": "OE", "ẞ": "SS",
  "‘": "'", "’": "'", "‚": "'", "′": "'", "‹": "'", "›": "'",
  "“": '"', "”": '"', "„": '"', "″": '"',
  "–": "-", "—": "-", "−": "-", "‐": "-", "‑": "-", "‒": "-",
  "…": "...", "→": "->", "←": "<-", "≤": "<=", "≥": ">=", "≈": "~", "•": "·", "✓": "x",
  " ": " ", " ": " ", " ": " ", " ": " ", "­": "", "​": "",
};

/** Ein einzelnes Zeichen, das Helvetica/Times (WinAnsi) darstellen kann. */
function ersetze(c: string): string {
  if (c in ERSATZ) return ERSATZ[c];
  const code = c.charCodeAt(0);
  // Latin-1 ohne den Steuerzeichen-Block 0x80–0x9F; € liegt in WinAnsi auf 0x80.
  if (c === "€" || code < 0x80 || (code >= 0xa0 && code <= 0xff)) return c;
  const basis = c.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  if (basis && [...basis].every((b) => b.charCodeAt(0) < 0x80 || (b.charCodeAt(0) >= 0xa0 && b.charCodeAt(0) <= 0xff))) return basis;
  return "?";
}

/** Text für drawText() mit einer Standardschrift. */
export function pdfText(s: string | null | undefined): string {
  return Array.from(s ?? "", ersetze).join("");
}
