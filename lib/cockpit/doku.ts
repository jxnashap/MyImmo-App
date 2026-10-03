import type { PruefPunkt } from "./typen";

// Offene Betreiber-Punkte, die sich NICHT messen lassen — ein Anwaltsmandat,
// ein Blick in ein fremdes Dashboard, ein Durchklicken von Hand.
//
// **Warum von Hand und warum mit Stand-Datum:** Diese Punkte stehen in
// `CLAUDE.md` und `docs/START-CHECKLISTE.md`. Sie automatisch von dort zu
// lesen wäre eine Scheingenauigkeit — ein erledigter Punkt verschwindet aus
// der Notiz oft später als aus der Wirklichkeit. Deshalb trägt jeder Eintrag
// das Datum, an dem er zuletzt gegen die Doku geprüft wurde, und das Cockpit
// zeigt es an. Ein Eintrag, dessen Stand alt ist, ist ein Hinweis auf sich
// selbst.
//
// **Pflege:** Ist ein Punkt erledigt, hier LÖSCHEN (nicht auf „ok“ setzen) —
// die Liste zeigt nur Offenes. `tests/cockpit.test.ts` verlangt je Eintrag ein
// Stand-Datum und eine Quelle.

export const DOKU_STAND = "2026-10-03";

const eintrag = (
  id: string,
  titel: string,
  detail: string,
  quelle: string,
  ampel: PruefPunkt["ampel"] = "offen",
): PruefPunkt => ({
  id,
  titel,
  ampel,
  detail,
  wer: "betreiber",
  herkunft: "doku",
  stand: DOKU_STAND,
  quelle,
});

export const OFFENE_DOKU_PUNKTE: PruefPunkt[] = [
  eintrag(
    "anwalt-paket",
    "Anwaltsmandat (fünf Punkte in einem)",
    "AGB + Widerrufsbelehrung, Nutzer-AVV (Art. 28 DSGVO), § 34i GewO (Finanzierungs-Assistent), StBerG §§ 1–5 (Anlage V, § 82b, DATEV), Impressum/Datenschutz. Vier davon blockieren die Kassenöffnung. Ein Termin, eine Rechnung — vorher Festpreis-Angebote einholen.",
    "CLAUDE.md → AVV-Abschlussstand · docs/compliance/StBerG-ANFRAGE.md",
    "warnung",
  ),
  eintrag(
    "brevo-avv",
    "Brevo-AVV im Konto abschließen",
    "Drei Restpunkte im eingeloggten Brevo-Konto: neuere/signierbare Fassung als 15.05.2024? Firmendaten auf die Gewerbeanmeldung bringen (sonst lautet der Vertrag auf die falsche Partei). Empfängeradresse für Unterauftragsverarbeiter-Ankündigungen prüfen — die 10-Werktage-Frist verfällt ungelesen.",
    "docs/compliance/AVV-STATUS.md",
  ),
  eintrag(
    "text-xs",
    "11px → 12px durchklicken",
    "Das Token --text-xs steht seit 02.10.2026 auf 12px. Kein Test findet einen hässlichen Umbruch: Dashboard-Kacheln, Badges, Formular-Labels, Objektkarten, Termine, Briefvorschau und Befehlspalette ansehen. Rückweg ist eine Zeile in app/globals.css.",
    "CLAUDE.md → Betreiber-Punkt 9",
  ),
  eintrag(
    "paddle",
    "Paddle-Konto verifizieren",
    "Konto verifizieren, Preise anlegen, Webhook eintragen, einen Sandbox-Kauf durchspielen. Reihenfolge und Fallstricke stehen in der Checkliste; erst danach BILLING_ENFORCED=true.",
    "docs/BEZAHLSYSTEM.md",
  ),
];
