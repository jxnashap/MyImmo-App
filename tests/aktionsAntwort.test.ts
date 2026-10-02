import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Die Antwort einer Server-Action wird ausgewertet, nicht verworfen.
//
// `schreibFehler.test.ts` stellt sicher, dass die ACTIONS ihre Fehler melden.
// Das nützt nichts, wenn der Aufrufer die Antwort wegwirft:
// `startTransition(async () => { await setzeBelegFreigabe(…); })` — scheitert
// die Action, bleibt der Schalter stumm stehen. Der alte Wächter prüfte das
// nur für `DeleteButton`; am 30.09.2026 standen sieben weitere Stellen so im
// Code (MietZeitraeume, Beleg-/Notiz-Freigabe, DSGVO-Aufräumen, Auftrags-
// Freigabe). Aufgefallen über die Demo: Dort scheitert seit der lauten
// Schreibsperre JEDER Schreibversuch — sichtbar wurde es trotzdem nirgends.
//
// Gesucht wird ein `await <action>(` als eigene Anweisung, also ohne `=`,
// `return` oder umschließenden Aufruf davor. `apply(await x())` und
// `const r = await x()` sind in Ordnung.

// Actions, die bei einem Fehler WERFEN statt `{ error }` zurückzugeben. Dort
// ist das Verwerfen nicht STILL: Der Fehler kommt als Ausnahme an (ob der
// Aufrufer ihn schön anzeigt, ist eine andere Frage — PositionsManager zeigte
// die Fehlerseite, siehe dort). Abgeleitet aus dem Quelltext statt als
// Handliste, damit ein Umbau einer Action den Wächter nicht still aushebelt:
// Wer von „werfen" auf „{ error } zurückgeben" umstellt, fällt hier heraus.
function werfendeActions(): Set<string> {
  const namen = new Set<string>();
  for (const f of readdirSync("lib/actions").filter((f) => f.endsWith(".ts"))) {
    const quelle = readFileSync(join("lib/actions", f), "utf8");
    const teile = quelle.split(/(?=^export async function )/m).slice(1);
    for (const teil of teile) {
      const name = /^export async function (\w+)/.exec(teil)![1];
      const wirft = /throw new Error/.test(teil);
      const gibtFehlerZurueck = /return \{[^}]*\berror\b/.test(teil);
      if (wirft && !gibtFehlerZurueck) namen.add(name);
    }
  }
  return namen;
}
const WERFEN = werfendeActions();

function alleDateien(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? alleDateien(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

function importierteActions(quelle: string): string[] {
  return [...quelle.matchAll(/import\s*\{([^}]*)\}\s*from\s*"@\/lib\/actions\/[^"]+"/g)].flatMap((m) =>
    m[1]
      .split(",")
      .map((n) => n.trim().split(/\s+as\s+/).pop()!.trim())
      .filter((n) => n && !n.startsWith("type ")),
  );
}

const dateien = [...alleDateien("components"), ...alleDateien("app")];

describe("Server-Action-Antworten werden ausgewertet", () => {
  it("der Erkenner hat gesucht", () => {
    const mitActions = dateien.filter((p) => importierteActions(readFileSync(p, "utf8")).length > 0);
    expect(mitActions.length).toBeGreaterThan(40);
    // Die Ableitung trennt tatsächlich: bekannte Werfer drin, bekannte
    // `{ error }`-Rückgeber draußen.
    expect(WERFEN.has("deletePosition")).toBe(true);
    expect(WERFEN.has("updateDokument")).toBe(true);
    expect(WERFEN.has("setzeBelegFreigabe")).toBe(false);
    expect(WERFEN.has("loescheWiederherstellungscodes")).toBe(false);
  });

  it("kein `await action(…)` als verworfene Anweisung", () => {
    const verworfen: string[] = [];
    for (const p of dateien) {
      const quelle = readFileSync(p, "utf8");
      const namen = importierteActions(quelle).filter((n) => !WERFEN.has(n));
      quelle.split("\n").forEach((zeile, i) => {
        for (const n of namen) {
          if (new RegExp(`(^|[;{])\\s*await\\s+${n}\\(`).test(zeile)) verworfen.push(`${p}:${i + 1}  ${zeile.trim()}`);
        }
      });
    }
    expect(verworfen).toEqual([]);
  });

  it("eine WERFENDE Action als eigene Anweisung steht in einem try", () => {
    // Die Ausnahme oben gilt, weil der Fehler laut ankommt — aber „laut" hieß
    // in PositionsManager, SettingsView und ArchivManager: Die Transition
    // reichte ihn an die Fehlerseite weiter, oder das Promise im onClick
    // verpuffte ganz. Gesucht wird ein `try` in den drei Zeilen davor.
    const ungeschuetzt: string[] = [];
    let geprueft = 0;
    for (const p of dateien) {
      const quelle = readFileSync(p, "utf8");
      const zeilen = quelle.split("\n");
      const namen = importierteActions(quelle).filter((n) => WERFEN.has(n));
      zeilen.forEach((zeile, i) => {
        for (const n of namen) {
          if (!new RegExp(`(^|[;{])\\s*await\\s+${n}\\(`).test(zeile)) continue;
          geprueft++;
          // Das KONSTRUKT `try {` in einer Code-Zeile — nicht das Wort. Die
          // erste Fassung suchte `\btry\b` und ließ sich vom Kommentar
          // „Ohne try/catch reichte React …" direkt darüber täuschen: Die
          // Mutation, die das try entfernte, blieb grün.
          const davor = zeilen.slice(Math.max(0, i - 3), i + 1).filter((z) => !/^\s*(\/\/|\*|\/\*)/.test(z));
          if (!davor.some((z) => /\btry\s*\{/.test(z))) {
            ungeschuetzt.push(`${p}:${i + 1}  ${zeile.trim()}`);
          }
        }
      });
    }
    expect(geprueft).toBeGreaterThan(5);
    expect(ungeschuetzt).toEqual([]);
  });
});
