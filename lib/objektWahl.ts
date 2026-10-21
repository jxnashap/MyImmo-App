// Ein einziges Objekt vorwählen (21.10.2026, Durchsicht Paket 4).
//
// Wer genau ein Objekt hat (der Normalfall am Anfang), musste es in jedem Formular — Mieter,
// Darlehen, Buchung — trotzdem aus einer Liste mit einem Eintrag wählen. Ein vergessenes Objekt
// wurde beim Mieter später zur Aufgabe „Mieter ohne Objekt“. „Kein Objekt“ bleibt wählbar.
// Rein.

/** Gewünschtes Objekt aus der Adresse, sonst das einzige vorhandene, sonst leer. Nur eigene IDs. */
export function vorgewaehltesObjekt(properties: { id: string }[], gewuenscht?: string | null): string {
  if (gewuenscht && properties.some((p) => p.id === gewuenscht)) return gewuenscht;
  return properties.length === 1 ? properties[0].id : "";
}
