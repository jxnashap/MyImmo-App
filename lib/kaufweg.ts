// Der Weg zum Kauf (Umbau 06.10.2026, Vorgabe Jonas): BuyImmo führt einen kompletten Anfänger in
// FÜNF Schritten zum Objekt — „dass es so in der Reihenfolge links auch in den Reitern ist“.
//
//   1 Objekte vergleichen   → Kandidaten aus Anzeigen, Makler, Websuche eintragen, durchrechnen, vergleichen
//   2 Besichtigen & Sanieren → beim Termin den Sanierungs-Guide durchklicken, Summe zurück ans Objekt
//   3 Finanzierung          → Kassensturz, Selbstauskunft, Bank, Förderung
//   4 Angebot & Unterlagen  → als Käufer zeigen (Makler-Ordner), Kreditantrag und Objektunterlagen
//   5 Notar & Übergabe      → Beurkundung, Vollmacht, danach verwaltet MyImmo
//
// DIESE Liste ist die eine Quelle: Seitenleiste (lib/nav.ts), Schritt-Kopf auf jeder Seite
// (components/aufbau/WegKopf.tsx), Cockpit und Fahrplan. Die Stationen des Fahrplans
// (lib/fahrplan.ts) hängen über `stationen` an genau einem Schritt.
//
// Reihenfolge, bewusst so (Jonas): erst vergleichen, dann besichtigen, dann finanzieren. Das Risiko
// dabei steht im Schritt „Besichtigen“: Makler fragen oft schon vor dem Termin nach einer
// Finanzierungsbestätigung.
//
// GRENZE wie im Fahrplan: erklären, nicht raten — kein „du kannst“, kein „kauf jetzt“ (§ 34i GewO
// ist anwaltlich offen). `tests/kaufweg.test.ts` sucht solche Formulierungen. Reine Daten.

import type { Station, StationStatus } from "@/lib/fahrplan";

export type WegSchrittId = "vergleichen" | "besichtigen" | "finanzieren" | "unterlagen" | "abschluss";

export type WegSchritt = {
  id: WegSchrittId;
  nr: number;
  /** Kurz, für die Seitenleiste. */
  titel: string;
  href: string;
  /** Ein Satz: was in diesem Schritt passiert. */
  satz: string;
  /** „Worauf du achten musst“ — für Anfänger, ohne Rat. */
  achten: string[];
  /** Fahrplan-Stationen, die zu diesem Schritt gehören (lib/fahrplan.ts). */
  stationen: string[];
};

export const KAUFWEG: WegSchritt[] = [
  {
    id: "vergleichen",
    nr: 1,
    titel: "Objekte vergleichen",
    href: "/vergleich",
    satz: "Kandidaten aus Anzeigen, vom Makler oder aus der Websuche eintragen, durchrechnen und nebeneinanderlegen — bis eines übrig bleibt.",
    achten: [
      "Objekte findest du auf Immobilienportalen, bei Maklern in der Region, bei Zwangsversteigerungen des Amtsgerichts oder über Bekannte.",
      "Rechne drei bis fünf Kandidaten durch: Erst der Vergleich zeigt, was ein Preis wert ist.",
      "Zum Kaufpreis kommen Kaufnebenkosten (Grunderwerbsteuer, Notar, Grundbuch, Makler) — der Rechner zeigt sie je Bundesland.",
      "Kaufpreisfaktor = Kaufpreis ÷ Jahreskaltmiete: wie viele Jahresmieten das Objekt kostet.",
      "Wohnfläche, Miete und Hausgeld im Exposé sind Angaben des Verkäufers — später mit Unterlagen prüfen.",
    ],
    stationen: ["durchrechnen"],
  },
  {
    id: "besichtigen",
    nr: 2,
    titel: "Besichtigen & Sanieren",
    href: "/sanierung",
    satz: "Beim Termin den Sanierungs-Guide öffnen: eine Frage nach der anderen, bis die Summe steht — sie fließt zurück in den Vergleich.",
    achten: [
      "Makler fragen oft schon vor dem Termin nach einer Finanzierungsbestätigung. Wenn du ernsthaft kaufen willst, zieh Schritt 3 vor.",
      "Raumhöhe und Fenster mitmessen; Fotos von Fenstern, Heizung, Elektrik und Bad machen.",
      "Bei einer Eigentumswohnung: Protokolle der Eigentümerversammlungen und Rücklage ansehen — dort stehen geplante Arbeiten und Sonderumlagen.",
      "Förderung für Dämmung, Fenster und Heizung gibt es nur, wenn der Antrag vor dem Handwerkervertrag steht.",
    ],
    stationen: ["besichtigen"],
  },
  {
    id: "finanzieren",
    nr: 3,
    titel: "Finanzierung",
    href: "/kauf",
    satz: "Kassensturz, Selbstauskunft, Gespräch mit der Bank — für das Objekt, das übrig geblieben ist.",
    achten: [
      "Viele Banken erwarten, dass du mindestens die Kaufnebenkosten aus eigenem Geld zahlst — frag deine Bank.",
      "SCHUFA-Datenkopie anfordern: kostenlos nach Art. 15 DSGVO.",
      "Mehrere Banken anfragen und nach dem effektiven Jahreszins vergleichen, nicht nach dem Sollzins.",
      "Eine Finanzierungsbestätigung zeigt Maklern und Verkäufern, dass du kaufen kannst.",
    ],
    stationen: ["kassensturz", "selbstauskunft", "finanzierung"],
  },
  {
    id: "unterlagen",
    nr: 4,
    titel: "Angebot & Unterlagen",
    href: "/makler",
    satz: "Dem Makler zeigen, dass du ernsthaft kaufst, und der Bank die Unterlagen zum Objekt geben.",
    achten: [
      "Datensparsam: Gehalt und Kontoauszüge gehören zur Bank, nicht zum Makler.",
      "Für die Bank: Grundbuchauszug, Grundrisse, Energieausweis und Kaufvertragsentwurf.",
      "Links an Makler und Bank lassen sich widerrufen; du siehst, wann sie abgerufen wurden.",
    ],
    stationen: ["unterlagen", "beantragen"],
  },
  {
    id: "abschluss",
    nr: 5,
    titel: "Notar & Übergabe",
    href: "/abschluss",
    satz: "Der Notar beurkundet den Kaufvertrag; nach der Übergabe verwaltet MyImmo das Objekt.",
    achten: [
      "Den Kaufvertrag beurkundet ein Notar (§ 311b BGB) — den Entwurf vorher in Ruhe lesen.",
      "Kannst du nicht selbst hin, unterschreibt ein Vertreter; fürs Grundbuch muss die Vollmacht öffentlich beglaubigt sein (§ 29 GBO).",
      "Nach der Übergabe: Objekt in MyImmo anlegen, Kredit und Mieter eintragen.",
    ],
    stationen: ["notar", "uebergabe"],
  },
];

export const wegSchritt = (id: WegSchrittId): WegSchritt => KAUFWEG.find((s) => s.id === id)!;

export function naechsterSchritt(id: WegSchrittId): WegSchritt | null {
  const i = KAUFWEG.findIndex((s) => s.id === id);
  return KAUFWEG[i + 1] ?? null;
}

export function vorigerSchritt(id: WegSchrittId): WegSchritt | null {
  const i = KAUFWEG.findIndex((s) => s.id === id);
  return i > 0 ? KAUFWEG[i - 1] : null;
}

/**
 * Stand eines Schritts aus seinen Fahrplan-Stationen: erledigt nur, wenn ALLE prüfbaren erledigt
 * sind; teilweise, wenn eine erledigt oder teilweise ist; offen sonst. Kann BuyImmo nichts prüfen
 * (nur `info` oder kein Status), gibt es keinen Stand — kein erfundener Haken.
 */
export function schrittStand(schritt: WegSchritt, stationen: Station[]): StationStatus["art"] | null {
  const eigene = stationen.filter((s) => schritt.stationen.includes(s.id) && s.status && s.status.art !== "info");
  if (eigene.length === 0) return null;
  if (eigene.every((s) => s.status!.art === "erledigt")) return "erledigt";
  if (eigene.some((s) => s.status!.art === "erledigt" || s.status!.art === "teilweise")) return "teilweise";
  return "offen";
}
