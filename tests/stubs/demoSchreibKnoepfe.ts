// Findet Knöpfe in Client-Komponenten, die per onClick eine Server-Action starten — direkt
// (`onClick={() => speichere(…)}`) oder über eine eigene Funktion der Datei, die eine Action ruft
// (`onClick={speichern}` → `async function speichern() { … saveKalkulation(…) … }`).
//
// Grundlage für den Wächter in tests/paketP5.test.ts (Audit P5, B54): Jeder solche Knopf braucht
// `data-demo-sperre`, sonst läuft er in der Demo an `DemoNurLesen` vorbei (das sperrt nur
// Absende-Knöpfe in Formularen) und endet in einer unverständlichen Fehlermeldung.
//
// Bewusst eine Heuristik auf dem Quelltext: Sie soll neue Stellen finden, nicht jede denkbare
// Indirektion. Kommentare UND Zeichenketten werden vorher längengleich geleert (`entkleide`):
// Ein `accept="image/*"` hielt ein einfacher Kommentar-Filter für den Beginn eines Kommentars und
// leerte den Code bis zum nächsten `*/` — der Wächter sah dort keinen einzigen Knopf.
import { readFileSync } from "node:fs";
import { entkleide } from "./tsAnweisungen";

export type SchreibKnopf = {
  datei: string;
  zeile: number;
  /** Position von „<button“ im Quelltext (Kommentare werden längengleich ersetzt). */
  offset: number;
  ruft: string[];
  /** Ruft eine importierte Action DIREKT im eigenen onClick (nicht über eine eigene Funktion). */
  direkt: boolean;
  markiert: boolean;
};

/** Namen der Server-Actions, die eine Datei importiert. */
export function importierteActions(quelle: string): Set<string> {
  const namen = new Set<string>();
  for (const m of quelle.matchAll(/import\s*\{([^}]*)\}\s*from\s*"@\/lib\/actions\/[^"]+"/g)) {
    for (const teil of m[1].split(",")) {
      const t = teil.trim();
      if (!t || t.startsWith("type ")) continue;
      const name = t.split(/\s+as\s+/).pop()!.trim();
      if (name) namen.add(name);
    }
  }
  return namen;
}

/** Eigene Funktionen der Datei, die (bis zu zwei Stufen tief) eine der Actions aufrufen. */
export function rufendeFunktionen(quelle: string, actions: Set<string>): Set<string> {
  const defs: { name: string; start: number }[] = [];
  for (const m of quelle.matchAll(/(?:async\s+function\s+(\w+)\s*\(|function\s+(\w+)\s*\(|const\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>)/g)) {
    defs.push({ name: (m[1] ?? m[2] ?? m[3])!, start: m.index! });
  }
  const koerper = (i: number) => quelle.slice(defs[i].start, i + 1 < defs.length ? defs[i + 1].start : defs[i].start + 2500);
  const ziel = new Set(actions);
  const gefunden = new Set<string>();
  for (let runde = 0; runde < 2; runde++) {
    defs.forEach((d, i) => {
      if (gefunden.has(d.name) || actions.has(d.name)) return;
      const k = koerper(i).slice(d.name.length + 6);
      if ([...ziel].some((n) => new RegExp(`\\b${n}\\(`).test(k))) gefunden.add(d.name);
    });
    gefunden.forEach((n) => ziel.add(n));
  }
  return gefunden;
}

export function schreibKnoepfe(datei: string): SchreibKnopf[] {
  const roh = readFileSync(datei, "utf8");
  if (!/^\s*["']use client["']/.test(roh)) return [];
  const quelle = entkleide(roh);
  const actions = importierteActions(roh);
  if (actions.size === 0) return [];
  const lokale = rufendeFunktionen(quelle, actions);
  const alle = [...actions, ...lokale];
  const knoepfe: SchreibKnopf[] = [];
  for (const m of quelle.matchAll(/<button\b/g)) {
    // Öffnendes Tag bis zum ersten „>“, das nicht in {…} steht.
    let tiefe = 0;
    let i = m.index! + 7;
    for (; i < quelle.length; i++) {
      const c = quelle[i];
      if (c === "{") tiefe++;
      else if (c === "}") tiefe--;
      else if (c === ">" && tiefe === 0) break;
    }
    const tag = quelle.slice(m.index!, i + 1);
    const klick = /onClick=\{([\s\S]*)\}/.exec(tag)?.[1] ?? "";
    if (!klick) continue;
    const ruft = alle.filter((n) => new RegExp(`(^|[^\\w.])${n}(\\(|\\s*\\}|$)`).test(klick) || new RegExp(`\\b${n}\\(`).test(klick));
    if (ruft.length === 0) continue;
    knoepfe.push({
      datei,
      zeile: roh.slice(0, m.index!).split("\n").length,
      offset: m.index!,
      ruft,
      direkt: ruft.some((n) => actions.has(n)),
      markiert: /data-demo-sperre/.test(tag),
    });
  }
  return knoepfe;
}
