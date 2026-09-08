import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

// Wächter über die Lade-Zustände (Woche 4, 08.09.2026).
//
// WARUM
// Next.js zeigt während des Server-Renderns einer Seite NICHTS an, solange kein
// `loading.tsx` daneben liegt — der Nutzer klickt, und für eine gefühlte Ewigkeit
// passiert sichtbar gar nichts. Vor diesem Durchgang hatten 12 von 55 Seiten eines.
//
// WAS HIER GEPRÜFT WIRD
// Jede Seite, die tatsächlich Daten lädt (Server-Komponente mit `await`), braucht
// ein `loading.tsx`. Seiten ohne Ladevorgang brauchen KEINS — ein Skeleton, das
// nur aufblitzt, ist schlechter als keins. Die Ausnahmen stehen namentlich unten,
// jede mit Grund; wer eine neue Ausnahme einträgt, muss sie begründen.
//
// REGEL DES HAUSES: Ein Wächter, der nichts findet, muss belegen können, dass er
// gesucht hat. Deshalb die Mindestzahlen am Ende.

const WURZEL = join(process.cwd(), "app", "(app)");

/** Seiten, die BEWUSST kein `loading.tsx` haben — mit Grund. */
const OHNE_LADEZUSTAND: Record<string, string> = {
  anmelden: "Reine Client-Seite (Rollen-Auswahl), lädt nichts vom Server.",
  login: "Client-Seite; der Ladezustand steckt im Formular selbst.",
  bewerbungen: "Nur ein redirect() auf /anliegen — es gibt nichts zu rendern.",
  hilfe: "Statischer Text aus components/HilfeInhalt.tsx, kein Datenzugriff.",
  "properties/import": "Rahmen um einen Client-Wizard, keine Server-Daten.",
  "properties/new": "Rahmen um ein Client-Formular, keine Server-Daten.",
};

type Seite = { pfad: string; datei: string; quelle: string };

function sammleSeiten(dir: string, praefix = ""): Seite[] {
  const raus: Seite[] = [];
  for (const e of readdirSync(dir)) {
    const voll = join(dir, e);
    if (statSync(voll).isDirectory()) {
      raus.push(...sammleSeiten(voll, praefix ? `${praefix}/${e}` : e));
    } else if (e === "page.tsx") {
      raus.push({ pfad: praefix, datei: voll, quelle: readFileSync(voll, "utf8") });
    }
  }
  return raus;
}

const seiten = sammleSeiten(WURZEL);

/** Lädt die Seite serverseitig Daten? */
const laedtDaten = (s: Seite) =>
  !/^\s*["']use client["']/m.test(s.quelle.slice(0, 200)) && /\bawait\s/.test(s.quelle);

const hatLadezustand = (s: Seite) => existsSync(join(s.datei, "..", "loading.tsx"));

describe("Lade-Zustände (loading.tsx)", () => {
  it("der Erkenner hat überhaupt Seiten gefunden", () => {
    // Ohne diese Zusicherung wäre ein leeres Ergebnis grün — der Wächter hätte
    // dann nur bewiesen, dass er nichts gesehen hat.
    expect(seiten.length).toBeGreaterThan(40);
  });

  it("jede Seite, die Daten lädt, hat einen Lade-Zustand", () => {
    const fehlend = seiten
      .filter(laedtDaten)
      .filter((s) => !hatLadezustand(s))
      .map((s) => s.pfad)
      .filter((p) => !(p in OHNE_LADEZUSTAND));
    expect(fehlend).toEqual([]);
  });

  it("die Ausnahmen laden wirklich nichts — sonst sind sie keine Ausnahmen mehr", () => {
    // Wird aus einer Ausnahme später doch eine datenladende Seite, fällt das hier
    // auf, statt still ohne Lade-Zustand zu bleiben.
    const zuUnrecht = Object.keys(OHNE_LADEZUSTAND).filter((p) => {
      const s = seiten.find((x) => x.pfad === p);
      return s && laedtDaten(s);
    });
    expect(zuUnrecht).toEqual([]);
  });

  it("jede Ausnahme existiert noch — keine Karteileichen", () => {
    const verwaist = Object.keys(OHNE_LADEZUSTAND).filter((p) => !seiten.some((x) => x.pfad === p));
    expect(verwaist).toEqual([]);
  });

  it("kein Lade-Zustand zeigt eine Topbar, wo die Seite keine hat", () => {
    // Die öffentlichen Token-Seiten laufen ohne App-Rahmen. Ein TopbarSkeleton
    // würde dort einen Balken versprechen, der nie erscheint.
    const oeffentlich = seiten.filter((s) => /\[token\]$/.test(s.pfad) && hatLadezustand(s));
    expect(oeffentlich.length).toBeGreaterThanOrEqual(3);
    for (const s of oeffentlich) {
      const l = readFileSync(join(s.datei, "..", "loading.tsx"), "utf8");
      expect(l, s.pfad).not.toMatch(/TopbarSkeleton/);
    }
  });

  it("die Abdeckung ist tatsächlich hoch — nicht nur formal erfüllt", () => {
    const ladend = seiten.filter(laedtDaten);
    const abgedeckt = ladend.filter(hatLadezustand);
    expect(ladend.length).toBeGreaterThan(40);
    expect(abgedeckt.length / ladend.length).toBeGreaterThan(0.95);
  });
});
