// Pure Parser für den Willkommens-Assistenten (deutsche Eingaben, testbar).

/** "189.000" → 189000 · "1.234,56" → 1234.56 · "3,9" → 3.9 · "3.9" → 3.9 · "" → null */
export function zahlDe(s: string | null | undefined): number | null {
  const t = (s ?? "").trim().replace(/[€\s]/g, "");
  if (!t) return null;
  const norm = /,\d{1,2}$/.test(t)
    ? t.replace(/\./g, "").replace(",", ".") // Komma-Dezimal: Punkte sind Tausender
    : t.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."); // sonst nur 3er-Gruppen-Punkte entfernen
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

/** "1.8.2026" / "01.08.2026" → "2026-08-01"; ISO wird durchgereicht; sonst null. */
export function datumIsoDe(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const [, tag, monat, jahr] = m;
  const d = new Date(Number(jahr), Number(monat) - 1, Number(tag));
  if (d.getFullYear() !== Number(jahr) || d.getMonth() !== Number(monat) - 1 || d.getDate() !== Number(tag)) return null;
  return `${jahr}-${monat.padStart(2, "0")}-${tag.padStart(2, "0")}`;
}

/** "Anna Berger" → { vorname: "Anna", nachname: "Berger" }; "Berger" → nur Nachname. */
export function nameSplit(s: string): { vorname: string | null; nachname: string } {
  const teile = s.trim().split(/\s+/);
  if (teile.length <= 1) return { vorname: null, nachname: teile[0] ?? "" };
  return { vorname: teile.slice(0, -1).join(" "), nachname: teile[teile.length - 1] };
}
