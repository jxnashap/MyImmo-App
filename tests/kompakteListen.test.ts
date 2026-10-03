// Kompakte Listen (03.10.2026, „die ganze App so übersichtlich“): Kredite, Objekte, Mieter, Archiv
// zeigen EINE Zeile je Eintrag; Einzelheiten liegen eine Ebene tiefer. Die Tests halten fest, dass
// dabei nichts verloren geht und die Handy-Regel wirklich greift.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const lies = (p: string) => readFileSync(p, "utf8");

describe("Handy: Zusatzspalten verschwinden wirklich", () => {
  it("die Ausblende-Regel ist spezifischer als `.badge`", () => {
    // `.badge { display: inline-flex }` steht WEITER UNTEN in globals.css — mit gleicher
    // Spezifität gewann es, und „8/10 Angaben“ + „Vermietet“ drückten am Handy den Titel weg.
    const css = lies("app/globals.css");
    const block = css.slice(css.indexOf(".listen-zeile-zahl b {"), css.indexOf("/* Mietkonto (03.10.2026)"));
    expect(block).toMatch(/@media \(max-width: 560px\) \{[\s\S]*\.listen-zeile \.listen-zeile-extra \{ display: none; \}/);
  });
});

describe("Kredite: die Zeile verschluckt nichts", () => {
  const q = lies("components/KrediteListe.tsx");
  it("der Dialog zeigt alle Felder der früheren Karte", () => {
    for (const f of ["Urspr. Darlehen", "Restschuld", "Rate / Monat", "Laufzeit", "Zinsen / Mo.", "Tilgung / Mo.",
      "Tilgungssatz", "Zinsbindung", "Grundschuld", "Beleihungsauslauf", "Sondertilgung", "Getilgt"]) {
      expect(q, f).toContain(`feld("${f}"`);
    }
    expect(q).toContain("<Details k={offen} />");
  });
  it("die Zeile nennt Restschuld, Rate und fehlendes Auszahlungsdatum", () => {
    expect(q).toMatch(/<b>\{euro\(k\.restschuld\)\}<\/b><small>\{euro\(k\.monatsrate\)\} \/ Mo\.<\/small>/);
    expect(q).toMatch(/\{!k\.auszahlung_datum && <span className="badge badge-amber listen-zeile-extra"/);
  });
});

describe("Objekte und Mieter: Zeile mit Link, Löschen nur auf der Detailseite", () => {
  it("Objektliste: Link je Objekt, kein Löschknopf mehr", () => {
    const q = lies("app/(app)/properties/page.tsx");
    expect(q).toMatch(/href=\{`\/properties\/\$\{p\.id\}`\} className="listen-zeile"/);
    expect(q).not.toContain("DeleteButton");
  });
  it("Mieterliste: Link je Mieter, Ausgezogene getrennt, Kaution offen nur bei laufenden", () => {
    const q = lies("app/(app)/tenants/page.tsx");
    expect(q).toMatch(/href=\{`\/tenants\/\$\{m\.id\}`\} className="listen-zeile"/);
    expect(q).toContain("Ausgezogen ({ehemalige})");
    expect(q).toMatch(/\{aktiv && m\.kaution_status !== "ja" &&/);
  });
});

describe("Zusatzspalten tragen kein eigenes display", () => {
  it("kein `listen-zeile-extra` mit inline `display` (schlüge die Handy-Regel)", async () => {
    const { readdirSync } = await import("node:fs");
    const tsx = (wurzel: string) =>
      (readdirSync(wurzel, { recursive: true }) as string[]).filter((f) => f.endsWith(".tsx")).map((f) => `${wurzel}/${f}`);
    const dateien = [...tsx("components"), ...tsx("app")];
    expect(dateien.length).toBeGreaterThan(100);
    const treffer = dateien.filter((d) => /listen-zeile-extra"[^>]*style=\{\{[^}]*display:/.test(lies(d)));
    expect(treffer).toEqual([]);
  });
});
