// Hängt eine Flash-Nachricht an eine Redirect-URL. Der FlashToast-Reader im
// Layout zeigt sie nach der Navigation als Toast und entfernt den Parameter.
export function flashUrl(url: string, msg: string): string {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}flash=${encodeURIComponent(msg)}`;
}

/**
 * Ziel fuer einen Redirect nach dem Speichern („?back="/Hidden-Feld).
 *
 * Nur repo-INTERNE Pfade sind erlaubt. "//example.com" und "/\\example.com"
 * beginnen zwar mit "/", sind fuer den Browser aber protokoll-relative
 * ABSOLUTE URLs — ueber einen praeparierten Link liesse sich damit nach dem
 * Speichern eine fremde Seite ansteuern (Open Redirect, z. B. fuer eine
 * nachgebaute Login-Maske).
 */
export function sicheresZiel(roh: unknown, fallback: string): string {
  const wert = String(roh ?? "").trim();
  const intern = wert.startsWith("/") && !wert.startsWith("//") && !wert.startsWith("/\\");
  return intern ? wert : fallback;
}
