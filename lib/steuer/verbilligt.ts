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
  /** @deprecated wird nicht mehr einbezogen — separater Stellplatz hat keinen
   *  Wohnungs-Vergleichswert; siehe berechneVerbilligt(). Feld nur aus
   *  Kompatibilitätsgründen erhalten. */
  stellplatzMiete?: number | null;
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
  // Warmmiete = Kaltmiete + NK-Vorauszahlung; NK auf beiden Seiten identisch
  // angesetzt (bestverfügbare Näherung). Eine separate Stellplatzmiete bleibt
  // AUSSEN vor: für sie gibt es keinen Wohnungs-Vergleichswert, sie nur im
  // Zähler anzusetzen würde den Prozentsatz künstlich Richtung 100 % heben und
  // eine echte Verbilligung verdecken. Ein mit der Wohnung vermieteter
  // Stellplatz ist über die Kaltmiete bereits erfasst.
  const istWarm = rund2(kalt + nk);
  const vergleichWarm = rund2(vergleichKalt + nk);
  // Grenzen UNGERUNDET vergleichen (Audit P7, C26): 659,95 / 1.000 = 65,995 % wurde vorher auf
  // 66,00 % gerundet und galt als „voll entgeltlich“. Angezeigt wird abgeschnitten (65,99 %), damit
  // die Zahl nie über der Grenze steht, die sie nicht erreicht.
  const roh = vergleichWarm > 0 ? (istWarm / vergleichWarm) * 100 : 0;
  const prozent = Math.floor(roh * 100 + 1e-9) / 100;

  let status: VerbilligtStatus;
  let hinweis: string;
  if (roh >= 66) {
    status = "gruen";
    hinweis = "Voll entgeltlich (≥ 66 %). Die Werbungskosten sind zu 100 % abziehbar.";
  } else if (roh >= 50) {
    status = "gelb";
    hinweis = "50–66 %: Voller Werbungskostenabzug nur bei positiver Totalüberschussprognose (30 Jahre), sonst anteilige Kürzung. Miete anheben schafft Sicherheit.";
  } else {
    status = "rot";
    hinweis = "Unter 50 %: Die Vermietung wird in einen entgeltlichen und einen unentgeltlichen Teil aufgeteilt — Werbungskosten nur anteilig abziehbar.";
  }

  return { status, prozent, istWarm, vergleichWarm, hinweis };
}

/**
 * Welche Vergleichsmiete gilt (02.10.2026): der Wert am Mieter (Mietspiegel der Wohnung) hat
 * Vorrang; fehlt er, die Vergleichsmiete am Objekt. Vorher blieb die Ampel in diesem Fall
 * unsichtbar, obwohl der Vermieter den Wert schon am Objekt gepflegt hatte.
 */
export function vergleichsmieteFuer(
  mieterWert: number | null | undefined,
  objektWert: number | null | undefined,
): { wert: number; quelle: "mieter" | "objekt" } | null {
  if (mieterWert != null && mieterWert > 0) return { wert: mieterWert, quelle: "mieter" };
  if (objektWert != null && objektWert > 0) return { wert: objektWert, quelle: "objekt" };
  return null;
}
