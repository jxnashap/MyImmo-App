import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { entwurfAus, leererEntwurf, type Entwurf } from "@/lib/sanierung/eingabe";
import { AUTO_WEITER, autoWeiter, offeneSeiten } from "@/lib/sanierung/guide";
import { entwurfFuerKaufpruefung, kaufpruefungStart } from "@/lib/sanierung/uebergabe";
import { vorlageAusEntwurf } from "@/lib/sanierung/projekte";
import type { Kalkulation } from "@/lib/types";

// Umbau BuyImmo (06.10.2026): (1) Guide wie eine Lern-App — nach einer Auswahl, die die Seite fertig
// macht, geht es von selbst weiter; (2) Besichtigung gehört zu einem Kandidaten aus dem Vergleich und
// gibt ihre Summe an genau ihn zurück; (3) der Vergleich steht auf der Seite, nicht in einem Fenster.

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

describe("Lern-App: wann der Guide von selbst weitergeht", () => {
  const leer = leererEntwurf("x");
  const mit = (teil: Partial<Entwurf["projekt"]>): Entwurf => ({ ...leer, projekt: { ...leer.projekt, ...teil } });

  it("die letzte fehlende Auswahl macht die Seite fertig → weiter", () => {
    expect(autoWeiter("ziel", leer, mit({ nutzung: "vermieten" }))).toBe(true);
    const zweiDa = mit({ wer: { maler: "selbst", boden: "handwerker", fliesen: "" } });
    expect(autoWeiter("arbeit", zweiDa, mit({ wer: { maler: "selbst", boden: "handwerker", fliesen: "selbst" } }))).toBe(true);
  });

  it("noch etwas offen → bleiben", () => {
    expect(autoWeiter("arbeit", leer, mit({ wer: { maler: "selbst", boden: "", fliesen: "" } }))).toBe(false);
    // Eckdaten: Eigentumswohnung gewählt, Wohnfläche fehlt noch.
    expect(autoWeiter("eckdaten", leer, mit({ etw: "ja", baujahrUnbekannt: true }))).toBe(false);
  });

  it("eine schon fertige Seite, auf der man eine Antwort ändert → bleiben (man korrigiert)", () => {
    const fertig = mit({ nutzung: "vermieten" });
    expect(autoWeiter("ziel", fertig, mit({ nutzung: "eigennutzen" }))).toBe(false);
  });

  it("nie auf Seiten, die nach einer Wahl etwas aufklappen (Maßnahmen, Ist-Zustand, Technik)", () => {
    expect(AUTO_WEITER).toEqual(["eckdaten", "ziel", "arbeit", "abschluss"]);
    for (const s of ["massnahmen", "ist", "zustand", "raeume", "masse", "projekt"] as const) {
      expect(autoWeiter(s, leer, leer), s).toBe(false);
    }
    // Auch wenn die Seite gerade fertig wird: Der Projektname ist ein Textfeld — dort entscheidet Enter.
    const ohneName = mit({ name: "" });
    expect(autoWeiter("projekt", ohneName, mit({ name: "Wohnung Leipzig" }))).toBe(false);
  });

  it("der Guide hört nur auf Auswahlfelder; Enter in einem Textfeld ist „Weiter“", () => {
    const s = readFileSync("components/SanierungsRechner.tsx", "utf8");
    expect(s).toContain('t instanceof HTMLInputElement && t.type === "radio"');
    expect(s).toContain("onSubmit={(ev) => { ev.preventDefault(); weiter(); }}");
    expect(s).toMatch(/<button type="submit" className="btn btn-gold btn-sm">/);
    // Jeder Knopf auf den Guide-Seiten hat einen Typ — sonst wäre er im Formular „Weiter“.
    const seiten = readFileSync("components/sanierung/GuideSeiten.tsx", "utf8");
    const knoepfe = seiten.match(/<button\b[^>]*>/g) ?? [];
    expect(knoepfe.length).toBeGreaterThan(5);
    expect(knoepfe.filter((k) => !/type="button"/.test(k))).toEqual([]);
  });
});

describe("Besichtigung für einen Kandidaten", () => {
  const k = {
    id: ID,
    name: "Karl-Liebknecht-Str. 42, Leipzig",
    data: { adresse: "Karl-Liebknecht-Str. 42, 04275 Leipzig", flaeche: "72", baujahr: "1911", nutzung: "vermietung" },
  };

  it("übernimmt Name, Adresse, Fläche, Baujahr und Ziel — Unbekanntes bleibt leer", () => {
    expect(kaufpruefungStart(k)).toEqual({ id: ID, name: k.name, adresse: k.data.adresse, wohnflaeche: "72", baujahr: "1911", nutzung: "vermieten" });
    expect(kaufpruefungStart({ id: ID, name: "X", data: { baujahr: "neu", nutzung: "eigennutzung" } })).toMatchObject({ baujahr: "", nutzung: "eigennutzen", wohnflaeche: "" });
    expect(kaufpruefungStart({ id: ID, name: "X", data: null }).nutzung).toBe("");
  });

  it("der neue Entwurf gehört zum Kandidaten; der Guide fragt nur noch, was fehlt", () => {
    const e = entwurfFuerKaufpruefung(kaufpruefungStart(k), "neu");
    expect(e.kaufObjekt).toBe(ID);
    expect(e.raeume).toEqual([]);
    const offen = offeneSeiten(e).map((o) => o.seite);
    expect(offen).not.toContain("projekt");
    expect(offen).not.toContain("ziel");
    expect(offen).toContain("eckdaten"); // Eigentumswohnung ja/nein weiß der Rechner nicht
  });

  it("der Bezug übersteht Speichern und Laden — fremde Werte nicht", () => {
    const e = entwurfFuerKaufpruefung(kaufpruefungStart(k), "neu");
    expect(entwurfAus(JSON.parse(JSON.stringify(e)))!.kaufObjekt).toBe(ID);
    expect(entwurfAus({ ...e, kaufObjekt: "x' or 1=1" })!.kaufObjekt).toBe("");
    expect(entwurfAus({ ...leererEntwurf("a"), kaufObjekt: undefined })!.kaufObjekt).toBe("");
  });

  it("eine Vorlage nimmt den Kandidaten nicht mit (er gehört zur Wohnung, nicht zur Entscheidung)", () => {
    const e = entwurfFuerKaufpruefung(kaufpruefungStart(k), "neu");
    expect(JSON.stringify(vorlageAusEntwurf(e))).not.toContain(ID);
  });

  it("die Seite lädt nur die EIGENE Kaufprüfung und nur bei einer echten Kennung", () => {
    const s = readFileSync("app/(app)/sanierung/page.tsx", "utf8");
    expect(s).toContain('.eq("id", objekt).eq("user_id", user.id)');
    expect(s).toMatch(/UUID\.test\(objekt\)/);
  });
});

// ── Vergleich auf der Seite ────────────────────────────────────────────────
vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _p, ...rest }: { href: string; children?: ReactNode; prefetch?: boolean }) =>
    createElement("a", { href, ...rest }, children),
}));

const kalk = (id: string, name: string, s: Record<string, number>): Kalkulation =>
  ({ id, name, data: {}, summary: s, created_at: "2026-10-06" }) as unknown as Kalkulation;

describe("Objekte vergleichen", () => {
  afterEach(() => vi.resetModules());

  it("Bestwerte grün, Krone für die meisten Bestwerte, je Objekt „Besichtigen“ mit Kennung", async () => {
    const { default: ObjektVergleich, bestWert } = await import("@/components/kauf/ObjektVergleich");
    const liste = [
      kalk("a", "Leipzig", { kp: 200_000, gesamtInvest: 214_000, preisM2: 2_800, brutto: 4.8, nettomiet: 3.6, faktor: 20.8, marktwert: 210_000 }),
      kalk("b", "Halle", { kp: 150_000, gesamtInvest: 180_000, sanierung: 19_500, preisM2: 2_100, brutto: 5.6, nettomiet: 4.0, faktor: 17.9, marktwert: 140_000 }),
    ];
    expect(bestWert(liste, "kp", "low")).toBe(150_000);
    expect(bestWert(liste, "brutto", "high")).toBe(5.6);
    expect(bestWert(liste, "gesamtInvest", "none")).toBeNull(); // Endsumme: nur Anzeige
    expect(bestWert([liste[0]], "kp", "low")).toBeNull();
    const html = renderToStaticMarkup(
      createElement(ObjektVergleich, {
        liste, auswahl: ["a", "b"], setAuswahl: () => {}, bearbeiteId: null, gewaehltId: "a",
        onBearbeiten: () => {}, onLoeschen: () => {}, onWaehlen: () => {},
      }),
    );
    expect(html).toContain('href="/sanierung?objekt=a"');
    expect(html).toContain('href="/sanierung?objekt=b"');
    expect(html).toContain("Gesamtinvestition");
    expect(html).toContain("für die Finanzierung gewählt");
    // Halle hat 5 von 6 gezählten Bestwerten (Kaufpreis, Preis/m², Brutto, Netto, Faktor) → Krone.
    expect(html).toMatch(/aria-label="meiste Bestwerte"[\s\S]*?Halle/);
    expect(html).toContain("5 Bestwerte");
  });

  it("der Vergleich ist kein Fenster mehr, und der Kauf-Assistent bettet den Rechner nicht mehr ein", () => {
    const rechner = readFileSync("components/kauf/ObjektRechner.tsx", "utf8");
    expect(rechner).not.toContain("createPortal");
    expect(rechner).toContain("<ObjektVergleich");
    const assistent = readFileSync("components/KaufAssistent.tsx", "utf8");
    expect(assistent).not.toContain("<ObjektRechner");
    expect(assistent).toContain('href="/vergleich"');
  });

  it("alte Links /kauf?sanierung=… landen im Vergleich", () => {
    const s = readFileSync("app/(app)/kauf/page.tsx", "utf8");
    expect(s).toContain("if (sanierungStart != null) redirect(kaufLinkMitSanierung(sanierungStart));");
  });
});
