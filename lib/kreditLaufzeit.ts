// Anzeige der Kredit-Laufzeit.
//
// WARUM (externes Review, 30.09.2026): Die Kreditliste zeigte „Laufzeit bis
// 30". Das Formular fragte „Gesamtlaufzeit bis (Jahr)", Beispiel 2042 — aber
// ALLE vier echten Nutzer, die das Feld ausgefüllt hatten, trugen eine DAUER
// ein (live nachgezählt: 4 von 4 Werten unter 100, kein Endjahr). Das Feld
// fragt jetzt nach Jahren; diese Anzeige verträgt beide Lesarten, damit kein
// Bestand falsch erscheint:
//   Wert < 100   → Dauer in Jahren   („30 Jahre", mit Auszahlung „· bis 2051")
//   Wert ≥ 1900  → Endjahr (Altbestand) („bis 2042")

export function laufzeitText(laufzeit: number | null | undefined, auszahlung?: string | null): string {
  if (laufzeit == null || !Number.isFinite(laufzeit) || laufzeit <= 0) return "–";
  if (laufzeit >= 1900) return `bis ${Math.round(laufzeit)}`;
  if (laufzeit >= 100) return "–"; // weder Dauer noch plausibles Jahr
  const jahre = Math.round(laufzeit);
  const dauer = `${jahre} ${jahre === 1 ? "Jahr" : "Jahre"}`;
  const start = /^(\d{4})-/.exec(auszahlung ?? "");
  return start ? `${dauer} · bis ${Number(start[1]) + jahre}` : dauer;
}
