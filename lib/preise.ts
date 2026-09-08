// Sichtbarkeit der Tarif-/Preisangaben auf der oeffentlichen Website.
//
// Solange das Bezahlsystem inaktiv ist (BILLING_ENFORCED nicht gesetzt, siehe
// docs/BEZAHLSYSTEM.md), sind die Preise reine Absichtserklaerung: Betraege,
// Einheiten-Grenzen und Leistungsumfang koennen sich bis zum Start noch
// aendern. Oeffentlich genannte Preise erzeugen aber eine Erwartung — und wer
// sich in der Early-Access-Phase anmeldet, tut das dann auf Basis von Zahlen,
// die spaeter vielleicht nicht gelten.
//
// Deshalb EIN Schalter statt verstreuter Auskommentierungen:
//
//   false → Website zeigt „Early Access, alles kostenlos" ohne jede Zahl.
//           /preise bleibt als Route erreichbar (alte Links, Suchmaschinen),
//           traegt aber `noindex` und nennt keine Betraege.
//   true  → Tarifuebersicht, Preis-Teaser auf der Startseite, Menuepunkt
//           „Preise" und der Sitemap-Eintrag sind wieder da.
//
// Beim Aktivieren des Bezahlsystems hier auf `true` stellen (Schritt in der
// Aktivierungs-Checkliste in docs/BEZAHLSYSTEM.md).
export const PREISE_SICHTBAR = false;

// ---------------------------------------------------------------------------
// Ist die Registrierung offen? (08.09.2026, Feedback Phase 4)
// ---------------------------------------------------------------------------
// Für Vermieter verlangt die Registrierung einen Zugangscode
// (`bereiteRegistrierungVor`, Env BETA_CODE). Solange das so ist, ist
// „Kostenlos starten" eine Einladung, die an einer Tür endet: Wer klickt,
// steht vor einem Feld, das er nicht ausfüllen kann.
//
//   false → CTA heißt „Early-Access-Zugang anfragen" und führt zu /anmelden.
//   true  → „Kostenlos starten" (dann bitte auch BETA_CODE entfernen).
//
// Bewusst eine Konstante und keine Env-Abfrage: Die Landing wird zur Bauzeit
// vorgerendert; ein serverseitiges `process.env` wäre dort ein stiller Default.
export const REGISTRIERUNG_OFFEN = false;

/** Beschriftung des Haupt-Knopfes auf der öffentlichen Strecke. */
export const START_CTA = REGISTRIERUNG_OFFEN ? "Kostenlos starten" : "Early-Access-Zugang anfragen";
