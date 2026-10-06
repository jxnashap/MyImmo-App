import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { pruefeMachbarkeit, type MachbarkeitInput } from "@/lib/kauf/machbarkeit";
import { baueKreditObjekt } from "@/lib/kauf/kreditantrag";
import { objektZeilen } from "@/lib/pdf/kreditantragPdf";
import { auswahlAus } from "@/lib/kauf/auswahl";
import { sanierungBeimLaden } from "@/lib/sanierung/uebergabe";
import { massDe, zuEingabe, leererEntwurf } from "@/lib/sanierung/eingabe";
import { auswerten } from "@/lib/sanierung/auswertung";
import { berechneSanierung } from "@/lib/sanierung/rechner";
import { KATALOG } from "@/lib/sanierung/katalog";
import { bestandLage } from "@/lib/aufbau";
import { fahrplan, type FahrplanDaten } from "@/lib/fahrplan";

// Review zu PR #418 (05.10.2026): Jeder Test hier hält einen Befund fest, der vor dem Merge gefunden
// wurde. Die wichtigsten: Seit die Sanierung in der Gesamtinvestition steckt, galt sie in
// Finanzierung, Ampel und Kreditantrag als Nebenkosten; Raummaße „4.125“ wurden zu 4.125 m.

describe("Sanierung ist keine Nebenkosten", () => {
  // Kaufpreis 250.000, echte Nebenkosten 26.425, Sanierung 40.000 → Gesamt 316.425; Darlehen
  // 250.000 → Lücke 66.425, Eigenkapital 50.000 deckt sie nicht, die echten Nebenkosten aber schon.
  const basis: MachbarkeitInput = {
    darlehen: 250_000, rate: 0, kaufpreis: 250_000, gesamtInvest: 316_425, kaltmieteNeu: 0,
    haushaltsNetto: 0, mieteinnahmenBestehend: 0, ausgabenFix: 0, anzahlPersonen: 1, eigenkapital: 50_000,
  };
  const ek = (i: MachbarkeitInput) => pruefeMachbarkeit(i).checks.find((c) => c.key === "ek")!.ampel;

  it("Ampel: 50.000 € Eigenkapital decken die echten Nebenkosten → gelb, nicht rot", () => {
    expect(ek({ ...basis, sanierung: 40_000 })).toBe("gelb");
    // Ohne die Angabe (ältere Auswahl) bleibt das alte Verhalten — und genau das war falsch.
    expect(ek(basis)).toBe("rot");
  });

  it("Auswahl trägt die Sanierung aus der gespeicherten Kaufprüfung weiter; ältere ohne → 0", () => {
    const k = { id: "k1", name: "ETW", data: { adresse: "Hauptstr. 1" }, summary: { kp: 250_000, gesamtInvest: 316_425, sanierung: 40_000, kaltmiete: 900, nutzung: 1 } };
    expect(auswahlAus(k, "2026-10-05")).toMatchObject({ kp: 250_000, gesamtInvest: 316_425, sanierung: 40_000, nutzung: "vermieten", adresse: "Hauptstr. 1" });
    expect(auswahlAus({ ...k, summary: { kp: 1, gesamtInvest: 2 } }, "2026-10-05").sanierung).toBe(0);
  });

  it("Kreditantrag: die Bank sieht, dass die Gesamtsumme die Sanierung enthält", () => {
    const o = baueKreditObjekt({ kp: 250_000, gesamtInvest: 316_425, sanierung: 40_000, name: "ETW" }, 50_000, 0)!;
    expect(o.sanierung).toBe(40_000);
    const z = Object.fromEntries(objektZeilen(o));
    expect(z["Gesamtinvestition (inkl. NK und Sanierung)"]).toBeDefined();
    expect(z["davon Sanierung / Renovierung"]).toMatch(/40\.000/);
    expect(z["Gesamtinvestition (inkl. NK)"]).toBeUndefined();
    // Ohne Sanierung: das alte Etikett, keine leere Zeile.
    const ohne = Object.fromEntries(objektZeilen(baueKreditObjekt({ kp: 250_000, gesamtInvest: 276_425 }, 0, 0)!));
    expect(ohne["Gesamtinvestition (inkl. NK)"]).toBeDefined();
    expect(ohne["davon Sanierung / Renovierung"]).toBeUndefined();
  });
});

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _p, ...rest }: { href: string; children?: ReactNode; prefetch?: boolean }) =>
    createElement("a", { href, ...rest }, children),
}));

describe("Finanzierungsvorschläge", () => {
  it("nennen die echten Nebenkosten und warnen nicht, wenn das Eigenkapital sie deckt", async () => {
    const { default: F } = await import("@/components/kauf/FinanzierungsVorschlaege");
    const html = renderToStaticMarkup(createElement(F, { gesamtInvest: 316_425, kaufpreis: 250_000, sanierung: 40_000, ekVorhanden: 50_000 }));
    expect(html).toMatch(/davon (<!-- -->)?€ 26\.425(<!-- -->)? Nebenkosten/);
    expect(html).toMatch(/€ 40\.000(<!-- -->)? Sanierung/);
    expect(html).not.toContain("deckt nicht einmal die Kaufnebenkosten");
    // Gegenprobe: ohne Sanierungsangabe hält er 66.425 € für Nebenkosten und warnt.
    const alt = renderToStaticMarkup(createElement(F, { gesamtInvest: 316_425, kaufpreis: 250_000, ekVorhanden: 50_000 }));
    expect(alt).toContain("deckt nicht einmal die Kaufnebenkosten");
  });
});

describe("Übergabe aus dem Sanierungsrechner", () => {
  it("„Bearbeiten“ einer gespeicherten Kaufprüfung verliert den übergebenen Betrag nicht", () => {
    expect(sanierungBeimLaden("", 30_000)).toEqual({ wert: "30000", verbraucht: true });
    expect(sanierungBeimLaden("12000", 30_000)).toEqual({ wert: "30000", verbraucht: true });
    // Ohne offene Übergabe gilt der gespeicherte Wert.
    expect(sanierungBeimLaden("12000", null)).toEqual({ wert: "12000", verbraucht: false });
  });

  it("der Link zum Rechner öffnet einen neuen Tab — die Maske ist nicht gespeichert", () => {
    const s = readFileSync("components/kauf/ObjektRechner.tsx", "utf8");
    expect(s).toMatch(/href="\/sanierung" target="_blank"/);
  });

  it("Eigenleistung zählt zur Summe, aber nicht in die Kaufprüfung", () => {
    const e = { ...leererEntwurf("x"), lohn: [
      { id: "a", bezeichnung: "Ich", stunden: "60", satz: "40", eigenleistung: true },
      { id: "b", bezeichnung: "Fliesenleger", stunden: "10", satz: "50", eigenleistung: false },
    ] };
    const r = berechneSanierung(zuEingabe(e), KATALOG);
    expect(r.lohn).toBe(2_900);
    expect(r.lohnEigen).toBe(2_400);
    const s = readFileSync("components/SanierungsRechner.tsx", "utf8");
    // Seit dem Guide (Stufe B): `gesamt` der Auswertung enthält die Eigenleistung gar nicht erst
    // (tests/sanierungGuide.test.ts prüft das an Zahlen) — übergeben wird die obere Spanne davon.
    expect(s).toContain("const fuerKauf = Math.max(0, a.gesamt.max);");
    expect(s).toContain("kaufLinkMitSanierung(fuerKauf, entwurf.kaufObjekt)");
    const g = auswerten({ ...leererEntwurf("z"), lohn: e.lohn, projekt: { ...leererEntwurf("z").projekt, puffer: "0" } }, KATALOG);
    expect(g.eigenleistung).toBe(2_400);
    expect(g.gesamt.max).toBe(500);
    // Der Startentwurf trägt die eigene Arbeit als Eigenleistung.
    expect(leererEntwurf("y").lohn[0]).toMatchObject({ bezeichnung: "Eigene Arbeit", eigenleistung: true });
  });
});

describe("Eingaben im Sanierungsrechner", () => {
  it("Raummaße: Punkt und Komma sind Dezimalstellen, nie Tausender", () => {
    expect(massDe("4.125")).toBe(4.125);
    expect(massDe("4,125")).toBe(4.125);
    expect(massDe("2,5")).toBe(2.5);
    expect(massDe(" 3 ")).toBe(3);
    for (const unsinn of ["", "1.234.5", "4,1,2", "abc", "-3", "0x10"]) expect(massDe(unsinn), unsinn).toBe(0);
    const e = { ...leererEntwurf("x"), raeume: [{ id: "r", name: "Bad", laenge: "4.125", breite: "2", hoehe: "2.505", oeffnungen: "", fliesenhoehe: "", massnahmen: [] }] };
    expect(zuEingabe(e).raeume[0]).toMatchObject({ laenge: 4.125, hoehe: 2.505 });
  });

  it("unlesbarer eigener Preis („54,-“) → Katalogpreis, kein Gratis-Material; „0“ bleibt ein Preis", () => {
    const e = { ...leererEntwurf("x"), preise: { wandfarbe: "54,-", spachtel: "0", tiefengrund: "19,99" } };
    expect(zuEingabe(e).preise).toEqual({ spachtel: 0, tiefengrund: 19.99 });
  });
});

describe("Kommandozentrale und Fahrplan", () => {
  it("Restschuld in %: nicht, wenn ein Objekt keinen Wert hat (seine Schulden zählen, sein Wert nicht)", () => {
    const k = (prop_id: string, restschuld: number) => ({ prop_id, betrag: restschuld, restschuld, monatsrate: 0, zinssatz: 0, grundschuld: null });
    const ohne = bestandLage([{ id: "a", bezeichnung: "A", wert: 300_000, kaufpreis: null }, { id: "b", bezeichnung: "B", wert: null, kaufpreis: null }], [k("a", 100_000), k("b", 200_000)]);
    expect(ohne.restschuldProzent).toBeNull();
    const voll = bestandLage([{ id: "a", bezeichnung: "A", wert: 300_000, kaufpreis: null }], [k("a", 100_000)]);
    expect(voll.restschuldProzent).toBe(33.3);
  });

  it("Notar-Schritt: nur eine beglaubigte Grundbuch-/Generalvollmacht gilt als passend", () => {
    const d: FahrplanDaten = { hatSelbstauskunft: false, makler: [], kaufpruefungen: 0, vertreterGueltig: true, objekte: 0 };
    const notar = (x: FahrplanDaten) => fahrplan(x).find((s) => s.id === "notar")!.status?.text ?? "";
    expect(notar(d)).toMatch(/öffentlich beglaubigt sein/);
    expect(notar({ ...d, vertreterGrundbuch: true })).toMatch(/beglaubigter Grundbuch/);
    expect(notar({ ...d, vertreterGueltig: false })).toBe("");
  });

  it("Grammatik und Verschnitt-Offenlegung", () => {
    expect(readFileSync("app/(app)/fahrplan/page.tsx", "utf8")).toContain("kennst nur du");
    expect(readFileSync("components/sanierung/GuideErgebnis.tsx", "utf8")).toContain("Fliesen {prozent(VERSCHNITT_FLIESE)}");
  });

  it("die Wortmarke bleibt die Überschrift der App-Seiten (h1 um den Umschalter)", async () => {
    vi.doMock("next/navigation", () => ({ usePathname: () => "/aufbau" }));
    const { default: BereichWechsel } = await import("@/components/BereichWechsel");
    const html = renderToStaticMarkup(createElement(BereichWechsel, { bereich: "aufbau" } as never));
    expect(html).toMatch(/<h1[^>]*class="bereich-titel"[^>]*><button[^>]*class="bereich-knopf"/);
  });
});
