// Eine Regel fuer Passwoerter — und nur eine.
//
// Vorher galten zwei verschiedene: Die Registrierung liess Supabase entscheiden
// (Standard 6 Zeichen, die Fehlermeldung nannte auch 6), die Passwort-Aenderung
// in den Einstellungen verlangte 8. Wer sich mit 7 Zeichen registriert hatte,
// konnte sein Passwort spaeter nicht auf denselben Wert setzen und bekam eine
// Fehlermeldung, die zu nichts passte, was ihm je gesagt worden war.

export const PASSWORT_MIN = 8;

export const PASSWORT_REGEL = `mindestens ${PASSWORT_MIN} Zeichen`;

/** null = in Ordnung, sonst der anzuzeigende Fehlertext. */
export function pruefePasswort(pw: string): string | null {
  if (pw.length < PASSWORT_MIN) {
    return `Das Passwort muss ${PASSWORT_REGEL} haben.`;
  }
  return null;
}
