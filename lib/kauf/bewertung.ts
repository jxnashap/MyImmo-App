// Handoff des im Marktwert-Schätzer (Schritt 1) errechneten Werts in den
// Kauf-Flow: bleibt gespeichert (localStorage), wird bei Punkt 1 angezeigt und
// in den Objekt-Rechner (Kaufpreis/Fläche/Miete) übernommen.

export const KAUF_BEWERTUNG_KEY = "myimmo_kauf_bewertung";

export type KaufBewertung = {
  marktwert: number;
  min: number;
  max: number;
  kaufpreis: number;     // angesetzter Kaufpreis (für den Rechner)
  flaeche: number;       // Wohnfläche m²
  jahresmiete: number;   // Jahresnettokaltmiete (0 bei Eigennutzung)
  gespeichertAm: string; // ISO-Datum
};
