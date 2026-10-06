// Mietart vereinheitlichen. Die Datenbank enthält beide Schreibweisen
// („Index“/„Standard“ aus Import und Demo, „index“/„standard“ aus dem
// Formular). Ein exakter Vergleich mit "index" zeigte für „Index“ deshalb
// „Standard“, während die Fristen (toLowerCase) „Indexmiete prüfen“ meldeten
// (Scan 06.10.2026). Jede Stelle, die die Mietart auswertet, nimmt diese Funktion.

export type Mietart = "standard" | "staffel" | "index";

export function normMietart(wert: string | null | undefined): Mietart {
  const s = (wert ?? "").trim().toLowerCase();
  if (s.startsWith("staffel")) return "staffel";
  if (s.startsWith("index")) return "index";
  return "standard";
}

export const MIETART_LABEL: Record<Mietart, string> = {
  standard: "Standard",
  staffel: "Staffelmiete",
  index: "Indexmiete",
};
