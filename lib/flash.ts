// Hängt eine Flash-Nachricht an eine Redirect-URL. Der FlashToast-Reader im
// Layout zeigt sie nach der Navigation als Toast und entfernt den Parameter.
/**
 * `typ` = Toast-Art. Ohne Angabe gruen (Erfolg). Fehlermeldungen ("es wurde
 * nichts angelegt") MUESSEN "error" mitgeben — bis 01.10.2026 zeigte der
 * Flash-Weg jeden Fehlschlag mit gruenem Haken.
 */
export function flashUrl(url: string, msg: string, typ: "success" | "error" | "info" = "success"): string {
  const sep = url.includes("?") ? "&" : "?";
  const t = typ === "success" ? "" : `&flashTyp=${typ}`;
  return `${url}${sep}flash=${encodeURIComponent(msg)}${t}`;
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
