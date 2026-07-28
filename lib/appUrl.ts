// Basis-Adresse für Links, die MyImmo NACH AUSSEN gibt (Bewerbungs-Link,
// Bank-Freigabe, Service-Auftrag). Bewusst NICHT window.location.origin:
// Wird ein Link auf einer Vorschau-/Fallback-Domain erzeugt, bekäme der
// Empfänger genau diese Adresse — der Link zeigt dann nicht auf die
// öffentliche Seite, sondern auf eine Umgebung, die es später evtl. nicht
// mehr gibt.

/** Produktions-Adresse (siehe metadataBase in app/layout.tsx). */
export const APP_BASIS_URL = "https://www.myimmoapp.de";

/**
 * Liefert die Basis für geteilte Links.
 * Lokale Entwicklung (localhost) behält den eigenen Ursprung, damit Links
 * beim Testen funktionieren; überall sonst gilt die Produktions-Adresse.
 */
export function teilbareBasisUrl(): string {
  if (typeof window === "undefined") return APP_BASIS_URL;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) return window.location.origin;
  return APP_BASIS_URL;
}

/** Baut einen teilbaren Link aus einem Pfad ("/bewerben/<token>"). */
export function teilbarerLink(pfad: string): string {
  return `${teilbareBasisUrl()}${pfad.startsWith("/") ? pfad : `/${pfad}`}`;
}
