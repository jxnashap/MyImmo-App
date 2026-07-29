// Zaehl-Regeln fuer die Navigations-Abzeichen — bewusst ohne Server-Abhaengigkeit,
// damit Seitenleiste (server) und Reiter (server-komponente) DIESELBE Definition
// verwenden und sie testbar bleibt.

/**
 * Auftraege, die auf den VERMIETER warten.
 *
 * Bewusst nur `freigabe`: Ein Auftrag im Status `offen` liegt beim
 * Service-Partner, nicht beim Vermieter — er gehoert damit nicht in einen
 * Zaehler, der "hier musst du etwas tun" bedeutet.
 *
 * Vorher zaehlte die Seitenleiste nur `freigabe`, der Service-Reiter
 * zusaetzlich alle `offen` — der Nutzer klickte auf eine "3" und sah dahinter
 * eine andere Zahl, ohne zu wissen, welche stimmt.
 */
export function wartetAufVermieter(auftraege: { status: string | null }[]): number {
  return auftraege.filter((a) => a.status === "freigabe").length;
}
