// Paket P4 der Gesamtprüfung (docs/AUDIT-2026-10-07-gesamt.md): weitere Dokumente.
// B38 Quittung, B39 Reparatur/§ 555c, B41 Wohnungsgeberbestätigung, B43 Zugang im Portal,
// C43 Monat in Erinnerung/Mahnung, C44 NK-Anschrift, C45 Käufer-Selbstauskunft, C46 Werbetexte.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fakeSupabase } from "./stubs/actionHarness";
import { pdfZeilen } from "./stubs/pdfText";
import {
  ARTEN,
  ART_BETRAG_RUECKFALL,
  ART_MIT_MONAT,
  DEFAULT_VORLAGEN,
  briefZusatzWerte,
  fehlendePlatzhalter,
  monatText,
} from "@/lib/dokumentVorlagen";
import { WOHNUNGSGEBER_PFLICHT, REPARATUR_HINWEIS, pruefeBrief } from "@/lib/briefPruefung";
import { quittungUrl, zahlungsBriefUrl } from "@/lib/mahnung";
import { zuletztGezahltAm } from "@/lib/mietkonto";
import { hinweisMailText, nichtAbgerufen, ZUGANG_HINWEIS, type ZustellungOffen } from "@/lib/zugang";
import { baueHeuteAufgaben } from "@/lib/heute";
import { mieterAnschrift } from "@/lib/format";
import { adressfeldZeilen } from "@/lib/pdf/adressfeld";
import { berechneNk, type NkTenant } from "@/lib/nk";
import { LEERE_SELBSTAUSKUNFT } from "@/lib/kauf/selbstauskunft";
import type { BriefFields } from "@/lib/pdf/erzeugen";

const lies = (p: string) => readFileSync(p, "utf8");

beforeEach(() => vi.resetModules());
afterEach(() => vi.doUnmock("@/lib/pdf/docPdf"));

const MIETER = {
  vorname: "Anna", nachname: "Weber", weitere_mieter: "Ben Weber", mieter_adresse: null, einheit: "EG links",
  prop_id: "obj-1", kaltmiete: 900, nk_vorauszahlung: 170, stellplatz_miete: 0, mietbeginn: "2022-01-01",
  letzte_erhoehung: null, iban: null,
};
const OBJEKT = { bezeichnung: "MFH Lindenstraße", adresse: "Lindenstr. 1, 23611 Bad Schwartau" };
const BASIS: BriefFields = { art: "mietquittung", datum: "2026-10-02", betrag: "", grund: "", ibanId: "", vName: "Max Muster", vAdr: "Hauptstr. 2, 23611 Bad Schwartau", text: "" };

type Erfasst = { absaetze: string[]; empfaengerAdresse?: string | null };
async function erzeuge(f: BriefFields, mieter: Record<string, unknown> = MIETER, objekt: unknown = OBJEKT) {
  vi.resetModules();
  const { client } = fakeSupabase({ antworten: { mieter, properties: objekt, vermieter_profil: null, miet_zeitraeume: [] } });
  const erfasst: Erfasst[] = [];
  vi.doMock("@/lib/pdf/docPdf", () => ({
    buildDocPdf: async (d: Erfasst) => {
      erfasst.push(d);
      return new Uint8Array([37, 80, 68, 70]);
    },
  }));
  const { erzeugeBriefPdf } = await import("@/lib/pdf/erzeugen");
  const r = await erzeugeBriefPdf(client as never, "nutzer-1", "m1", { ...f, text: f.text || DEFAULT_VORLAGEN[f.art as keyof typeof DEFAULT_VORLAGEN] });
  return { r, d: erfasst[0] };
}

describe("B38 — Mietquittung bestätigt nur, was eingegangen ist", () => {
  it("kein Rückfall auf die Warmmiete: ohne Betrag kein PDF", async () => {
    expect(ART_BETRAG_RUECKFALL).not.toContain("mietquittung");
    const { r, d } = await erzeuge({ ...BASIS, monat: "2026-10" });
    expect(r).toMatchObject({ abgelehnt: [expect.stringMatching(/\{\{betrag\}\}/)] });
    expect(d).toBeUndefined();
  });
  it("mit Betrag und Monat: „die Miete für Oktober 2026 in Höhe von 1.070,00 €“", async () => {
    const { d } = await erzeuge({ ...BASIS, betrag: "1070", monat: "2026-10" });
    expect(d.absaetze[0]).toMatch(/die Miete für Oktober 2026 in Höhe von 1\.070,00/);
    expect(d.absaetze[0]).toMatch(/Zahlung erhalten am 2\. Oktober 2026/);
  });
  it("ohne Monat kein PDF", async () => {
    const { r } = await erzeuge({ ...BASIS, betrag: "1070", monat: "" });
    expect(r).toMatchObject({ abgelehnt: [expect.stringMatching(/\{\{monat\}\}/)] });
  });
  it("Vorbelegung aus der Buchung: Betrag, Monat, Tag des letzten Eingangs", () => {
    const u = new URL("https://x" + quittungUrl({ mieterId: "m1", jahrMonat: "2026-10", betrag: 1070, datum: "2026-10-02" }));
    expect(u.pathname).toBe("/tenants/m1/dokument");
    expect(Object.fromEntries(u.searchParams)).toEqual({ art: "mietquittung", betrag: "1070", monat: "2026-10", datum: "2026-10-02" });
    const e = [
      { kategorie: "Miete", buchungsdatum: "2026-10-02", soll_monat: "2026-10", betrag: 500 },
      { kategorie: "Miete", buchungsdatum: "2026-10-09", soll_monat: "2026-10", betrag: 570 },
      { kategorie: "Miete", buchungsdatum: "2026-11-01", soll_monat: "2026-11", betrag: 1070 },
      { kategorie: "Nebenkosten", buchungsdatum: "2026-10-20", soll_monat: "2026-10", betrag: 50 },
    ];
    expect(zuletztGezahltAm(e, "2026-10")).toBe("2026-10-09");
    expect(zuletztGezahltAm(e, "2026-09")).toBeNull();
  });
  it("das Mietkonto bietet die Quittung nur bei gebuchtem Eingang an", () => {
    const mk = lies("components/MietkontoBestaetigung.tsx");
    expect(mk).toMatch(/\{z\.schonGebucht && \(z\.gezahlt \?\? 0\) > 0 && \(\s*<Link\s+href=\{quittungUrl\(\{ mieterId: z\.mieterId, jahrMonat: monat, betrag: z\.gezahlt!, datum: z\.gezahltAm \}\)\}/);
  });
});

describe("C43 — Erinnerung und Mahnung nennen den Monat", () => {
  it("Vorlagen mit {{monat}}, Pflicht über fehlendePlatzhalter", () => {
    for (const a of ART_MIT_MONAT) expect(DEFAULT_VORLAGEN[a]).toContain("{{monat}}");
    expect(fehlendePlatzhalter(DEFAULT_VORLAGEN.mahnung, { betrag: "1,00 €", monat: "", datum: "1. Oktober 2026" })).toEqual(["monat"]);
  });
  it("aus der offenen Miete: monat=2026-10 in der Adresse, im Brief „Oktober 2026“", () => {
    const u = new URL("https://x" + zahlungsBriefUrl({ mieterId: "m1", jahrMonat: "2026-10", betrag: 1070, heuteISO: "2026-10-12", art: "mahnung" }));
    expect(u.searchParams.get("monat")).toBe("2026-10");
    expect(monatText("2026-10")).toBe("Oktober 2026");
    expect(monatText("September und Oktober 2026")).toBe("September und Oktober 2026");
    expect(lies("app/(app)/tenants/[id]/dokument/page.tsx")).toMatch(/monat: searchParams\.monat/);
  });
  it("Mahnung im PDF: „die Miete für Oktober 2026“", async () => {
    const { d } = await erzeuge({ ...BASIS, art: "mahnung", betrag: "1070", monat: "2026-10", datum: "2026-10-20" });
    expect(d.absaetze[0]).toMatch(/^die Miete für Oktober 2026 in Höhe von 1\.070,00/);
  });
  it("eigene Vorlage ohne {{monat}} → Hinweis, keine Sperre", () => {
    const r = pruefeBrief({ art: "mahnung", text: "Bitte zahlen Sie {{betrag}}.", grund: "", vName: "Max", datum: "2026-10-20", zugang: "" });
    expect(r.fehler).toEqual([]);
    expect(r.warnungen.join(" ")).toMatch(/nennt den Mietmonat nicht/);
  });
});

describe("B41 — Wohnungsgeberbestätigung nach § 19 Abs. 3 BMG", () => {
  it("die Standardvorlage enthält jede Pflichtangabe", () => {
    for (const p of WOHNUNGSGEBER_PFLICHT) expect(DEFAULT_VORLAGEN.wohnungsgeber).toContain(`{{${p.key}}}`);
  });
  it("Zusatzwerte: Personen = alle Vertragspartner, Einzug = Mietbeginn, Eigentümer-Satz", () => {
    const basis = { namen: ["Anna Weber", "Ben Weber"], mietbeginn: "2022-01-01", vermieterAdresse: "Hauptstr. 2" };
    const w = briefZusatzWerte({}, basis);
    expect(w.personen).toBe("Anna Weber, Ben Weber");
    expect(w.einzug).toBe("1. Januar 2022");
    expect(w.eigentuemer).toBe("Der Wohnungsgeber ist Eigentümer der Wohnung.");
    expect(briefZusatzWerte({ personen: "Anna Weber\nLena Weber\n" }, basis).personen).toBe("Anna Weber, Lena Weber");
    expect(briefZusatzWerte({ personen: "  " }, basis).personen).toBe("");
    expect(briefZusatzWerte({ einzug: "2022-01-15" }, basis).einzug).toBe("15. Januar 2022");
    expect(briefZusatzWerte({ eigentuemerAnderer: "1" }, basis).eigentuemer).toBe("");
    expect(briefZusatzWerte({ eigentuemerAnderer: "1", eigentuemer: "Erika Muster" }, basis).eigentuemer).toMatch(/Erika Muster/);
  });
  it("im PDF: Wohnungsgeber mit Anschrift, Eigentümer, Einzug, alle Personen", async () => {
    const { d } = await erzeuge({ ...BASIS, art: "wohnungsgeber" });
    const t = d.absaetze.join(" | ");
    expect(t).toMatch(/Wohnungsgeber: Max Muster, Hauptstr\. 2, 23611 Bad Schwartau/);
    expect(t).toMatch(/Der Wohnungsgeber ist Eigentümer der Wohnung\./);
    expect(t).toMatch(/Einzugsdatum: 1\. Januar 2022/);
    expect(t).toMatch(/Einziehende Person\(en\): Anna Weber, Ben Weber/);
  });
  it("ohne Anschrift des Wohnungsgebers oder ohne Eigentümer-Namen kein PDF", async () => {
    expect((await erzeuge({ ...BASIS, art: "wohnungsgeber", vAdr: "" })).r).toMatchObject({ abgelehnt: [expect.stringMatching(/\{\{vermieteradresse\}\}/)] });
    expect((await erzeuge({ ...BASIS, art: "wohnungsgeber", eigentuemerAnderer: "1", eigentuemer: "" })).r).toMatchObject({ abgelehnt: [expect.stringMatching(/\{\{eigentuemer\}\}/)] });
    expect((await erzeuge({ ...BASIS, art: "wohnungsgeber", personen: "" })).r).toMatchObject({ abgelehnt: [expect.stringMatching(/\{\{personen\}\}/)] });
  });
  it("eigene Vorlage ohne Pflichtangaben → Fehler", () => {
    const r = pruefeBrief({ art: "wohnungsgeber", text: "Einzug von {{mieter}} in {{objekt}}.", grund: "", vName: "Max", datum: "", zugang: "" });
    expect(r.fehler.join(" ")).toMatch(/§ 19 Abs\. 3 BMG \(es fehlt: Name des Wohnungsgebers, Anschrift des Wohnungsgebers, Eigentümer, Einzugsdatum, meldepflichtige Personen\)/);
  });
});

describe("B39 — Reparatur-Ankündigung nur für Erhaltung", () => {
  it("Beschriftung, Hinweis im Generator, Werbetext", () => {
    expect(ARTEN.find((a) => a.v === "reparatur")?.label).toMatch(/§ 555a/);
    expect(REPARATUR_HINWEIS).toMatch(/§ 555c BGB/);
    expect(lies("components/DocGenerator.tsx")).toMatch(/\{art === "reparatur" && \(\s*<div role="note" className="brief-warnung"[^>]*>\{REPARATUR_HINWEIS\}/);
    const v = lies("app/(pub)/vorlagen/page.tsx");
    expect(v).not.toMatch(/Instandhaltungs- oder Modernisierungsarbeiten/);
    expect(v).toMatch(/§ 555c BGB — dafür ist sie nicht gedacht/);
  });
});

describe("C46 — /vorlagen verspricht nichts, was nicht gebaut ist", () => {
  it("kein „beweissicher“, kein Saldo im Anschreiben", () => {
    const v = lies("app/(pub)/vorlagen/page.tsx");
    expect(v).not.toMatch(/beweissicher/);
    expect(v).not.toMatch(/Nebenkostenabrechnung mit Saldo/);
  });
});

describe("B43 — Zugang im Mieterportal", () => {
  it("das Ergebnis der Hinweis-Mail wird genannt, wenn sie nicht hinausging", () => {
    expect(hinweisMailText([])).toBeNull();
    expect(hinweisMailText(["gesendet"])).toBeNull();
    expect(hinweisMailText(["demo"])).toBeNull();
    expect(hinweisMailText(["gesendet", "kein_versand"])).toMatch(/Mailversand ist nicht eingerichtet/);
    expect(hinweisMailText(["fehler"])).toMatch(/ließ sich nicht verschicken/);
    expect(hinweisMailText(["abbestellt"])).toMatch(/abbestellt/);
  });
  it("nicht abgerufen: nach sieben Tagen, je Dokument einmal, ein Abruf genügt", () => {
    const z = (o: Partial<ZustellungOffen>): ZustellungOffen => ({ notiz_id: "n1", mieter_id: "m1", titel: "NK 2025", zugestellt_am: "2026-10-01T10:00:00Z", gelesen_am: null, zurueckgezogen_am: null, ...o });
    expect(nichtAbgerufen([z({})], "2026-10-08")).toHaveLength(1);
    expect(nichtAbgerufen([z({})], "2026-10-07")).toHaveLength(0);
    expect(nichtAbgerufen([z({}), z({ zugestellt_am: "2026-10-01T10:05:00Z" })], "2026-10-09")).toHaveLength(1);
    expect(nichtAbgerufen([z({}), z({ gelesen_am: "2026-10-03T08:00:00Z" })], "2026-10-09")).toHaveLength(0);
    expect(nichtAbgerufen([z({ zurueckgezogen_am: "2026-10-02T00:00:00Z" })], "2026-10-09")).toHaveLength(0);
  });
  it("Dashboard-Aufgabe führt zur Mieterseite (dort steht der Abruf)", () => {
    const a = baueHeuteAufgaben(
      { offeneMieten: [], anliegen: [], meldungen: [], fristen: [], nichtAbgerufen: [{ mieterId: "m1", mieter: "Anna Weber", titel: "Nebenkostenabrechnung 2025", zugestellt: "2026-10-01T10:00:00Z" }] },
      "2026-10-09",
    );
    expect(a).toEqual([expect.objectContaining({ label: "Nicht abgerufen: „Nebenkostenabrechnung 2025“", href: "/tenants/m1", sub: expect.stringMatching(/seit 01\.10\.2026 — Zugang nicht belegt/) })]);
    expect(lies("app/(app)/page.tsx")).toMatch(/nichtAbgerufen: nichtAbgerufen\(\(offeneZustellRows/);
  });
  it("jeder Zustellweg zeigt den Zugangshinweis und meldet „bereitgestellt“ statt „zugestellt ✓“", () => {
    for (const f of ["components/BriefVersand.tsx", "components/NkSpeichernButton.tsx", "components/DokumentZustellung.tsx"]) {
      const s = lies(f);
      expect(s).toMatch(/\{ZUGANG_HINWEIS\}/);
      expect(s).toMatch(/Im Mieterportal bereitgestellt für/);
      expect(s).not.toMatch(/zugestellt an \$\{[^}]*\} ✓|`Zugestellt — sichtbar/);
    }
    expect(ZUGANG_HINWEIS).toMatch(/erst, wenn der Mieter es im Portal abruft/);
  });
});

describe("C44 — Anschrift im Brief und in der NK-Abrechnung", () => {
  it("EINE Regel: eigene Anschrift → Einheit + Objektadresse → Objektname → nichts", () => {
    expect(mieterAnschrift({ mieter_adresse: "Weg 3, 12345 Ort", einheit: "EG" }, OBJEKT)).toBe("Weg 3, 12345 Ort");
    expect(mieterAnschrift({ mieter_adresse: null, einheit: "EG links" }, OBJEKT)).toBe("EG links, Lindenstr. 1, 23611 Bad Schwartau");
    expect(mieterAnschrift({ mieter_adresse: null, einheit: "EG links" }, { bezeichnung: "Haus", adresse: null })).toBe("Haus");
    expect(mieterAnschrift({ mieter_adresse: " ", einheit: null }, null)).toBeNull();
  });
  it("kein interner Hinweis im Anschriftfeld", () => {
    expect(adressfeldZeilen("Anna Weber", null)).toEqual(["Anna Weber"]);
    expect(lies("lib/pdf/adressfeld.ts")).not.toMatch(/"\(Anschrift fehlt|"\(Empfänger unvollständig/);
  });
  it("NK: Objektadresse statt Lücke; ohne jede Anschrift eine Warnung an den Vermieter", () => {
    const t = { id: "m1", vorname: "Anna", nachname: "Weber", mieter_adresse: null, einheit: "EG links", flaeche: 60, mietbeginn: "2022-01-01", mietende: null, nk_vorauszahlung: 100 } as unknown as NkTenant;
    const mit = berechneNk(2025, t, OBJEKT, [], null, { gebucht: 1200, gebuchteMonate: 12 });
    expect(mit.mieterAdresse).toBe("EG links, Lindenstr. 1, 23611 Bad Schwartau");
    expect(mit.warnungen.join(" ")).not.toMatch(/Keine Anschrift/);
    const ohne = berechneNk(2025, { ...t, einheit: null } as NkTenant, null, [], null, { gebucht: 1200, gebuchteMonate: 12 });
    expect(ohne.mieterAdresse).toBeNull();
    expect(ohne.warnungen.join(" ")).toMatch(/Keine Anschrift für den Mieter/);
  });
  it("Brief: das PDF bekommt dieselbe Anschrift", async () => {
    const { d } = await erzeuge({ ...BASIS, betrag: "1070", monat: "2026-10" });
    expect(d.empfaengerAdresse).toBe("EG links, Lindenstr. 1, 23611 Bad Schwartau");
  });
});

describe("C45 — Käufer-Selbstauskunft ohne Personenstand, außer auf Wahl", () => {
  const daten = { ...LEERE_SELBSTAUSKUNFT, familienstand: "verheiratet", kinder: 2, staatsangehoerigkeit: "deutsch", anzahlPersonen: 4 };
  it("Standard: kein Familienstand, keine Kinder, keine Staatsangehörigkeit — Haushaltsgröße bleibt", async () => {
    const { buildKaeuferSelbstauskunftPdf } = await import("@/lib/pdf/kaeuferPdf");
    const z = pdfZeilen(await buildKaeuferSelbstauskunftPdf(daten as never, { name: "Max Muster" }));
    expect(z).not.toContain("Familienstand");
    expect(z).not.toContain("Staatsangehörigkeit");
    expect(z).not.toContain("Kinder");
    expect(z).toContain("Haushaltsgröße");
  });
  it("auf Wahl: alle drei Angaben", async () => {
    const { buildKaeuferSelbstauskunftPdf } = await import("@/lib/pdf/kaeuferPdf");
    const z = pdfZeilen(await buildKaeuferSelbstauskunftPdf(daten as never, { name: "Max Muster" }, { personenstand: true }));
    expect(z).toEqual(expect.arrayContaining(["Familienstand", "verheiratet", "Kinder", "Staatsangehörigkeit", "deutsch"]));
  });
  it("der Makler-Ordner gibt die Wahl nur bei ausdrücklichem Haken weiter", () => {
    expect(lies("lib/actions/makler.ts")).toMatch(/\{ personenstand: opts\.personenstand === true \}/);
    expect(lies("components/MaklerOrdner.tsx")).toMatch(/useState\(false\)[\s\S]*generiereMaklerDokument\(item\.key, \{ personenstand \}\)/);
  });
});
