import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { mieteUeberfaellig, zahlungsBriefUrl, briefMailLink, briefMailText } from "@/lib/mahnung";
import { baueHeuteAufgaben, buendleGleicheAufgaben } from "@/lib/heute";

// Mahnung / Zahlungserinnerung aus einer offenen Miete (05.10.2026).
// Oktober 2026: 1. = Donnerstag, 2. = Freitag, 5. = Montag → dritter Werktag = 05.10.

describe("Fälligkeit", () => {
  it("erst NACH dem dritten Werktag überfällig — nicht am 5. des Monats pauschal", () => {
    expect(mieteUeberfaellig("2026-10", "2026-10-05")).toBe(false);
    expect(mieteUeberfaellig("2026-10", "2026-10-06")).toBe(true);
    // November 2026: 2. Mo, 3. Di, 4. Mi → fällig 04.11.
    expect(mieteUeberfaellig("2026-11", "2026-11-04")).toBe(false);
    expect(mieteUeberfaellig("2026-11", "2026-11-05")).toBe(true);
  });
});

describe("Vorausgefüllter Brief", () => {
  const url = (heute: string) =>
    new URL("https://x" + zahlungsBriefUrl({ mieterId: "m1", jahrMonat: "2026-10", betrag: 1234.5, heuteISO: heute, art: "mahnung" }));

  it("führt zum Brief-Generator des Mieters mit Art, Betrag, Frist und Grund", () => {
    const u = url("2026-10-12");
    expect(u.pathname).toBe("/tenants/m1/dokument");
    expect(u.searchParams.get("art")).toBe("mahnung");
    expect(u.searchParams.get("betrag")).toBe("1234.5");
    expect(u.searchParams.get("datum")).toBe("2026-10-19");
    expect(u.searchParams.get("grund")).toContain("Oktober 2026");
    expect(u.searchParams.get("grund")).toContain("fällig am 5.10.2026");
  });

  it("die Frist läuft über das Monatsende — ohne Ortszeit", () => {
    expect(url("2026-10-28").searchParams.get("datum")).toBe("2026-11-04");
    expect(url("2026-12-29").searchParams.get("datum")).toBe("2027-01-05");
  });
});

describe("Vorbereitete Mail (MyImmo verschickt nichts)", () => {
  const basis = { betreff: "Mahnung", mieterName: "Anna Weber", absender: "Max Muster" };

  it("Empfänger, Betreff und Text stehen im mailto-Link", () => {
    const l = briefMailLink({ ...basis, an: "anna@example.org" });
    expect(l.startsWith("mailto:anna@example.org?")).toBe(true);
    const q = new URLSearchParams(l.slice(l.indexOf("?") + 1));
    expect(q.get("subject")).toBe("Mahnung");
    expect(q.get("body")).toContain("Guten Tag Anna Weber,");
    expect(q.get("body")).toContain("im Anhang");
    expect(q.get("body")).toContain("\r\nMax Muster");
  });

  it("eine präparierte Adresse wird NICHT übernommen (kein bcc/cc durch die Hintertür)", () => {
    for (const boese of ["anna@example.org?bcc=x@y.de", "a@b.de&cc=c@d.de", "kein-at-zeichen", "a b@c.de"]) {
      const l = briefMailLink({ ...basis, an: boese });
      expect(l.startsWith("mailto:?subject="), boese).toBe(true);
      expect(l).not.toContain("bcc=");
    }
    expect(briefMailLink({ ...basis, an: null }).startsWith("mailto:?")).toBe(true);
  });

  it("ohne Namen bleibt die Anrede höflich und vollständig", () => {
    expect(briefMailText({ betreff: "Mahnung", mieterName: " ", absender: "" })).toMatch(/^Guten Tag,\n/);
  });
});

describe("Dashboard: „Erinnerung schreiben“ neben der offenen Miete", () => {
  const miete = (betrag?: number) => ({ mieterId: "m1", name: "Anna", objekt: "Haus", monat: "2026-10", betrag });
  const leer = { anliegen: [], meldungen: [], fristen: [] };

  it("nach der Fälligkeit: Knopf mit vorausgefüllter Zahlungserinnerung", () => {
    const [a] = baueHeuteAufgaben({ ...leer, offeneMieten: [miete(900)] }, "2026-10-06", Infinity);
    expect(a.href).toBe("/mietkonto?monat=2026-10"); // die Zeile selbst bleibt beim Mietkonto
    expect(a.neben?.label).toBe("Erinnerung schreiben");
    expect(a.neben?.href).toContain("/tenants/m1/dokument?art=zahlungserinnerung");
    expect(a.neben?.href).toContain("betrag=900");
  });

  it("vor der Fälligkeit, ohne Betrag oder im Bündel: kein Knopf", () => {
    expect(baueHeuteAufgaben({ ...leer, offeneMieten: [miete(900)] }, "2026-10-05", Infinity)[0].neben).toBeUndefined();
    expect(baueHeuteAufgaben({ ...leer, offeneMieten: [miete()] }, "2026-10-06", Infinity)[0].neben).toBeUndefined();
    const zwei = baueHeuteAufgaben({ ...leer, offeneMieten: [miete(900), { ...miete(700), mieterId: "m2", name: "Ben" }] }, "2026-10-06", Infinity);
    expect(zwei.every((a) => a.neben)).toBe(true);
    const [buendel] = buendleGleicheAufgaben(zwei);
    expect(buendel.anzahl).toBe(2);
    expect(buendel.neben).toBeUndefined();
  });

  it("das Dashboard reicht den Betrag herein und zeigt den Knopf neben (nicht in) der Zeile", () => {
    const seite = readFileSync("app/(app)/page.tsx", "utf8");
    // Seit Paket B (Teilzahlung) der offene REST, nicht das volle Soll.
    expect(seite).toMatch(/betrag: Math\.round\(\(soll\.gesamt - \(gezahlt \?\? 0\)\) \* 100\) \/ 100/);
    expect(seite).toMatch(/className="aufgabe-mit-aktion"/);
    expect(seite).toMatch(/href=\{a\.neben\.href\}/);
  });

  it("Mietkonto und Dashboard bauen den Brief an EINER Stelle", () => {
    expect(readFileSync("components/RueckstandWaechter.tsx", "utf8")).toMatch(/zahlungsBriefUrl\(/);
    expect(readFileSync("lib/heute.ts", "utf8")).toMatch(/zahlungsBriefUrl\(/);
  });

  it("im Mietkonto erst ab dem Tag NACH der Fälligkeit (nicht am Fälligkeitstag)", () => {
    expect(readFileSync("components/RueckstandWaechter.tsx", "utf8")).toMatch(/\{o\.tageOffen > 0 && <span/);
  });
});

describe("Brief-Generator: Versand per Mail oder Portal", () => {
  const v = readFileSync("components/BriefVersand.tsx", "utf8");
  it("verschickt nichts über einen Dienst — nur mailto bzw. Teilen-Dialog", () => {
    expect(v).toMatch(/briefMailLink\(/);
    expect(v).toMatch(/navigator\.share\(/);
    expect(v).not.toMatch(/brevo|sendeMail|\/api\/newsletter/i);
  });
  it("prüft die PDF-Antwort, statt eine Login-Seite als PDF anzuhängen", () => {
    expect(v).toMatch(/application\/pdf/);
  });
  it("ins Portal nur über die Vorab-Prüfung und die Server-Schranke", () => {
    expect(v).toMatch(/pruefeBriefZustellung\(/);
    expect(v).toMatch(/speichereBrief\(mieterId, felder, \{ zustellen: true/);
    expect(readFileSync("components/DocGenerator.tsx", "utf8")).toMatch(/<BriefVersand/);
  });
});
