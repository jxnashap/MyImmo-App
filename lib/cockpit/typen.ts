// Gemeinsame Typen des Betreiber-Cockpits.

/**
 * Ampel. Immer zusammen mit Text und Symbol anzeigen — nie Farbe allein.
 *
 * `offen` ist NEUTRAL (grau): „noch nicht dran“, nicht „falsch“. Rot ist in
 * diesem Design destruktiv/negativ reserviert — deshalb gibt es `kritisch`
 * getrennt, für einen roten Prüflauf oder ein gesprengtes Budget.
 */
export type Ampel = "ok" | "offen" | "warnung" | "kritisch" | "unbekannt";

export type PruefPunkt = {
  id: string;
  titel: string;
  ampel: Ampel;
  /** Ein Satz: was ist der Stand, und was fehlt. */
  detail: string;
  /** Wer kann es erledigen — danach wird gruppiert. */
  wer: "betreiber" | "code";
  /** Woher die Aussage kommt. „gemessen“ = aus Env/Code zur Laufzeit. */
  herkunft: "gemessen" | "doku";
  /** Nur bei `herkunft: "doku"`: Stand-Datum der Notiz (ISO). */
  stand?: string;
  /** Wo es nachzulesen ist. */
  quelle?: string;
};
