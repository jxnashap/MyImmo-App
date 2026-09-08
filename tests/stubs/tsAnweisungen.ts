// Grobe Zerlegung von TypeScript-Quelltext in Anweisungen — für die
// Wächter-Tests, die eine ganze Datei-Klasse absichern.
//
// WARUM ES DIESE DATEI GIBT (08.09.2026)
// Der erste Wächter in `schreibFehler.test.ts` zählte Klammern direkt im
// Rohtext. In `lib/actions/bewertung.ts` stehen Kommentare der Form
// `// 5) Persistieren.` — die schließende Klammer hat keine öffnende. Die
// Klammertiefe rutschte damit ins Negative, es wurde keine einzige Anweisung
// mehr erkannt, und der Test meldete für diese Datei GRÜN, ohne sie je
// angesehen zu haben. Genau darin lagen vier ungeprüfte Schreibvorgänge.
//
// Lehre: Ein Wächter, der still nichts findet, ist schlimmer als keiner —
// er behauptet, geprüft zu haben. Deshalb meldet `anweisungen()` zusätzlich,
// ob die Klammern aufgingen, und die Tests werten das aus.

/** Kommentare und Zeichenketten durch Leerzeichen ersetzen (Länge bleibt gleich). */
export function entkleide(quelle: string): string {
  const out = [...quelle];
  const n = quelle.length;
  let i = 0;
  const leeren = (von: number, bis: number) => {
    for (let k = von; k < Math.min(bis, n); k++) if (out[k] !== "\n") out[k] = " ";
  };
  while (i < n) {
    const c = quelle[i];
    if (c === "/" && quelle[i + 1] === "/") {
      const j = quelle.indexOf("\n", i);
      const ende = j < 0 ? n : j;
      leeren(i, ende);
      i = ende;
    } else if (c === "/" && quelle[i + 1] === "*") {
      const j = quelle.indexOf("*/", i + 2);
      const ende = j < 0 ? n : j + 2;
      leeren(i, ende);
      i = ende;
    } else if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < n) {
        if (quelle[j] === "\\") {
          j += 2;
          continue;
        }
        if (quelle[j] === c) break;
        j++;
      }
      leeren(i, j + 1);
      i = Math.min(j + 1, n);
    } else {
      i++;
    }
  }
  return out.join("");
}

export type Zerlegung = {
  /** Die Anweisungen im ORIGINALTEXT (für lesbare Fehlermeldungen). */
  anweisungen: string[];
  /** Die Anweisungen ohne Kommentare/Zeichenketten (zum Suchen). */
  entkleidet: string[];
  /** Niedrigste erreichte Klammertiefe. Unter 0 = der Erkenner ist blind. */
  mindestTiefe: number;
};

/** An ';' auf Klammertiefe 0 trennen — Kommentare und Strings zählen nicht mit. */
export function anweisungen(quelle: string): Zerlegung {
  const roh = entkleide(quelle);
  const anweisungen: string[] = [];
  const entkleidet: string[] = [];
  let tiefe = 0;
  let mindestTiefe = 0;
  let start = 0;
  for (let i = 0; i < roh.length; i++) {
    const c = roh[i];
    if (c === "(") tiefe++;
    else if (c === ")") {
      tiefe--;
      if (tiefe < mindestTiefe) mindestTiefe = tiefe;
    } else if (c === ";" && tiefe === 0) {
      anweisungen.push(quelle.slice(start, i + 1));
      entkleidet.push(roh.slice(start, i + 1));
      start = i + 1;
    }
  }
  return { anweisungen, entkleidet, mindestTiefe };
}
