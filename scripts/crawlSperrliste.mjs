// Sperrliste für Crawler und Linkprüfer (Gesamtprüfung 07.10.2026, Paket P13).
//
// WARUM: Im Audit ist der Linkprüfer fünfmal `/api/demo` gefolgt (GET, „Demo ansehen“ auf der
// Startseite) — jeder Aufruf setzt den geteilten Demo-Bestand zurück und meldet an. Ein GET ist hier
// nicht automatisch harmlos: Manche Adressen lösen Links ein, protokollieren einen Abruf oder schreiben.
//
// REGEL: Ein Werkzeug, das Links selbstständig folgt (scripts/crawl.mjs, scripts/designscan/), ruft
// keine Adresse auf, für die `gesperrt()` wahr ist. Der Rauchtest ruft `/api/demo` bewusst und genau
// einmal je Rolle auf — er folgt keinen fremden Links.
//
// Eine NEUE GET-Route muss eingeordnet werden: hier (zustandsändernd/kostet) oder in der Liste
// „nur lesend“ in tests/paketP13.test.ts. Sonst wird der Test rot.

/** @type {{ muster: RegExp, grund: string }[]} */
export const SPERRLISTE = [
  { muster: /^\/api\/demo(?:[/?]|$)/, grund: "meldet am geteilten Demo-Konto an und setzt den Demo-Bestand zurück (Bremse 6 je 300 s)" },
  { muster: /^\/api\/cron\//, grund: "geplante Jobs: schreiben mit der Service-Role" },
  { muster: /^\/api\/encrypt-bankdaten(?:[/?]|$)/, grund: "verschlüsselt Bankdaten um (schreibt)" },
  { muster: /^\/api\/newsletter\//, grund: "Bestätigen und Abmelden ändern die Einwilligung" },
  { muster: /^\/api\/billing\//, grund: "Zahlungs-Webhook" },
  { muster: /^\/auth\//, grund: "löst Anmelde- und Reset-Links ein, setzt Cookies, meldet ab" },
  { muster: /^\/archiv\/[^/?#]+\/datei(?:[/?#]|$)/, grund: "Abruf durch den Mieter setzt „abgerufen“ (Zustellnachweis)" },
  { muster: /^\/(?:beleihung|makler-link)\/[^/?#]+\/datei\//, grund: "jeder Abruf landet im Abruf-Protokoll des Vermieters" },
  { muster: /^\/api\/(?:import|import-url|nk-ocr|kauf)(?:[/?]|$)/, grund: "KI und Import: kostet je Aufruf Geld" },
];

/** Pfad (mit oder ohne Suchteil, ohne Host) darf von keinem Crawler aufgerufen werden. */
export function gesperrt(pfad) {
  let p = pfad;
  try {
    if (/^https?:\/\//.test(p)) p = new URL(p).pathname + new URL(p).search;
  } catch {
    return true; // Unlesbare Adresse: lieber nicht aufrufen.
  }
  return SPERRLISTE.some((s) => s.muster.test(p));
}
