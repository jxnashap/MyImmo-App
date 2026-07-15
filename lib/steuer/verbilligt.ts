// Verbilligte Vermietung § 21 Abs. 2 EStG: Maßstab ist die ortsübliche
// Warmmiete. Ist-Miete/Vergleichsmiete
//   >= 66 %  → voll entgeltlich, 100 % Werbungskostenabzug
//   50–66 %  → nur bei positiver Totalüberschussprognose (30 J.), sonst Kürzung
//   < 50 %   → zwingende Aufteilung, Werbungskosten nur anteilig
// Reine Rechenfunktion. Keine Steuerberatung.

export type VerbilligtStatus = "inaktiv" | "gruen" | "gelb" | "rot";

export type VerbilligtInput = {
  kaltmiete: number | null;          // Ist-Kaltmiete / Monat
  nkVorauszahlung: number | null;    // NK-Vorauszahlung / Monat (für Warmmiete)
  stellplatzMiete?: number | null;   // optionale Stellplatzmiete / Monat
  vergleichKaltProM2: number | null; // ortsübliche Kaltmiete €/m² (mieter.mietspiegel)
  flaeche: number | null;            // m²
};

export type VerbilligtErgebnis = {
  status: VerbilligtStatus;
  prozent: number;          // Ist-Warmmiete / Vergleichs-Warmmiete * 100
  istWarm: number;
  vergleichWarm: number;
  hinweis: string;
};

const rund2 = (n: number) => Math.round(n * 100) / 100;

export function berechneVerbilligt(input: VerbilligtInput): VerbilligtErgebnis {
  const kalt = input.kaltmiete ?? 0;
  const nk = input.nkVorauszahlung ?? 0;
  const stellplatz = input.stellplatzMiete ?? 0;
  const vglProM2 = input.vergleichKaltProM2 ?? 0;
  const flaeche = input.flaeche ?? 0;

  const leer: VerbilligtErgebnis = { status: "inaktiv", prozent: 0, istWarm: 0, vergleichWarm: 0, hinweis: "" };

  if (!(kalt > 0)) {
    return { ...leer, hinweis: "Kaltmiete erfassen, um die Ampel zu aktivieren." };
  }
  if (!(vglProM2 > 0) || !(flaeche > 0)) {
    return { ...leer, hinweis: "Ortsübliche Vergleichsmiete (€/m²) und Fläche erfassen, um die Ampel zu aktivieren." };
  }

  const vergleichKalt = vglProM2 * flaeche;
  // Warmmiete = Kaltmiete (+ Stellplatz) + NK-Vorauszahlung; NK auf beiden
  // Seiten identisch angesetzt (bestverfügbare Näherung).
  const istWarm = rund2(kalt + stellplatz + nk);
  const vergleichWarm = rund2(vergleichKalt + nk);
  const prozent = vergleichWarm > 0 ? rund2((istWarm / vergleichWarm) * 100) : 0;

  let status: VerbilligtStatus;
  let hinweis: string;
  if (prozent >= 66) {
    status = "gruen";
    hinweis = "Voll entgeltlich (≥ 66 %). Die Werbungskosten sind zu 100 % abziehbar.";
  } else if (prozent >= 50) {
    status = "gelb";
    hinweis = "50–66 %: Voller Werbungskostenabzug nur bei positiver Totalüberschussprognose (30 Jahre), sonst anteilige Kürzung. Miete anheben schafft Sicherheit.";
  } else {
    status = "rot";
    hinweis = "Unter 50 %: Die Vermietung wird in einen entgeltlichen und einen unentgeltlichen Teil aufgeteilt — Werbungskosten nur anteilig abziehbar.";
  }

  return { status, prozent, istWarm, vergleichWarm, hinweis };
}
