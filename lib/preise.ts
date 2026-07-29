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
