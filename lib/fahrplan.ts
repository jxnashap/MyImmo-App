// BuyImmo-Fahrplan (05.10.2026, Vorgabe des Betreibers): BuyImmo soll junge Käufer LEITEN — was
// brauche ich, welche Voraussetzungen, was muss ich beachten — Schritt für Schritt bis zum Objekt,
// das danach MyImmo verwaltet. Seit dem Umbau (06.10.2026) stehen die Stationen in der Reihenfolge
// des Kaufwegs (lib/kaufweg.ts: vergleichen → besichtigen → finanzieren → Unterlagen → Notar); jede
// Station gehört dort zu genau einem Schritt.
//
// GRENZE (docs/zukunft/BUYIMMO.md): Der Fahrplan erklärt und zeigt Fortschritt. Er urteilt nicht
// über die Person („du kannst dir X leisten“, „kauf jetzt“) — das wäre Darlehensberatung
// (§ 34i GewO), und die bleibt draußen, bis der Anwalt sie geklärt hat. `tests/fahrplan.test.ts`
// sucht nach solchen Formulierungen.
//
// STATUS NUR, WO DIE APP ES WEISS: Selbstauskunft, Makler-Ordner, gespeicherte Kaufprüfungen und
// Vertreter liegen in der Datenbank. Ob jemand schon besichtigt oder beim Notar war, weiß BuyImmo
// nicht — dort steht kein Haken, statt eines erfundenen. Reine Funktion.

import { MAKLER_CHECKLISTE, maklerErledigt } from "@/lib/makler";

export type FahrplanDaten = {
  hatSelbstauskunft: boolean;
  makler: { item_key: string; status: string | null }[];
  kaufpruefungen: number;
  /** Mindestens ein Vertreter mit gültiger (oder bald ablaufender) Vollmacht. */
  vertreterGueltig: boolean;
  /** Gültige General- oder Grundbuchvollmacht, öffentlich beglaubigt oder beurkundet (§ 29 GBO). */
  vertreterGrundbuch?: boolean;
  objekte: number;
};

export type StationStatus = { art: "erledigt" | "teilweise" | "offen" | "info"; text: string };

export type Station = {
  id: string;
  titel: string;
  satz: string;
  punkte: string[];
  ziel: { href: string; label: string } | null;
  status: StationStatus | null;
};

const FINANZIERUNGSBESTAETIGUNG = "finanzierungsbestaetigung";

export function fahrplan(d: FahrplanDaten): Station[] {
  const maklerFertig = maklerErledigt(d.makler);
  const maklerGesamt = MAKLER_CHECKLISTE.length;
  const bestaetigt = d.makler.some((m) => m.item_key === FINANZIERUNGSBESTAETIGUNG && m.status === "erledigt");

  return [
    {
      id: "durchrechnen",
      titel: "Durchrechnen und vergleichen",
      satz: "Kaufpreis, Nebenkosten, Miete: Was bringt jeder Kandidat? Gespeicherte Objekte stehen nebeneinander, bis eines übrig bleibt.",
      // Seit 05.10.2026 übergibt der Sanierungs-Guide seinen Betrag per Knopf (lib/sanierung/uebergabe.ts),
      // seit 06.10.2026 an das Objekt, für das die Besichtigung lief.
      punkte: ["Sanierungskosten: im Sanierungs-Guide auf „in den Vergleich“ tippen — sie zählen dann zur Gesamtinvestition des Objekts"],
      ziel: { href: "/vergleich", label: "Objekte vergleichen" },
      status:
        d.kaufpruefungen > 0
          ? { art: "erledigt", text: `${d.kaufpruefungen} Objekt${d.kaufpruefungen === 1 ? "" : "e"} gespeichert` }
          : { art: "offen", text: "noch keins gespeichert" },
    },
    {
      id: "besichtigen",
      titel: "Besichtigen und ausmessen",
      satz: "Räume ausmessen und anhaken, was gemacht werden muss — so weißt du vor dem Angebot, was die Renovierung kostet.",
      punkte: [
        "Raumhöhe und Fenster mitmessen",
        "Fotos von Fenstern, Heizung, Elektrik und Bad",
        // Seit 05.10.2026 schätzt der Sanierungsrechner den Zuschuss (lib/sanierung/foerderung.ts).
        "Dämmung, Fenster und Heizung können gefördert werden — aber nur, wenn der Antrag vor dem Handwerkervertrag steht (Sanierungsrechner → Förderung)",
      ],
      ziel: { href: "/sanierung", label: "Sanierungs-Guide" },
      status: null,
    },
    {
      id: "kassensturz",
      titel: "Kassensturz",
      satz: "Wie viel Eigenkapital hast du, was bleibt im Monat übrig, was steht bei der SCHUFA über dich?",
      punkte: [
        "Eigenkapital für die Kaufnebenkosten — der Rechner oben zeigt, wie viel das ist",
        "SCHUFA-Datenkopie: kostenlos nach Art. 15 DSGVO",
        "Gehaltsabrechnungen der letzten drei Monate",
      ],
      ziel: null,
      status: null,
    },
    {
      id: "selbstauskunft",
      titel: "Selbstauskunft",
      satz: "Deine Finanzen auf einer Seite — dieselbe für jede Bank.",
      punkte: ["Einkommen, Ausgaben, Vermögen, Kredite", "Daraus erzeugt BuyImmo die Käufer-Selbstauskunft für Makler"],
      ziel: { href: "/kauf", label: "Selbstauskunft ausfüllen" },
      status: d.hatSelbstauskunft ? { art: "erledigt", text: "ausgefüllt" } : { art: "offen", text: "fehlt noch" },
    },
    {
      id: "finanzierung",
      titel: "Finanzierung vorab klären",
      satz: "Mit der Selbstauskunft zur Bank: Eine Finanzierungsbestätigung zeigt Maklern und Verkäufern, dass du kaufen kannst.",
      punkte: ["Angebote mehrerer Banken lassen sich vergleichen", "Die Bestätigung kommt in den Makler-Ordner"],
      ziel: { href: "/makler", label: "Makler-Ordner" },
      status: bestaetigt ? { art: "erledigt", text: "Bestätigung liegt vor" } : { art: "offen", text: "noch nicht abgelegt" },
    },
    {
      id: "unterlagen",
      titel: "Unterlagen für Makler",
      satz: "Die Nachweise, mit denen du dich bei Maklern als ernsthafter Käufer zeigst — als Datei oder als Link.",
      punkte: [
        "Datensparsam: Gehalt und Kontoauszüge gehören zur Bank, nicht zum Makler",
        "Link erstellen, widerrufen und sehen, wann er abgerufen wurde",
      ],
      ziel: { href: "/makler", label: "Makler-Ordner öffnen" },
      status:
        maklerFertig === maklerGesamt
          ? { art: "erledigt", text: `${maklerFertig} von ${maklerGesamt}` }
          : { art: maklerFertig > 0 ? "teilweise" : "offen", text: `${maklerFertig} von ${maklerGesamt}` },
    },
    {
      id: "beantragen",
      titel: "Finanzierung beantragen",
      satz: "Steht die Entscheidung, gehen Kreditantrag und Objektunterlagen an die Bank.",
      punkte: [
        "Kreditantrag als PDF aus Schritt 3 (Finanzierung)",
        "Grundbuchauszug, Grundrisse, Energieausweis, Kaufvertragsentwurf im Beleihungsordner des Objekts sammeln und der Bank als Link schicken",
      ],
      ziel: { href: "/kauf", label: "Kreditantrag" },
      status: null,
    },
    {
      id: "notar",
      titel: "Notartermin",
      satz: "Den Kaufvertrag beurkundet ein Notar (§ 311b BGB). Kannst du nicht selbst hin, unterschreibt ein Vertreter mit Vollmacht.",
      punkte: ["Fürs Grundbuch muss die Vollmacht öffentlich beglaubigt sein (§ 29 GBO)", "Vertreter und Vollmacht in den Einstellungen hinterlegen"],
      ziel: { href: "/einstellungen?tab=vertreter", label: "Vertreter" },
      // Review 05.10.2026: „gültig“ allein reicht fürs Grundbuch nicht — Art und Form zählen.
      status: d.vertreterGrundbuch
        ? { art: "info", text: "Vertreter mit beglaubigter Grundbuch- bzw. Generalvollmacht hinterlegt" }
        : d.vertreterGueltig
          ? { art: "info", text: "Vertreter hinterlegt — fürs Grundbuch muss die Vollmacht öffentlich beglaubigt sein" }
          : null,
    },
    {
      id: "uebergabe",
      titel: "Übergabe — ab hier verwaltet MyImmo",
      satz: "Objekt anlegen, Kredit und Mieter eintragen — Miete, Nebenkosten und Steuer laufen dann in MyImmo.",
      punkte: [],
      ziel: { href: "/properties/new", label: "Objekt anlegen" },
      status: d.objekte > 0 ? { art: "info", text: `${d.objekte} Objekt${d.objekte === 1 ? "" : "e"} im Bestand` } : null,
    },
  ];
}

/** Wie viele der Schritte, die BuyImmo prüfen kann, erledigt sind. `info` zählt nicht mit. */
export function fortschritt(stationen: Station[]): { erledigt: number; pruefbar: number } {
  const pruefbar = stationen.filter((s) => s.status && s.status.art !== "info");
  return { erledigt: pruefbar.filter((s) => s.status!.art === "erledigt").length, pruefbar: pruefbar.length };
}
