// IBAN-Normalisierung + Prüfsummen-Validierung nach ISO 13616 (Mod-97).
// Fängt Tippfehler ab, die ein reiner Längen-Check durchlässt.

export function normalizeIban(raw: string): string {
  return raw.replace(/\s/g, "").toUpperCase();
}

/** true, wenn Grundform UND Prüfziffer (Mod-97 = 1) stimmen. */
export function isValidIban(raw: string): boolean {
  const iban = normalizeIban(raw);
  // Ländercode (2 Buchstaben) + Prüfziffer (2 Ziffern) + 11–30 alphanum.
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;

  // Die ersten vier Zeichen ans Ende, Buchstaben → Zahlen (A=10 … Z=35).
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code =
      ch >= "A" && ch <= "Z" ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of code) {
      remainder = (remainder * 10 + Number(d)) % 97;
    }
  }
  return remainder === 1;
}
