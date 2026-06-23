export const eur = (n: number | null | undefined) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(n);

export const eur2 = (n: number | null | undefined) =>
  n == null
    ? "—"
    : new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 2,
      }).format(n);

// Umlagefähigkeit nach BetrKV §2 — wie in der alten App
export function istUmlagefaehig(kat: string | null): "ja" | "nein" | "unklar" {
  const ja = ["Grundsteuer", "Versicherung", "Hausgeld / WEG", "Müll", "Abwasser", "Wasser", "Hausmeister", "Aufzug", "Allgemeinstrom", "Gartenpflege", "Straßenreinigung"];
  const nein = ["Reparatur", "Instandhaltung", "Verwaltung", "Makler"];
  if (!kat) return "unklar";
  if (ja.includes(kat)) return "ja";
  if (nein.includes(kat)) return "nein";
  return "unklar";
}
