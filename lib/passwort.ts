// Eine Regel fuer Passwoerter — und nur eine.
//
// Vorher galten zwei verschiedene: Die Registrierung liess Supabase entscheiden
// (Standard 6 Zeichen, die Fehlermeldung nannte auch 6), die Passwort-Aenderung
// in den Einstellungen verlangte 8. Wer sich mit 7 Zeichen registriert hatte,
// konnte sein Passwort spaeter nicht auf denselben Wert setzen und bekam eine
// Fehlermeldung, die zu nichts passte, was ihm je gesagt worden war.

export const PASSWORT_MIN = 8;

export const PASSWORT_REGEL = `mindestens ${PASSWORT_MIN} Zeichen`;

/**
 * Die zweite Regel, die NICHT in der App steht, sondern bei Supabase: der
 * Leak-Schutz (Abgleich mit „Have I Been Pwned", eingeschaltet 09.09.2026).
 * Beim ersten echten Durchlauf scheiterte „12345678" daran — und niemand hatte
 * es vorher gesagt. Deshalb steht sie jetzt VOR der Eingabe da.
 */
export const PASSWORT_LECK_HINWEIS =
  "Passwörter, die schon einmal in einem Datenleck aufgetaucht sind (z. B. „12345678“ oder „passwort1“), lehnt das System ab";

/** null = in Ordnung, sonst der anzuzeigende Fehlertext. */
export function pruefePasswort(pw: string): string | null {
  if (pw.length < PASSWORT_MIN) {
    return `Das Passwort muss ${PASSWORT_REGEL} haben.`;
  }
  return null;
}

/**
 * Deutscher Text für eine Ablehnung des NEUEN Passworts durch Supabase —
 * oder null, wenn der Fehler kein Passwort-Fehler ist (dann entscheidet der
 * Aufrufer, was zu sagen ist).
 *
 * WARUM (30.09.2026, erster echter Durchlauf von „Passwort vergessen"):
 * Die Seite suchte im englischen Text nach „pwned|leaked|compromis". Supabase
 * schreibt aber „Password is known to be weak and easy to guess" — der Test
 * griff nicht, die Seite riet „Bitte fordere einen neuen Link an", und der
 * Tester tat genau das, 16 Sekunden später. Deshalb zuerst der FEHLERCODE
 * (`weak_password` mit `reasons`, `same_password`), der Text nur als Rückfall.
 */
export function passwortAblehnung(error: { code?: string; message?: string; reasons?: unknown } | null | undefined): string | null {
  if (!error) return null;
  const text = (error.message ?? "").toLowerCase();
  const gruende = Array.isArray(error.reasons) ? error.reasons.map(String) : [];

  if (error.code === "same_password" || text.includes("different from the old")) {
    return "Das neue Passwort muss sich vom bisherigen unterscheiden.";
  }
  const leck =
    gruende.includes("pwned") || /known to be weak|pwned|leaked|compromis/.test(text);
  if (leck) {
    return "Dieses Passwort taucht in bekannten Datenlecks auf und ist deshalb gesperrt. Bitte wähle ein anderes — am besten eines, das du nirgends sonst benutzt.";
  }
  if (gruende.includes("characters") || text.includes("should contain")) {
    return "Das Passwort braucht mehr unterschiedliche Zeichenarten (z. B. Buchstaben und Ziffern). Bitte wähle ein anderes.";
  }
  if (error.code === "weak_password" || (text.includes("password") && (text.includes("weak") || text.includes("at least")))) {
    return `Das Passwort ist zu schwach (${PASSWORT_REGEL}). Bitte wähle ein anderes.`;
  }
  return null;
}

/**
 * Hat das Konto KEIN Passwort? Entscheidet, ob die Einstellungen „altes
 * Passwort bestätigen" zeigen oder den Weg per E-Mail-Link.
 *
 * WARUM (30.09.2026): Vorher galt `app_metadata.provider !== "email"`. Der
 * Wert ist der Anmeldeweg bei der ANLAGE und ändert sich nie — ein
 * Google-Konto, das später per „Passwort vergessen" ein Passwort bekam,
 * konnte es danach nicht mehr ändern („du meldest dich mit Google an").
 * Jetzt fragt die Seite die Datenbank (`konto_hat_passwort()`); nur wenn die
 * Antwort fehlt, gilt der alte Schluss als Rückfall.
 */
export function ohnePasswort(
  antwort: { data: unknown; error: unknown },
  provider?: string | null,
): boolean {
  if (!antwort.error && typeof antwort.data === "boolean") return !antwort.data;
  return !!provider && provider !== "email";
}
