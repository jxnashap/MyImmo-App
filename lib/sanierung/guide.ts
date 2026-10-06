// Seiten des Sanierungs-Guides und die EINE Lückenfunktion (Abschnitt 6 im Plan,
// docs/zukunft/SANIERUNGS-GUIDE.md): Guide und Übersicht zeigen dieselben Seiten; welche davon
// offen ist, entscheidet nur `offeneSeiten()` — beim Wiedereinstieg zeigt der Guide genau diese,
// „auch wenn nur eine Zahl fehlt“ (Auftrag Jonas, 05.10.2026).
//
// Damit „nur fehlende Seiten“ nicht endlos nervt (Risiko 5): Jede Pflichtfrage hat einen Ausweg
// („weiß ich nicht“, „noch nicht gemessen“) — eine Annahme macht die Seite fertig, steht aber im
// Ergebnis (lib/sanierung/auswertung.ts). Seiten mit Vorschlägen (Maßnahmen) sind erst fertig,
// wenn der Nutzer sie gesehen hat.

import { ARBEITEN, type ArbeitId } from "@/lib/sanierung/arbeiten";
import type { MassnahmeId } from "@/lib/sanierung/rechner";
import { ZUSTAND_GEWERKE } from "@/lib/sanierung/zustand";
import {
  RAUM_TYPEN,
  WER_GEWERKE,
  massDe,
  mengeAus,
  betragAus,
  neuerRaum,
  type Entwurf,
  type RaumFeld,
  type RaumTyp,
} from "@/lib/sanierung/eingabe";
import { ENTHALTEN_IN, baujahrZahl, mengeVorschlag, raeumeMitMassen } from "@/lib/sanierung/auswertung";

export type SeiteId =
  | "projekt"
  | "objekt"
  | "eckdaten"
  | "ziel"
  | "arbeit"
  | "raeume"
  | "masse"
  | "massnahmen"
  | "ist"
  | "zustand"
  | "abschluss"
  | "posten"
  | "foerderung";

export type Seite = { id: SeiteId; titel: string; frage: string; pflicht: boolean };

export const SEITEN: Seite[] = [
  { id: "projekt", titel: "Projekt", frage: "Wie soll das Projekt heißen?", pflicht: true },
  { id: "objekt", titel: "Objekt", frage: "Wo liegt die Wohnung?", pflicht: false },
  { id: "eckdaten", titel: "Eckdaten", frage: "Was für eine Wohnung ist es?", pflicht: true },
  { id: "ziel", titel: "Ziel", frage: "Was hast du mit der Wohnung vor?", pflicht: true },
  { id: "arbeit", titel: "Wer arbeitet", frage: "Machst du es selbst oder ein Handwerker?", pflicht: true },
  { id: "raeume", titel: "Räume", frage: "Welche Räume hat die Wohnung?", pflicht: true },
  { id: "masse", titel: "Maße", frage: "Wie groß sind die Räume?", pflicht: true },
  { id: "massnahmen", titel: "Maßnahmen", frage: "Was soll in jedem Raum gemacht werden?", pflicht: true },
  { id: "ist", titel: "Ist-Zustand", frage: "Was ist heute drin?", pflicht: true },
  { id: "zustand", titel: "Technik", frage: "Wie sind Elektrik, Bad, Heizung, Fenster, Türen und Küche?", pflicht: true },
  { id: "abschluss", titel: "Abschluss", frage: "Entsorgung und Puffer", pflicht: true },
  { id: "posten", titel: "Eigene Posten", frage: "Kennst du schon Beträge oder deine Arbeitszeit?", pflicht: false },
  { id: "foerderung", titel: "Förderung", frage: "Gibt es Zuschüsse?", pflicht: false },
];

export const seiteNach = (id: SeiteId): Seite => SEITEN.find((s) => s.id === id)!;

const name = (r: RaumFeld) => r.name.trim() || "Raum";
const WAND: MassnahmeId[] = ["spachteln", "tapezieren", "wand_streichen"];
const NEUER_BODEN: MassnahmeId[] = ["laminat", "vinyl", "boden_fliesen"];

/** Fragt der Ist-Zustand nach der Tapete? Nur, wenn an der Wand etwas gemacht wird. */
export const fragtTapete = (r: RaumFeld) => r.massnahmen.some((m) => WAND.includes(m));
/** Fragt der Ist-Zustand nach dem alten Boden? Nur bei neuem Boden. */
export const fragtBoden = (r: RaumFeld) => r.massnahmen.some((m) => NEUER_BODEN.includes(m));
export const fragtWandfliesen = (r: RaumFeld) => r.massnahmen.includes("wand_fliesen");
const brauchtIst = (r: RaumFeld) => fragtTapete(r) || fragtBoden(r) || fragtWandfliesen(r);

/** Gewerke im Zustand-Baukasten — bei einer Eigentumswohnung ohne die der Gemeinschaft. */
export function relevanteGewerke(e: Entwurf) {
  return ZUSTAND_GEWERKE.filter((g) => !(e.projekt.etw === "ja" && g.gemeinschaftBeiEtw));
}

/** Ob eine Seite in diesem Projekt überhaupt etwas zu fragen hat (sonst überspringt der Guide sie). */
export function seiteNoetig(id: SeiteId, e: Entwurf): boolean {
  if (id === "masse" || id === "massnahmen") return e.raeume.length > 0;
  if (id === "ist") return e.raeume.some(brauchtIst);
  return true;
}

/** Was auf einer Seite noch fehlt — leer = fertig. Optionale Seiten sind immer fertig. */
export function fehlendeAngaben(id: SeiteId, e: Entwurf): string[] {
  const p = e.projekt;
  const fehlt: string[] = [];
  switch (id) {
    case "projekt":
      if (!p.name.trim()) fehlt.push("Name des Projekts");
      break;
    case "eckdaten": {
      if (p.etw === "") fehlt.push("Eigentumswohnung: ja oder nein");
      if (!p.baujahrUnbekannt && baujahrZahl(e) == null) fehlt.push("Baujahr (oder „weiß ich nicht“)");
      if (!((mengeAus(p.wohnflaeche) ?? 0) > 0)) fehlt.push("Wohnfläche");
      break;
    }
    case "ziel":
      if (p.nutzung === "") fehlt.push("Vermieten oder selbst wohnen");
      break;
    case "arbeit":
      for (const g of WER_GEWERKE) if (p.wer[g.id] === "") fehlt.push(`Wer macht: ${g.label}`);
      break;
    case "raeume":
      if (e.raeume.length === 0) fehlt.push("Mindestens ein Raum");
      for (const r of e.raeume) if (r.typ === "") fehlt.push(`Art des Raums: ${name(r)}`);
      break;
    case "masse":
      for (const r of e.raeume) {
        if (r.masseGeschaetzt) continue;
        if (!(massDe(r.laenge) > 0 && massDe(r.breite) > 0)) fehlt.push(`Länge und Breite: ${name(r)} (oder „noch nicht gemessen“)`);
        else if (!(massDe(r.hoehe) > 0)) fehlt.push(`Raumhöhe: ${name(r)}`);
      }
      break;
    case "massnahmen":
      for (const r of e.raeume) if (!r.massnahmenBestaetigt) fehlt.push(`Vorschlag ansehen: ${name(r)}`);
      break;
    case "ist":
      for (const r of e.raeume) {
        if (fragtTapete(r) && r.tapeteRunter === "") fehlt.push(`Alte Tapete: ${name(r)}`);
        if (fragtBoden(r) && r.altbelag === "") fehlt.push(`Alter Boden: ${name(r)}`);
        if (fragtBoden(r) && r.altbelag !== "" && r.altbelag !== "keiner" && r.belagRaus === "") fehlt.push(`Muss der alte Boden raus: ${name(r)}`);
        if (fragtWandfliesen(r) && r.wandfliesenRaus === "") fehlt.push(`Alte Wandfliesen: ${name(r)}`);
      }
      break;
    case "zustand": {
      const { raeume } = raeumeMitMassen(e);
      for (const g of relevanteGewerke(e)) {
        const feld = e.gewerke[g.gewerk];
        if (feld.zustand === "") {
          fehlt.push(`Zustand: ${g.titel}`);
          continue;
        }
        for (const id of feld.arbeiten) {
          if (mengeFehlt(id, e, raeume, feld.arbeiten)) fehlt.push(`Anzahl: ${ARBEITEN[id].label}`);
        }
      }
      break;
    }
    case "abschluss": {
      const puffer = mengeAus(p.puffer);
      if (puffer == null || puffer > 100) fehlt.push("Puffer in Prozent");
      if (p.entsorgung === "") fehlt.push("Entsorgung");
      break;
    }
    default:
      break; // objekt, posten, foerderung: optional
  }
  return fehlt;
}

/** Braucht diese angekreuzte Arbeit noch eine Menge vom Nutzer? (Nicht, wenn sie in einer anderen steckt.) */
function mengeFehlt(id: ArbeitId, e: Entwurf, raeume: ReturnType<typeof raeumeMitMassen>["raeume"], angekreuzt: ArbeitId[]): boolean {
  const in_ = ENTHALTEN_IN[id];
  if (in_ && angekreuzt.includes(in_)) return false;
  if (mengeAus(e.arbeitMengen[id]) != null || betragAus(e.arbeitPreise[id]) != null) return false;
  return mengeVorschlag(id, e, raeume) == null;
}

export type OffeneSeite = { seite: SeiteId; fehlt: string[] };

/** Alle Seiten, auf denen noch etwas fehlt — in Guide-Reihenfolge. Leer = fertig, direkt zum Ergebnis. */
export function offeneSeiten(e: Entwurf): OffeneSeite[] {
  return SEITEN.filter((s) => s.pflicht && seiteNoetig(s.id, e))
    .map((s) => ({ seite: s.id, fehlt: fehlendeAngaben(s.id, e) }))
    .filter((o) => o.fehlt.length > 0);
}

// ---- Lern-App-Ablauf (Umbau 06.10.2026, Jonas: „Wenn man eine Frage richtig beantwortet hat, öffnet
// sich direkt die nächste Seite“) ----------------------------------------------------------------

/**
 * Seiten, die nach einer AUSWAHL von selbst weitergehen. Nur reine Auswahlseiten — nie eine Seite, auf
 * der eine Wahl weitere Felder oder Hinweise aufklappt (Maßnahmen, Ist-Zustand mit Asbest-Hinweis,
 * Technik mit vorgekreuzten Arbeiten): dort muss man sehen, was die Wahl ausgelöst hat.
 */
export const AUTO_WEITER: SeiteId[] = ["eckdaten", "ziel", "arbeit", "abschluss"];
/** Kurz warten, damit man die gewählte Antwort noch sieht. */
export const AUTO_WEITER_MS = 450;

/**
 * Weiter ohne Klick? Nur, wenn die Seite durch DIESE Änderung fertig wurde — wer eine schon fertige
 * Seite noch einmal aufruft und eine Antwort ändert, will korrigieren, nicht weggeschickt werden.
 */
export function autoWeiter(seite: SeiteId, vorher: Entwurf, nachher: Entwurf): boolean {
  return AUTO_WEITER.includes(seite) && fehlendeAngaben(seite, vorher).length > 0 && fehlendeAngaben(seite, nachher).length === 0;
}

/** Seitenfolge des Guides: alle nötigen Seiten — oder beim Wiedereinstieg nur die offenen. */
export function guideFolge(e: Entwurf, nurOffene: boolean): SeiteId[] {
  if (nurOffene) return offeneSeiten(e).map((o) => o.seite);
  return SEITEN.filter((s) => seiteNoetig(s.id, e)).map((s) => s.id);
}

// ---- Räume -------------------------------------------------------------------------------------

/**
 * Vorschlag je Raumtyp — abwählbar, und die Seite gilt erst als fertig, wenn der Nutzer ihn gesehen
 * hat. Bewusst knapp: Streichen fällt fast überall an; Boden und Fliesen wählt der Nutzer selbst
 * (im Bad steckt das meist im Zustand „Bad“).
 */
export function vorschlagMassnahmen(typ: RaumTyp): MassnahmeId[] {
  return typ === "bad" ? ["decke_streichen"] : ["wand_streichen", "decke_streichen"];
}

/** Vorschlag für einen neuen Raum dieses Typs: aus der Vorlage des Projekts, sonst der eingebaute. */
export function vorschlagFuer(e: Pick<Entwurf, "vorschlagJeTyp">, typ: RaumTyp): MassnahmeId[] {
  return [...(e.vorschlagJeTyp[typ] ?? vorschlagMassnahmen(typ))];
}

const typLabel = (typ: RaumTyp) => RAUM_TYPEN.find((t) => t.id === typ)!.label;

/** Name für den n-ten Raum eines Typs: „Schlafzimmer“, „Schlafzimmer 2“ … */
export function raumName(typ: RaumTyp, nummer: number): string {
  return nummer <= 1 ? typLabel(typ) : `${typLabel(typ)} ${nummer}`;
}

/**
 * Typ eines Raums setzen. Noch nicht bestätigte Maßnahmen folgen dem neuen Typ; ein Name, den der
 * Nutzer nicht selbst vergeben hat („Raum 3“ oder leer), wird zum Typnamen.
 */
export function mitTyp(raeume: RaumFeld[], id: string, typ: RaumTyp, vorschlag: MassnahmeId[] = vorschlagMassnahmen(typ)): RaumFeld[] {
  return raeume.map((r) => {
    if (r.id !== id) return r;
    const autoName = r.name.trim() === "" || /^Raum \d+$/.test(r.name.trim());
    const nummer = raeume.filter((x) => x.id !== id && x.typ === typ).length + 1;
    return {
      ...r,
      typ,
      name: autoName ? raumName(typ, nummer) : r.name,
      massnahmen: r.massnahmenBestaetigt ? r.massnahmen : [...vorschlag],
    };
  });
}

/**
 * Anzahl der Räume eines Typs setzen (Seite „Räume“: Typ + Anzahl). Mehr → neue Räume mit
 * Vorschlag; weniger → von hinten nur Räume ohne Maße entfernen — eingetragene Maße gehen nie
 * stillschweigend verloren (`gesperrt` zählt, was stehen bleiben musste).
 */
export function setzeAnzahl(
  raeume: RaumFeld[],
  typ: RaumTyp,
  anzahl: number,
  neueId: () => string,
  vorschlag: MassnahmeId[] = vorschlagMassnahmen(typ),
): { raeume: RaumFeld[]; gesperrt: number } {
  const ziel = Math.max(0, Math.min(20, Math.floor(anzahl)));
  const vom = raeume.filter((r) => r.typ === typ);
  if (ziel > vom.length) {
    const neu: RaumFeld[] = [];
    for (let n = vom.length + 1; n <= ziel; n++) {
      neu.push({ ...neuerRaum(neueId(), n), typ, name: raumName(typ, n), massnahmen: [...vorschlag] });
    }
    // Neue Räume hinter den letzten ihres Typs — sonst hinten an.
    const letzter = raeume.map((r) => r.typ).lastIndexOf(typ);
    const stelle = letzter >= 0 ? letzter + 1 : raeume.length;
    return { raeume: [...raeume.slice(0, stelle), ...neu, ...raeume.slice(stelle)], gesperrt: 0 };
  }
  let zuViel = vom.length - ziel;
  const weg = new Set<string>();
  for (let i = vom.length - 1; i >= 0 && zuViel > 0; i--) {
    const r = vom[i];
    if (r.laenge.trim() === "" && r.breite.trim() === "") {
      weg.add(r.id);
      zuViel--;
    }
  }
  return { raeume: raeume.filter((r) => !weg.has(r.id)), gesperrt: zuViel };
}

/** Seite „Maßnahmen“ gesehen: alle Vorschläge gelten als bestätigt. */
export const bestaetigeMassnahmen = (raeume: RaumFeld[]): RaumFeld[] => raeume.map((r) => (r.massnahmenBestaetigt ? r : { ...r, massnahmenBestaetigt: true }));
