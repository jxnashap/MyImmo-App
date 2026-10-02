// Audit 01.10.2026, Paket 2 — die „Eine-Zeile-Fixes" mit grosser Wirkung
// (docs/AUDIT-2026-10-01.md). Jeder Test hier ist gegen eine Rueckbau-Mutation
// rot gewesen; Struktur-Tests pruefen den Quelltext, Verhaltens-Tests die Funktion.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { istOeffentlicheSeite } from "@/lib/oeffentlich";
import { flashUrl } from "@/lib/flash";
import sitemap from "@/app/sitemap";
import { FUNKTIONSSEITEN } from "@/lib/funktionen";
import { RATGEBER } from "@/lib/ratgeber";

const lies = (p: string) => readFileSync(p, "utf8");

describe("A12: og.png und Logo sind oeffentlich (GET, nicht nur HEAD)", () => {
  it("beide Wurzeldateien passieren das Login-Gate", () => {
    expect(istOeffentlicheSeite("/og.png")).toBe(true);
    expect(istOeffentlicheSeite("/myimmo_logo_2048.png")).toBe(true);
  });
  it("aber nicht jede Wurzeldatei — die Weissliste bleibt eine Weissliste", () => {
    expect(istOeffentlicheSeite("/irgendwas.png")).toBe(false);
    expect(istOeffentlicheSeite("/og.png.bak")).toBe(false);
  });
});

describe("B22: der Flash-Weg kennt seinen Typ", () => {
  it("ohne Angabe gruen, mit error ein flashTyp-Parameter", () => {
    expect(flashUrl("/termine", "ok")).toBe("/termine?flash=ok");
    expect(flashUrl("/termine?a=1", "nein", "error")).toBe("/termine?a=1&flash=nein&flashTyp=error");
  });
  it("alle Fehler-Flashes in den Actions geben error mit", () => {
    for (const f of ["lib/actions/termine.ts", "lib/actions/properties.ts"]) {
      const src = lies(f);
      for (const m of src.matchAll(/flashUrl\([^)]*(nichts angelegt|nichts gespeichert|Limit erreicht)[^)]*\)/g)) {
        expect(m[0], `${f}: ${m[0]}`).toContain('"error"');
      }
    }
    const toastSrc = lies("components/FlashToast.tsx");
    expect(toastSrc).toContain('sp.get("flashTyp")');
    // Der Typ muss auch im toast()-Aufruf ankommen, nicht nur gelesen werden.
    expect(toastSrc).toMatch(/toast\(flash, [^)]*typ === "error" \? "error"/);
    expect(toastSrc).toContain('params.delete("flashTyp")');
  });
});

describe("C12: Sitemap ohne noindex-Seiten und ohne springendes lastmod", () => {
  const eintraege = sitemap();
  it("listet /agb und /datenschutz nicht (beide noindex), /impressum schon", () => {
    const urls = eintraege.map((e) => e.url);
    expect(urls).not.toContain("https://www.myimmoapp.de/agb");
    expect(urls).not.toContain("https://www.myimmoapp.de/datenschutz");
    expect(urls).toContain("https://www.myimmoapp.de/impressum");
  });
  it("statische Seiten tragen kein lastModified, Artikel ihr echtes Datum", () => {
    const start = eintraege.find((e) => e.url === "https://www.myimmoapp.de/");
    expect(start?.lastModified).toBeUndefined();
    const artikel = eintraege.filter((e) => e.url.includes("/ratgeber/"));
    expect(artikel.length).toBe(RATGEBER.length);
    for (const a of artikel) expect(a.lastModified).toBeTruthy();
    expect(eintraege.filter((e) => e.url.includes("/funktionen/")).length).toBe(FUNKTIONSSEITEN.length);
  });
});

describe("B12/B13/B14/B11: oeffentliche Texte ohne unbelegte Zahlen und falsche Zitate", () => {
  const texte = JSON.stringify(FUNKTIONSSEITEN) + JSON.stringify(RATGEBER);
  it("keine 80-Prozent-Behauptung ohne Quelle", () => {
    expect(texte).not.toMatch(/80 ?(%|Prozent) der (Nebenkosten)?[Aa]brechnungen/);
  });
  it("HeizkostenV: 70 % stehen mit Satz 1 und den drei Bedingungen da, nicht als „mindestens 70“ nach Satz 2", () => {
    expect(texte).not.toContain("mindestens 70 Prozent");
    expect(texte).toContain("§ 7 Abs. 1 Satz 1 HeizkostenV");
    expect(texte).toContain("Wärmeschutzverordnung von 1994");
  });
  it("Mietkonto-Seite verspricht keine NK-Verbuchung ins Mietkonto und keine Kautionsraten", () => {
    expect(texte).not.toContain("laufen ins selbe Konto");
    expect(texte).not.toContain("Betrag, Raten und Anlageort");
  });
  it("/vorlagen nennt sich nicht mehr „rechtssicher“", () => {
    expect(lies("app/(pub)/vorlagen/page.tsx").toLowerCase()).not.toContain("rechtssicher");
  });
  it("Startseite verspricht nichts Kuendbares, solange es kein Abo gibt", () => {
    expect(lies("components/LandingPage.tsx")).not.toContain("jederzeit kündbar");
  });
});

describe("A6/B8/B10: Rechtstexte", () => {
  const agb = lies("app/(pub)/agb/page.tsx");
  it("kein Platzhalter in eckigen Klammern, kein App-Store, kein OS-Plattform-Link mehr", () => {
    expect(agb).not.toMatch(/\[bzw\./);
    expect(agb).not.toContain("§ 19 UStG");
    expect(agb).not.toContain("Apple App Store");
    expect(agb).not.toContain("consumers/odr");
  });
  it("Stand-Daten entsprechen der letzten inhaltlichen Aenderung", () => {
    expect(agb).toContain("Stand: 1. Oktober 2026");
    // 02.10.2026: Ziffer 3 d (Log-Aufbewahrung beim Hoster: ein Tag) ergänzt.
    expect(lies("app/(pub)/datenschutz/page.tsx")).toContain("Stand: 2. Oktober 2026");
    expect(lies("app/(pub)/avv/page.tsx")).toContain("Stand: 9. September 2026");
  });
});

describe("B19/B20/B21/B23/B32/C29: App-Oberflaeche", () => {
  it("Jahresbericht-PDF: Fussnote haengt an zinsGeschaetzt, Route reicht es durch", () => {
    const pdf = lies("lib/pdf/berichtPdf.ts");
    expect(pdf).not.toContain("Zins/Tilgung sind aus aktueller Restschuld × Zinssatz geschätzt (Näherung");
    expect(pdf).toContain("r.zinsGeschaetzt");
    expect(lies("app/api/berichte/jahresbericht/route.ts")).toContain("zinsGeschaetzt: z.zinsGeschaetzt");
  });
  it("Objektseite: Rendite rechnet auf den Kaufpreis, Beschriftung folgt der Basis", () => {
    const src = lies("app/(app)/properties/[id]/page.tsx");
    expect(src).toContain("const renditeBasis = p.kaufpreis || wert;");
    expect(src).not.toMatch(/const rendite = miete && wert \?/);
    expect(src).toContain('p.kaufpreis ? "Jahreskaltmiete / Kaufpreis"');
  });
  it("Einstellungen lesen ?tab= und pruefen gegen die Tab-Liste", () => {
    const src = lies("components/SettingsView.tsx");
    expect(src).toContain('q.get("tab")');
    expect(src).toContain("TABS.some((t) => t.key === gewuenscht)");
  });
  it("Mieterseite zeigt Ansehen/Herunterladen nur mit Datei", () => {
    const src = lies("app/(app)/tenants/[id]/page.tsx");
    const block = src.slice(src.indexOf("dokumente.map("), src.indexOf("dokumente.map(") + 1200);
    expect(block).toMatch(/\{n\.datei_name \? \(/);
  });
  it("Startcheckliste verspricht keine Kontoanbindung (Open Banking ist entfernt)", () => {
    expect(lies("app/(app)/page.tsx")).not.toContain("Kontoanbindung");
  });
  it("Jahressperrfrist heisst nicht Kappungsgrenze", () => {
    expect(lies("lib/fristen.ts")).not.toContain("(Kappungsgrenze)");
    expect(lies("lib/fristen.ts")).toContain("§ 558 Abs. 1 BGB (Jahressperrfrist)");
  });
  it("/api/export (JSON-Altweg mit entschluesselten IBANs) existiert nicht mehr", () => {
    expect(() => lies("app/api/export/route.ts")).toThrow();
  });
});
