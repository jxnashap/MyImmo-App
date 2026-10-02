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
/** Kurzform für enge Kopfzeilen (761–1.319 px). Die lange Form ist fast doppelt
 *  so breit wie das frühere „Kostenlos starten" und überlagerte dort das
 *  mittige Logo (gemessen 30.09.2026: bis zu 215 px Überlappung). */
export const START_CTA_KURZ = REGISTRIERUNG_OFFEN ? "Kostenlos starten" : "Zugang anfragen";

/**
 * Jede Knopf-Beschriftung der oeffentlichen Strecke laeuft hier durch: Solange
 * ein Zugangscode noetig ist, heisst JEDER Start-Knopf wie `START_CTA` — egal
 * was die Seite sich gewuenscht hat. Bis 01.10.2026 trugen 20 Seiten weiter
 * „Kostenlos starten"/„Kostenlos ausprobieren" (Audit A5), obwohl der Weg am
 * Pflichtfeld „Zugangscode" endete.
 */
export function ctaBeschriftung(wunsch: string): string {
  return REGISTRIERUNG_OFFEN ? wunsch : START_CTA;
}

/** Die EINE Adresse fuer Early-Access-Anfragen und Hilfe vor dem Login. */
export const KONTAKT_EMAIL = "info@myimmoapp.de";
export const EARLY_ACCESS_MAILTO =
  `mailto:${KONTAKT_EMAIL}?subject=${encodeURIComponent("Early-Access-Zugang zu MyImmo")}` +
  `&body=${encodeURIComponent("Hallo,\n\nich vermiete … Wohnung(en)/Objekt(e) und möchte MyImmo im Early Access nutzen.\n\nViele Grüße")}`;
export const HILFE_MAILTO = `mailto:${KONTAKT_EMAIL}?subject=${encodeURIComponent("Hilfe beim Zugang zu MyImmo")}`;
/** Was der Besucher nach der Anfrage erwarten darf — eine Zusage, keine Floskel. */
export const EARLY_ACCESS_ZUSAGE = "Du bekommst den Zugangscode werktags innerhalb von 24 Stunden per E-Mail.";
