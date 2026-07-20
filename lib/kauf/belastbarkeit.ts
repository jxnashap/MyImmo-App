// "Belastbarkeit deiner Eingaben": misst NUR, wie vollständig die Eingaben im
// Objekt-Rechner sind — KEINE Bewertung des Objekts/Deals (§ 34i), keine
// Wertermittlung. Transparente Feld-Zählung; die offenen Bausteine werden
// namentlich genannt.

export type BelastbarkeitInput = {
  nutzung: "vermietung" | "eigennutzung";
  kp: number;
  fl: number;
  kaltmiete: number;
  hausgeld: number;
  adresseGesetzt: boolean;
  maklerEntschieden: boolean; // Provisionsfrei-Checkbox ODER Wert bewusst getippt
  bewirtGesetzt: boolean;     // bewirt-Feld nicht geleert (Default "20" zählt)
};

export type BelastbarkeitBaustein = { key: string; label: string; punkte: number; erfuellt: boolean };

export type BelastbarkeitErgebnis = {
  prozent: number;
  bausteine: BelastbarkeitBaustein[];
  offen: BelastbarkeitBaustein[];
  stufe: string;
};

function stufeFuer(p: number): string {
  if (p >= 80) return "Sehr belastbar";
  if (p >= 50) return "Belastbar";
  if (p >= 25) return "Grobe Näherung";
  return "Erste Schätzung";
}

export function belastbarkeit(i: BelastbarkeitInput): BelastbarkeitErgebnis {
  const bausteine: BelastbarkeitBaustein[] = i.nutzung === "vermietung"
    ? [
        { key: "kp", label: "Kaufpreis", punkte: 25, erfuellt: i.kp > 0 },
        { key: "fl", label: "Wohnfläche", punkte: 15, erfuellt: i.fl > 0 },
        { key: "miete", label: "Kaltmiete", punkte: 25, erfuellt: i.kaltmiete > 0 },
        { key: "adr", label: "Bezeichnung/Adresse", punkte: 10, erfuellt: i.adresseGesetzt },
        { key: "makler", label: "Maklerkosten geklärt", punkte: 15, erfuellt: i.maklerEntschieden },
        { key: "bewirt", label: "Bewirtschaftung", punkte: 10, erfuellt: i.bewirtGesetzt },
      ]
    : [
        { key: "kp", label: "Kaufpreis", punkte: 35, erfuellt: i.kp > 0 },
        { key: "fl", label: "Wohnfläche", punkte: 20, erfuellt: i.fl > 0 },
        { key: "hg", label: "Laufende Kosten", punkte: 20, erfuellt: i.hausgeld > 0 },
        { key: "adr", label: "Bezeichnung/Adresse", punkte: 10, erfuellt: i.adresseGesetzt },
        { key: "makler", label: "Maklerkosten geklärt", punkte: 15, erfuellt: i.maklerEntschieden },
      ];
  const prozent = Math.min(100, bausteine.filter((b) => b.erfuellt).reduce((s, b) => s + b.punkte, 0));
  return { prozent, bausteine, offen: bausteine.filter((b) => !b.erfuellt), stufe: stufeFuer(prozent) };
}
