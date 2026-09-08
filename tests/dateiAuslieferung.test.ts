import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { dateiKopf, INLINE_TYPEN } from "@/lib/net/dateiKopf";

// AUSLIEFERUNG HOCHGELADENER DATEIEN (Fund vom 08.09.2026).
//
// Sieben Routen geben Dateien zurück, die ein Nutzer hochgeladen hat. Sie
// nahmen den gespeicherten `Content-Type` unverändert und lieferten
// standardmäßig `inline` aus. Vier der Upload-Pfade haben KEINE MIME-Weißliste
// (`beleihung`, `makler`, `buchungen`, `archiv`) — dort kam an, was jemand
// geschickt hat.
//
// WARUM DIE CSP DAS NICHT ALLEIN AUFFING: Sie ist streng
// (`script-src 'self' 'nonce-…'`), ein Inline-Skript in einer hochgeladenen
// HTML-Datei wäre blockiert. Aber `'self'` erlaubt Skripte von JEDEM Pfad der
// eigenen Domain — auch von einer hochgeladenen `.js`-Datei, ausgeliefert über
// ihre eigene Route mit einem MIME-Typ, den der Hochladende selbst bestimmt.
//
// EHRLICH ZUR AUSNUTZBARKEIT: Der Angreifer muss ein registrierter Vermieter
// sein und jemanden dazu bringen, seinen Freigabe-Link zu öffnen
// (`/beleihung/<token>/datei/<key>` ist die einzige dieser Routen ohne Login).
// Kein Selbstläufer — aber der Schaden träfe eine fremde Sitzung auf der
// eigenen Domain.
//
// GELÖST AN DER AUSLIEFERUNG, NICHT AM UPLOAD: Eine Weißliste beim Hochladen
// würde nur neue Dateien erfassen. `dateiKopf()` greift auch für alles, was
// bereits in der Datenbank liegt.

describe("dateiKopf(): was inline gezeigt werden darf", () => {
  it("PDF und Bilder werden inline ausgeliefert", () => {
    for (const typ of INLINE_TYPEN) {
      const k = dateiKopf(typ, "beleg.pdf", false);
      expect(k["Content-Type"], typ).toBe(typ);
      expect(k["Content-Disposition"], typ).toContain("inline");
    }
  });

  it("HTML, JavaScript und SVG NICHT — sie werden zum Download gezwungen", () => {
    // SVG ist bewusst nicht dabei: Es ist ein Dokument und darf Skript
    // enthalten. JavaScript ist der eigentliche Umgehungsweg der CSP.
    for (const typ of [
      "text/html",
      "application/xhtml+xml",
      "text/javascript",
      "application/javascript",
      "image/svg+xml",
      "text/plain",
      "application/xml",
    ]) {
      const k = dateiKopf(typ, "boese.html", false);
      expect(k["Content-Type"], typ).toBe("application/octet-stream");
      expect(k["Content-Disposition"], typ).toContain("attachment");
    }
  });

  it("Groß-/Kleinschreibung und Parameter hebeln die Weißliste nicht aus", () => {
    // "TEXT/HTML" oder "text/html; charset=utf-8" wären sonst unbekannt und
    // fielen — richtig — auf octet-stream; umgekehrt darf ein legitimes
    // "APPLICATION/PDF" nicht zum Download gezwungen werden.
    expect(dateiKopf("APPLICATION/PDF", "x.pdf", false)["Content-Type"]).toBe("application/pdf");
    expect(dateiKopf("application/pdf; charset=binary", "x.pdf", false)["Content-Type"]).toBe("application/pdf");
    expect(dateiKopf("TEXT/HTML", "x.html", false)["Content-Type"]).toBe("application/octet-stream");
  });

  it("ein fehlender oder leerer Typ wird zum Download", () => {
    for (const typ of [null, undefined, "", "   "]) {
      expect(dateiKopf(typ, "x", false)["Content-Type"]).toBe("application/octet-stream");
    }
  });

  it("ausdrücklicher Download bleibt Download, auch bei sicherem Typ", () => {
    expect(dateiKopf("application/pdf", "x.pdf", true)["Content-Disposition"]).toContain("attachment");
  });

  it("nosniff ist immer gesetzt", () => {
    // Ohne nosniff könnte der Browser octet-stream als HTML interpretieren.
    expect(dateiKopf("application/pdf", "x.pdf", false)["X-Content-Type-Options"]).toBe("nosniff");
    expect(dateiKopf("text/html", "x.html", false)["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("die Dateien werden nicht zwischengespeichert", () => {
    // Es sind Gehaltsabrechnungen und SCHUFA-Auskünfte; ein Proxy-Cache wäre
    // die falsche Stelle dafür.
    expect(dateiKopf("application/pdf", "x.pdf", false)["Cache-Control"]).toBe("private, no-store");
  });
});

describe("Der Dateiname im Header", () => {
  it("Anführungszeichen und Semikolon können keine Header-Parameter unterschieben", () => {
    const k = dateiKopf("application/pdf", 'x.pdf"; filename*=UTF-8\'\'boese.html', false);
    const d = k["Content-Disposition"];
    // Der bereinigte Name darf die WÖRTER „filename" usw. ruhig als Text
    // enthalten — gefährlich wären nur echte Header-Zeichen. Geprüft wird
    // deshalb: genau EIN `filename="`-Parameter, und im Wert kein
    // Anführungszeichen. (Erster Testentwurf zählte Wortvorkommen und war
    // deshalb falsch rot.)
    expect(d.match(/filename="/g)).toHaveLength(1);
    expect(d.slice(d.indexOf('filename="') + 10, -1)).not.toContain('"');
  });

  it("Zeilenumbrüche werden entfernt", () => {
    // Auch hier: dass „Set-Cookie" als Text im Namen steht, ist harmlos —
    // entscheidend ist, dass kein Zeilenumbruch übrig bleibt, mit dem sich
    // ein echter zweiter Header anhängen ließe.
    const d = dateiKopf("application/pdf", "x\r\nSet-Cookie: a=b", false)["Content-Disposition"];
    expect(d).not.toMatch(/[\r\n]/);
    expect(d).not.toContain(":");
  });

  it("sehr lange Namen werden gekappt", () => {
    const d = dateiKopf("application/pdf", "a".repeat(500), false)["Content-Disposition"];
    expect(d.length).toBeLessThan(200);
  });

  it("ohne Namen steht ein Ersatzname da", () => {
    expect(dateiKopf("application/pdf", null, false)["Content-Disposition"]).toContain("Dokument");
  });
});

describe("Alle Datei-Routen benutzen den Helfer", () => {
  /** Alle route.ts unter app/. */
  function routen(ordner: string): string[] {
    return readdirSync(ordner).flatMap((n) => {
      const p = join(ordner, n);
      return statSync(p).isDirectory() ? routen(p) : n === "route.ts" ? [p] : [];
    });
  }

  const alle = routen("app");

  it("keine Route setzt Content-Type mehr aus einem gespeicherten Feld", () => {
    // DAS ist die eigentliche Sperre: Eine NEUE Route, die den hochgeladenen
    // Typ wieder direkt durchreicht, wird hier rot.
    const verdaechtig = alle.filter((p) => {
      const s = readFileSync(p, "utf8");
      return /"Content-Type":\s*[a-z]\w*\.(datei_type|mime|foto_type|rechnung_type|typ)\b/.test(s);
    });
    expect(verdaechtig).toEqual([]);
  });

  it("die sieben bekannten Datei-Routen liefern über dateiKopf() aus", () => {
    const erwartet = [
      "app/(app)/archiv/[id]/datei/route.ts",
      "app/(app)/beleihung/[token]/datei/[key]/route.ts",
      "app/(app)/kosten/[id]/rechnung/route.ts",
      "app/(app)/makler/datei/[key]/route.ts",
      "app/(app)/properties/[id]/beleihung/datei/[key]/route.ts",
      "app/api/anliegen-datei/[id]/route.ts",
      "app/api/zaehler-foto/[id]/route.ts",
    ];
    for (const p of erwartet) {
      expect(readFileSync(p, "utf8"), p).toContain("dateiKopf(");
    }
  });

  it("die öffentliche Bank-Route bleibt aus dem Suchindex", () => {
    const s = readFileSync("app/(app)/beleihung/[token]/datei/[key]/route.ts", "utf8");
    expect(s).toContain("X-Robots-Tag");
  });
});
