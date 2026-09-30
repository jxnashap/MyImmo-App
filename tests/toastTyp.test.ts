import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Ein Fehler darf nicht mit grünem Haken erscheinen.
//
// `toast(msg)` hat den Standardtyp "success" (components/Toast.tsx). Jeder
// Aufruf, der eine FEHLERmeldung zeigt, ohne den Typ zu nennen, erscheint
// deshalb grün mit ✓ — der Nutzer hält einen Fehlschlag für erledigt.
// `MietkontoBestaetigung.tsx` hatte das schon einmal (siehe Kommentar dort);
// am 30.09.2026 standen 24 weitere Stellen so im Code.
//
// Aufgefallen ist es über die Demo: Seit der lauten Schreibsperre (Migration
// 20260930150643) scheitert dort JEDER Schreibversuch mit einer Meldung — und
// die kam grün.
//
// Erkannt wird ein Aufruf in EINER Zeile, dessen Text nach Fehler aussieht
// (`.error`, `.fehler`, `e.message`, „fehlgeschlagen", „Fehler"). Er muss
// einen Typ nennen: "error" (oder "info" bzw. eine Bedingung, die zwischen
// "success" und "error" wählt).

function alleDateien(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? alleDateien(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

const FEHLERHAFT = /\.(error|fehler)\b|\be\.message\b|fehlgeschlagen|Fehler/;
const MIT_TYP = /"(error|info)"|\?\s*"success"\s*:\s*"error"/;

const aufrufe = [...alleDateien("components"), ...alleDateien("app")].flatMap((p) =>
  readFileSync(p, "utf8")
    .split("\n")
    .map((zeile, i) => ({ ort: `${p}:${i + 1}`, zeile: zeile.trim() }))
    .filter(({ zeile }) => /\btoast\(/.test(zeile) && !zeile.startsWith("//") && !zeile.startsWith("*")),
);

describe("toast: Fehler erscheinen nicht als Erfolg", () => {
  it("der Erkenner hat gesucht", () => {
    expect(aufrufe.length).toBeGreaterThan(80);
    expect(aufrufe.filter((a) => FEHLERHAFT.test(a.zeile)).length).toBeGreaterThan(20);
  });

  it("jeder Fehler-Toast nennt seinen Typ", () => {
    const ohneTyp = aufrufe
      .filter(({ zeile }) => FEHLERHAFT.test(zeile) && !MIT_TYP.test(zeile))
      .map(({ ort, zeile }) => `${ort}  ${zeile}`);
    expect(ohneTyp).toEqual([]);
  });

  it("der Standardtyp ist weiterhin „success“ — sonst ist dieser Test gegenstandslos", () => {
    expect(readFileSync("components/Toast.tsx", "utf8")).toMatch(/\(msg, type = "success", opts\)/);
  });
});
