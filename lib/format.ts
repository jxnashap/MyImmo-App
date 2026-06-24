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

// „€ 860.000" — Schreibweise wie in der ursprünglichen App (Symbol vorne, gerundet)
export const euro = (n: number | null | undefined) =>
  n == null
    ? "–"
    : "€ " + new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(Math.round(n));

// Datum „2008-08-02" -> „2.8.2008" (de-DE, ohne führende Nullen)
export const datum = (d: string | null | undefined) => {
  if (!d) return "—";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
};

// Umlagefähigkeit nach BetrKV §2 — wie in der alten App
export function istUmlagefaehig(kat: string | null): "ja" | "nein" | "unklar" {
  const ja = ["Grundsteuer", "Versicherung", "Hausgeld / WEG", "Müll", "Abwasser", "Wasser", "Hausmeister", "Aufzug", "Allgemeinstrom", "Gartenpflege", "Straßenreinigung"];
  const nein = ["Reparatur", "Instandhaltung", "Verwaltung", "Makler"];
  if (!kat) return "unklar";
  if (ja.includes(kat)) return "ja";
  if (nein.includes(kat)) return "nein";
  return "unklar";
}
