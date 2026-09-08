import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Wächter über die Leerzustände (Woche 4, 08.09.2026).
//
// WARUM
// Für einen neuen Nutzer ist die leere Ansicht die HÄUFIGSTE Ansicht der App —
// am Anfang ist alles leer. Etwa die Hälfte dieser Stellen war eine Sackgasse:
// ein Symbol und „Noch keine Daten". Wer dort landet, erfährt nicht, wozu der
// Bereich gut ist und was er tun soll.
//
// DIE REGEL, die hier durchgesetzt wird
// Ein Leerzustand besteht aus einer Überschrift UND einem Satz. Der Baustein
// `components/Leer.tsx` erzwingt beides über die Typen (`text` ist nicht
// optional). Dieser Test hält fest, dass niemand daran vorbei eine neue
// nackte `.empty`-Sackgasse baut.
//
// AUSNAHMEN sind erlaubt, aber sie müssen hier namentlich stehen — mit Grund.

const WURZELN = ["app", "components"];

/** Dateien mit handgebautem `className="empty"` — der Baustein wird nicht mitgezählt. */
function sammle(dir: string, raus: { pfad: string; quelle: string }[] = []) {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === ".next") continue;
    const voll = join(dir, e);
    if (statSync(voll).isDirectory()) sammle(voll, raus);
    else if (e.endsWith(".tsx")) {
      const quelle = readFileSync(voll, "utf8");
      if (quelle.includes('className="empty"')) raus.push({ pfad: voll, quelle });
    }
  }
  return raus;
}

const dateien = sammle(join(process.cwd(), "app")).concat(sammle(join(process.cwd(), "components")));

/**
 * Stellen, die BEWUSST ohne erklärenden Satz auskommen — mit Grund.
 * Wer hier etwas einträgt, muss begründen, warum ein Satz nicht hilft.
 */
const OHNE_SATZ: Record<string, string> = {
  "components/ui/CommandPalette.tsx":
    "Suchfeld: Der Nutzer tippt gerade und sieht sein eigenes Suchwort — ein Erklärsatz stünde ihm im Weg.",
  "components/Leer.tsx": "Der Baustein selbst.",
};

const rel = (p: string) => p.slice(process.cwd().length + 1).replaceAll("\\", "/");

/**
 * Den vollständigen `.empty`-Block ab einer Fundstelle schneiden.
 *
 * NICHT einfach bis zum nächsten `</div>`: Beim ersten Anlauf tat der Erkenner
 * genau das und hielt `<div className="empty-icon">📊</div>` für das Ende —
 * der erklärende Satz dahinter wurde nie gesehen, und eine tadellose Stelle
 * (`kauf/FinanzierungsVorschlaege.tsx`) galt als Sackgasse. Also die
 * Verschachtelung zählen. Selbstschließende `<div … />` zählen nicht mit.
 */
function block(quelle: string, ab: number): string {
  const tags = [...quelle.slice(ab).matchAll(/<div\b[^>]*?(\/?)>|<\/div>/g)];
  let tiefe = 1;
  for (const t of tags) {
    if (t[0] === "</div>") tiefe--;
    else if (t[1] !== "/") tiefe++;
    if (tiefe === 0) return quelle.slice(ab, ab + t.index! + t[0].length);
  }
  return quelle.slice(ab, ab + 900);
}

describe("Leerzustände", () => {
  it("der Erkenner hat überhaupt Stellen gefunden", () => {
    // Ohne diese Zusicherung wäre ein leeres Ergebnis grün — der Wächter hätte
    // dann nur bewiesen, dass er nichts gesehen hat.
    expect(dateien.length).toBeGreaterThan(8);
  });

  it("jeder handgebaute Leerzustand erklärt sich in einem Satz", () => {
    // GEFORDERT IST DER SATZ, NICHT DIE ÜBERSCHRIFT. Eine Überschrift allein
    // („Noch keine Daten") ist genau die Sackgasse, um die es geht; ein Satz
    // ohne Überschrift sagt dagegen bereits, wozu der Bereich gut ist. Acht
    // Stellen sind so gebaut und inhaltlich in Ordnung — sie deshalb umzubauen
    // wäre Arbeit ohne Gewinn.
    const nackt: string[] = [];
    for (const d of dateien) {
      if (rel(d.pfad) in OHNE_SATZ) continue;
      for (const treffer of d.quelle.matchAll(/className="empty"/g)) {
        const b = block(d.quelle, treffer.index!);
        // Ein Satz: mindestens 40 Zeichen Fließtext in einem <p>.
        const hatSatz = [...b.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].some(
          (m) => m[1].replace(/<[^>]+>/g, "").trim().length >= 40,
        );
        if (!hatSatz) nackt.push(`${rel(d.pfad)}: ${b.slice(0, 110).replace(/\s+/g, " ")}`);
      }
    }
    expect(nackt).toEqual([]);
  });

  it("die Ausnahmen existieren noch — keine Karteileichen", () => {
    const verwaist = Object.keys(OHNE_SATZ).filter((p) => !dateien.some((d) => rel(d.pfad) === p));
    expect(verwaist).toEqual([]);
  });

  it("der Baustein erzwingt den Satz über die Typen, nicht über gute Absicht", () => {
    const q = readFileSync(join(process.cwd(), "components", "Leer.tsx"), "utf8");
    // `text?:` wäre der Rückfall in die Sackgasse — dann dürfte man ihn weglassen.
    expect(q).toMatch(/\n\s*text: string;/);
    expect(q).not.toMatch(/text\?:/);
  });

  it("eine Filter-Leere bietet kein Anlegen an", () => {
    // „Lege deine erste Buchung an" ist falsch, wenn der Nutzer Buchungen HAT
    // und nur gefiltert hat. Der Baustein blendet die Aktion deshalb aus.
    const q = readFileSync(join(process.cwd(), "components", "Leer.tsx"), "utf8");
    expect(q).toMatch(/art === "nichts" && aktion/);
  });
});
