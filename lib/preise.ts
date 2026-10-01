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
//   false → JEDER Start-Knopf ist eine nicht klickbare Fläche „Coming soon“
//           (`components/StartCta.tsx`). Seit 01.10.2026 (Vorgabe des
//           Betreibers) gibt es KEINEN Anfrageweg mehr — kein mailto, keine
//           24-h-Zusage. Wer einen Beta-Code hat, kommt über „Anmelden“ hinein.
//   true  → „Kostenlos starten“ als Link (dann bitte auch BETA_CODE entfernen).
//
// Bewusst eine Konstante und keine Env-Abfrage: Die Landing wird zur Bauzeit
// vorgerendert; ein serverseitiges `process.env` wäre dort ein stiller Default.
export const REGISTRIERUNG_OFFEN = false;

/** Beschriftung des Haupt-Knopfes auf der öffentlichen Strecke. */
export const START_CTA = REGISTRIERUNG_OFFEN ? "Kostenlos starten" : "Coming soon";
/** Kurzform für enge Kopfzeilen (761–1.319 px). Die lange Form ist fast doppelt
 *  so breit wie das frühere „Kostenlos starten" und überlagerte dort das
 *  mittige Logo (gemessen 30.09.2026: bis zu 215 px Überlappung). */
export const START_CTA_KURZ = REGISTRIERUNG_OFFEN ? "Kostenlos starten" : "Coming soon";

// Die Beschriftung rendert `components/StartCta.tsx` — dort, und nur dort, entscheidet
// sich, ob der Start-Knopf ein Link ist oder „Coming soon“.

/** Die EINE Kontaktadresse vor dem Login (Hilfe & Kontakt). Einen Anfrageweg
 *  für Zugangscodes gibt es seit 01.10.2026 nicht mehr (Vorgabe des Betreibers). */
export const KONTAKT_EMAIL = "info@myimmoapp.de";
export const HILFE_MAILTO = `mailto:${KONTAKT_EMAIL}?subject=${encodeURIComponent("Hilfe beim Zugang zu MyImmo")}`;
