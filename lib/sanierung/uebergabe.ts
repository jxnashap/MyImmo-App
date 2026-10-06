// Sanierungsrechner → Kaufprüfung (05.10.2026; seit dem Umbau 06.10.2026 nach /vergleich): Die
// geschätzten Sanierungskosten wandern als Zahl in der Adresse (`/vergleich?sanierung=12345`) in die
// Kaufprüfung und dort in die Gesamtinvestition. Kein Speichern, keine Datenbank — der Kauf-Assistent speichert das Feld mit
// der Kaufprüfung, wenn der Nutzer sie speichert.
//
// Die Adresse ist eine Nutzereingabe: Nur ganze, positive Euro bis zu einer Obergrenze werden
// angenommen, alles andere ignoriert (kein Fehler, das Feld bleibt einfach leer).
//
// Und andersherum (Umbau 06.10.2026): Aus dem Vergleich führt „Besichtigen“ mit `/sanierung?objekt=<id>`
// in den Guide — der Entwurf startet mit Name, Adresse, Wohnfläche, Baujahr und Ziel des Kandidaten.

import { leererEntwurf, type Entwurf } from "@/lib/sanierung/eingabe";

export const SANIERUNG_PARAM = "sanierung";
/** Obergrenze gegen Unsinn in der Adresse — eine Sanierung über 10 Mio. € rechnet hier niemand. */
export const SANIERUNG_MAX = 10_000_000;

/** Ziel seit dem Umbau (06.10.2026): Kaufweg Schritt 1, der Objekt-Rechner mit Vergleich. */
export const VERGLEICH_PFAD = "/vergleich";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Link in den Vergleich mit dem Betrag (ganze Euro, aufgerundet) — und, wenn die Besichtigung für
 * eine Kaufprüfung lief, deren Kennung: Der Rechner öffnet dann genau dieses Objekt.
 */
export function kaufLinkMitSanierung(betrag: number, objektId?: string | null): string {
  const euro = Number.isFinite(betrag) && betrag > 0 ? Math.min(Math.ceil(betrag), SANIERUNG_MAX) : 0;
  const teile: string[] = [];
  if (euro > 0) teile.push(`${SANIERUNG_PARAM}=${euro}`);
  if (objektId && UUID.test(objektId)) teile.push(`objekt=${objektId}`);
  return teile.length ? `${VERGLEICH_PFAD}?${teile.join("&")}` : VERGLEICH_PFAD;
}

/**
 * Gespeicherte Kaufprüfung laden, während noch ein Betrag aus dem Sanierungsrechner offen ist: Der
 * übergebene Betrag gewinnt (der Nutzer kam gerade mit ihm), danach ist er verbraucht. Ohne offenen
 * Betrag bleibt der gespeicherte Wert. Review 05.10.2026: vorher überschrieb „Bearbeiten“ ihn still.
 */
export function sanierungBeimLaden(gespeichert: string, offeneUebergabe: number | null): { wert: string; verbraucht: boolean } {
  if (offeneUebergabe != null && Number.isFinite(offeneUebergabe) && offeneUebergabe > 0) {
    return { wert: String(offeneUebergabe), verbraucht: true };
  }
  return { wert: gespeichert, verbraucht: false };
}

/** Betrag aus der Adresse lesen — nur Ziffern, 1 bis SANIERUNG_MAX; sonst null. */
export function sanierungAusParam(wert: string | string[] | undefined): number | null {
  const roh = Array.isArray(wert) ? wert[0] : wert;
  if (typeof roh !== "string" || !/^\d{1,9}$/.test(roh)) return null;
  const n = Number(roh);
  return n >= 1 && n <= SANIERUNG_MAX ? n : null;
}

/** Was der Sanierungs-Guide von einer Kaufprüfung übernimmt (alles Text, wie im Rechner getippt). */
export type KaufpruefungStart = { id: string; name: string; adresse: string; wohnflaeche: string; baujahr: string; nutzung: "" | "vermieten" | "eigennutzen" };

/** Kaufprüfung (`kalkulationen`-Zeile) → Startwerte für den Guide. Unbekanntes bleibt leer. */
export function kaufpruefungStart(k: { id: string; name: string; data?: Record<string, string> | null }): KaufpruefungStart {
  const d = k.data ?? {};
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const baujahr = text(d.baujahr, 4);
  return {
    id: k.id,
    name: text(k.name, 80),
    adresse: text(d.adresse, 160),
    wohnflaeche: text(d.flaeche, 10),
    baujahr: /^\d{4}$/.test(baujahr) ? baujahr : "",
    nutzung: d.nutzung === "vermietung" ? "vermieten" : d.nutzung === "eigennutzung" ? "eigennutzen" : "",
  };
}

/** Neuer Guide-Entwurf für eine Besichtigung dieses Kandidaten. */
export function entwurfFuerKaufpruefung(k: KaufpruefungStart, id: string): Entwurf {
  const e = leererEntwurf(id);
  return {
    ...e,
    kaufObjekt: k.id,
    projekt: { ...e.projekt, name: k.name, adresse: k.adresse, wohnflaeche: k.wohnflaeche, baujahr: k.baujahr, nutzung: k.nutzung },
  };
}
