// Fristende nach Jahren — § 108 AO i. V. m. §§ 187, 188 BGB (Gesamtprüfung 07.10.2026, C19).
//
// § 188 Abs. 2 BGB: Eine Jahresfrist endet mit dem Ablauf des Tages, der durch seine Zahl dem
// Anfangstag entspricht (der Anschaffungstag selbst zählt nach § 187 Abs. 1 nicht mit).
// § 188 Abs. 3 BGB: Fehlt dieser Tag im letzten Monat — Kauf am 29.02., Fristende in einem
// Nicht-Schaltjahr —, endet die Frist mit dem Ablauf des letzten Tages dieses Monats.
//
// Vorher rechneten Spekulationsfrist und 15-%-Fenster mit `Date.setUTCFullYear`: Aus dem 29.02.
// wurde dabei der 01.03. — die Frist endete einen Tag zu spät. Hier wird nur auf den Zahlen des
// ISO-Datums gerechnet, ohne Ortszeit.

const zwei = (n: number) => String(n).padStart(2, "0");

/** Letzter Tag der Frist (ISO), die am `beginnIso` angestoßen wurde und `jahre` Jahre läuft. */
export function fristendeNachJahren(beginnIso: string, jahre: number): string {
  const j = Number(beginnIso.slice(0, 4)) + jahre;
  const m = Number(beginnIso.slice(5, 7));
  const t = Number(beginnIso.slice(8, 10));
  const letzter = new Date(Date.UTC(j, m, 0)).getUTCDate();
  return `${j}-${zwei(m)}-${zwei(Math.min(t, letzter))}`;
}

/** Der Tag nach `iso` (ISO). */
export function tagDanach(iso: string): string {
  const d = new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + 1));
  return d.toISOString().slice(0, 10);
}
