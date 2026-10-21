// Mieterportal-Listen (03.10.2026): EINE Zeile je Anliegen, ein Klick öffnet die Detailansicht.
// Hier nur, was jede Zeile als Merkmal trägt und wohin sie führt — reine Funktionen, damit sie
// prüfbar sind (tests/anliegenListe.test.ts). Benutzt von components/AnliegenManager.tsx
// (Vermieter) und components/AnliegenPortal.tsx (Mieter).
import { vorgangStand, type Ereignis } from "@/lib/vorgang";

export type Merkmal = { text: string; cls: string };

/** Detailansicht beim Vermieter — die EINE Stelle (Liste, Dashboard-Neuigkeiten). */
export const vorgangUrl = (id: string) => `/anliegen?vorgang=${encodeURIComponent(id)}`;

/** Detailansicht an eine Listen-Adresse hängen (`/portal?tab=anliegen` oder die Vorschau-URL). */
export const mitVorgang = (listeHref: string, id: string) =>
  `${listeHref}${listeHref.includes("?") ? "&" : "?"}vorgang=${encodeURIComponent(id)}`;

/** Was der Mieter-Reiter „Anliegen“ beim Öffnen gleich aufklappt (21.10.2026, Startseite). */
export type NeuesAnliegen = "schaden" | "frage";
export const neuesAnliegen = (wert: string | undefined | null): NeuesAnliegen | null =>
  wert === "schaden" || wert === "frage" ? wert : null;
export const mitNeu = (listeHref: string, art: NeuesAnliegen) =>
  `${listeHref}${listeHref.includes("?") ? "&" : "?"}neu=${art}`;

/**
 * Was der Mieter nach dem Absenden liest (21.10.2026) — EIN Satz für Schaden, Frage und
 * Dokument-Wunsch. Vorher schloss sich das Frage-Formular wortlos, und niemand sagte, dass
 * eine Antwort angekündigt wird. Der Mail-Halbsatz steht nur da, wenn der Versand an ist
 * und der Mieter die Hinweise nicht abgeschaltet hat — eine Werbe- oder Rechtsaussage
 * verspricht nur, was der Code tut.
 */
export function gesendetText(mailHinweis: boolean): string {
  return mailHinweis
    ? "Gesendet — dein Vermieter bekommt Bescheid. Antwortet er, bekommst du eine E-Mail; die Antwort steht dann hier im Anliegen."
    : "Gesendet — dein Vermieter bekommt Bescheid. Seine Antwort steht dann hier im Anliegen.";
}

const letzteNachricht = (verlauf: Ereignis[], von: "mieter" | "vermieter") => {
  const letzte = verlauf[verlauf.length - 1];
  return !!letzte && letzte.art === "nachricht" && letzte.autor_rolle === von;
};

/** Was beim VERMIETER ansteht: unbeantwortete Nachricht vor Terminstand. */
export function vorgangMerkmal(
  a: { status: string; verlauf: Ereignis[]; terminBestaetigt: string | null; terminVorschlaege: string[] },
  slotKurz: (s: string) => string,
): Merkmal | null {
  if (a.status !== "erledigt" && letzteNachricht(a.verlauf, "mieter")) return { text: "Neue Nachricht", cls: "badge-amber" };
  // Ablauf C: Der Auftrag ist erledigt, das Anliegen steht noch offen — abschließen oder nachfragen.
  if (vorgangStand(a.verlauf, a.status).auftragErledigtAnliegenOffen) return { text: "Auftrag erledigt", cls: "badge-green" };
  if (a.terminBestaetigt) return { text: `Termin ${slotKurz(a.terminBestaetigt)}`, cls: "badge-green" };
  if (a.terminVorschlaege.length > 0) return { text: "Terminwahl beim Mieter", cls: "badge-neutral" };
  return null;
}

/** Was beim MIETER ansteht: Terminwahl vor Antwort des Vermieters. */
export function mieterMerkmal(
  a: { status: string; termin_vorschlaege: string[] | null; termin_bestaetigt: string | null },
  verlauf: Ereignis[],
): Merkmal | null {
  if (a.status !== "erledigt" && (a.termin_vorschlaege ?? []).length > 0 && !a.termin_bestaetigt) return { text: "Termin wählen", cls: "badge-amber" };
  if (letzteNachricht(verlauf, "vermieter")) return { text: "Antwort", cls: "badge-gold" };
  return null;
}

/**
 * Status, den das Formular vorschlägt, sobald der Vermieter eine Antwort tippt (21.10.2026): aus
 * „offen“ wird „in Arbeit“ — ein beantwortetes Anliegen zählte sonst weiter als neu und wurde auf
 * dem Dashboard nach sieben Tagen rot. Andere Stände bleiben, wie sie sind. Rein.
 */
export function statusBeimAntworten(aktuell: string, text: string): string {
  return aktuell === "offen" && text.trim() ? "in_arbeit" : aktuell;
}

/**
 * „An Hausmeister/Service weiterleiten“ MIT Bezug (21.10.2026): Anliegen und Objekt gehen mit,
 * der Auftrag hängt danach am Anliegen (Verlauf, Stand für den Mieter). Die IDs sind nur
 * Vorbelegung — die Action und der Trigger `auftraege_bezug_pruefen` prüfen, dass beides dem
 * Vermieter gehört. Der Mieter-Kontakt wird bewusst NICHT vorgewählt (nur mit Haken).
 */
export function weiterleitenHref(a: { id: string; titel: string; text: string; propId: string | null }): string {
  const p = new URLSearchParams({ tab: "service", anliegen: a.id, titel: a.titel, text: a.text.slice(0, 1500) });
  if (a.propId) p.set("prop", a.propId);
  return `/anliegen?${p.toString()}#auftrag-vergeben`;
}
