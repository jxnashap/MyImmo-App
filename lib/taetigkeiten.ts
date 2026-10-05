// Tätigkeit eines Auftrags (05.10.2026) — die Sperre für den Hausmeister hängt nicht mehr an
// einzelnen Wörtern, sondern an einer Liste ERLAUBTER Tätigkeiten (Prüfung vor dem Livegang).
//
// „Selbst erledigt“ darf ein HAUSMEISTER nur bei Tätigkeiten mit `selbst: true`, und auch dann
// nur, wenn der Text kein Gas/Strom/Trinkwasser/Schornstein-Stichwort enthält (zweites Netz,
// lib/fachbetriebPflicht.ts). Alles andere — auch „Sonstiges“ — braucht einen Fachbetrieb am
// Auftrag. Ein DIENSTLEISTER (Sanitärbetrieb, Gärtner) ist selbst der Betrieb: für ihn gilt keine
// Sperre. Aufträge von vor dem 05.10.2026 haben keine Tätigkeit — dort entscheiden die Stichworte.
//
// Die Liste steht auch als Prüfregel in der Datenbank (Migration 20261005140000) — Schlüssel
// hier ändern heißt dort mitändern; tests/taetigkeiten.test.ts gleicht beides ab.
import { fachbetriebPflicht } from "@/lib/fachbetriebPflicht";

export type Taetigkeit = { key: string; label: string; selbst: boolean };

export const TAETIGKEITEN: readonly Taetigkeit[] = [
  { key: "kontrolle", label: "Kontrolle / Begehung", selbst: true },
  { key: "leuchtmittel", label: "Leuchtmittel tauschen", selbst: true },
  { key: "reinigung", label: "Reinigung / Treppenhaus", selbst: true },
  { key: "garten", label: "Garten / Winterdienst", selbst: true },
  { key: "rinne", label: "Dachrinne / Fallrohr reinigen", selbst: true },
  { key: "tuer", label: "Tür, Fenster, Schloss einstellen", selbst: true },
  { key: "kleinreparatur", label: "Kleinreparatur (Silikon, Dichtung, Möbel)", selbst: true },
  { key: "muell", label: "Müll / Entrümpelung", selbst: true },
  { key: "heizung", label: "Heizung / Warmwasser", selbst: false },
  { key: "gas", label: "Gas", selbst: false },
  { key: "elektro", label: "Elektro", selbst: false },
  { key: "wasser", label: "Trinkwasser / Leitungen", selbst: false },
  { key: "schornstein", label: "Schornstein / Abgas", selbst: false },
  { key: "dach", label: "Dach / Fassade (Arbeit in der Höhe)", selbst: false },
  { key: "sonstiges", label: "Sonstiges", selbst: false },
];

export const TAETIGKEIT_KEYS = TAETIGKEITEN.map((t) => t.key);

export function taetigkeit(key: string | null | undefined): Taetigkeit | null {
  return TAETIGKEITEN.find((t) => t.key === key) ?? null;
}

export type SelbstPruefung = { erlaubt: true } | { erlaubt: false; grund: string };

/**
 * Darf der Partner diesen Auftrag OHNE Fachbetrieb als erledigt melden?
 * Die EINE Regel für Oberfläche und Server.
 */
export function selbstErledigtErlaubt(a: {
  rolle: "hausmeister" | "dienstleister";
  taetigkeit: string | null | undefined;
  titel: string | null | undefined;
  beschreibung: string | null | undefined;
  firmaId: string | null | undefined;
}): SelbstPruefung {
  if (a.rolle === "dienstleister") return { erlaubt: true };
  if (a.firmaId) return { erlaubt: true }; // der Vermieter hat einen Fachbetrieb freigegeben
  const t = taetigkeit(a.taetigkeit);
  if (t && !t.selbst) {
    return { erlaubt: false, grund: `„${t.label}“ erledigt ein Fachbetrieb, nicht der Hausmeister.` };
  }
  const p = fachbetriebPflicht(a.titel, a.beschreibung);
  if (p) return { erlaubt: false, grund: p.grund };
  return { erlaubt: true };
}
