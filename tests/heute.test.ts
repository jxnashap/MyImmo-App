import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { baueHeuteAufgaben, tageVor, type FristZeile } from "@/lib/heute";
import { VERWALTEN, ABRECHNEN, PLANEN, ALLE_ZIELE } from "@/lib/nav";
import { REGISTRIERUNG_OFFEN, START_CTA } from "@/lib/preise";

// „HEUTE WICHTIG" UND DIE NAVIGATION (08.09.2026, Feedback Befund 7 + 8).
//
// Der Sofort-PR (#318) hat den Fristen-Block nach oben verschoben. Hier kommt
// das Zusammenführen: Alle Quellen mit Handlungsbedarf in EINER Liste, jede
// Zeile mit genau einem Ziel. Die Logik liegt in `lib/heute.ts` — ohne
// Datenbank, ohne React, damit sie prüfbar ist.

const HEUTE = "2026-09-08";
const leer = { offeneMieten: [], anliegen: [], meldungen: [], fristen: [] };

describe("tageVor(): Kalenderrechnung ohne Zeitzone", () => {
  it("rechnet über Monats- und Jahresgrenzen", () => {
    expect(tageVor("2026-09-08", 7)).toBe("2026-09-01");
    expect(tageVor("2026-03-05", 7)).toBe("2026-02-26");
    expect(tageVor("2026-01-03", 7)).toBe("2025-12-27");
    expect(tageVor("2028-03-01", 1)).toBe("2028-02-29"); // Schaltjahr
  });

  it("ist unabhängig von der Zeitzone", () => {
    // Dieselbe Falle wie bei `naechsteFaelligkeit` (08.09.2026): `Date` mit
    // Ortszeit-Zugriffen verschiebt das Ergebnis um einen Tag.
    const alt = process.env.TZ;
    const ergebnisse = new Set<string>();
    try {
      for (const tz of ["UTC", "Europe/Berlin", "America/New_York", "Pacific/Kiritimati"]) {
        process.env.TZ = tz;
        ergebnisse.add(tageVor("2026-03-29", 1));
      }
    } finally {
      if (alt === undefined) delete process.env.TZ;
      else process.env.TZ = alt;
    }
    expect([...ergebnisse]).toEqual(["2026-03-28"]);
  });

  it("gibt unbrauchbare Eingaben unverändert zurück, statt zu raten", () => {
    expect(tageVor("08.09.2026", 7)).toBe("08.09.2026");
    expect(tageVor("", 7)).toBe("");
  });
});

describe("baueHeuteAufgaben()", () => {
  it("ohne offene Punkte bleibt die Liste leer — dann sagt die Karte das auch", () => {
    expect(baueHeuteAufgaben(leer, HEUTE)).toEqual([]);
  });

  it("jede Zeile hat genau EIN Ziel und eine Handlung", () => {
    const a = baueHeuteAufgaben(
      {
        ...leer,
        offeneMieten: [{ mieterId: "m1", name: "Anna Muster", objekt: "Haus A", monat: "2026-09" }],
        anliegen: [{ id: "a1", titel: "Heizung tropft", mieter: "Bert", erstellt: "2026-09-07T10:00:00Z" }],
        meldungen: [{ id: "z1", art: "Strom", mieter: "Clara", datum: "2026-09-06" }],
      },
      HEUTE,
    );
    expect(a).toHaveLength(3);
    for (const x of a) {
      expect(x.href, x.label).toMatch(/^\/[a-z]/);
      expect(x.aktion.length, x.label).toBeGreaterThan(3);
      expect(x.label.length, x.label).toBeGreaterThan(3);
    }
    expect(a.map((x) => x.href).sort()).toEqual(["/anliegen", "/mietkonto?monat=2026-09", "/verbrauch"]);
  });

  it("Dringendes steht oben — auch wenn es SPÄTER dran ist", () => {
    // Der erste Entwurf nahm eine überfällige Frist gegen eine späte: Da hätte
    // auch die reine Datumssortierung gereicht, die Mutation „Dringendes nicht
    // zuerst" blieb grün. Jetzt liegt das Dringende WEITER HINTEN im Kalender —
    // nur die Dringlichkeit kann es nach oben bringen.
    const fristen: FristZeile[] = [
      { datum: "2026-09-10", label: "Normale Frist", sub: "x", warn: false },
      { datum: "2026-11-30", label: "Warnung", sub: "x", warn: true },
    ];
    const a = baueHeuteAufgaben({ ...leer, fristen }, HEUTE);
    expect(a.map((x) => x.label)).toEqual(["Warnung", "Normale Frist"]);
  });

  it("innerhalb derselben Dringlichkeit entscheidet das Datum", () => {
    const fristen: FristZeile[] = [
      { datum: "2026-12-01", label: "Spät", sub: "x", warn: false },
      { datum: "2026-09-20", label: "Bald", sub: "x", warn: false },
    ];
    expect(baueHeuteAufgaben({ ...leer, fristen }, HEUTE).map((x) => x.label)).toEqual(["Bald", "Spät"]);
  });

  it("eine offene Miete ist erst ab dem 5. des Monats dringend", () => {
    const mieten = [{ mieterId: "m1", name: "A", objekt: "B", monat: "2026-09" }];
    expect(baueHeuteAufgaben({ ...leer, offeneMieten: mieten }, "2026-09-02")[0].dringend).toBe(false);
    expect(baueHeuteAufgaben({ ...leer, offeneMieten: mieten }, "2026-09-05")[0].dringend).toBe(true);
    expect(baueHeuteAufgaben({ ...leer, offeneMieten: mieten }, "2026-09-20")[0].dringend).toBe(true);
  });

  it("ein Anliegen wird nach sieben Tagen dringend, ein Zählerstand nach vierzehn", () => {
    // Der Mieter wartet — das ist die Uhr, die hier läuft.
    const frisch = baueHeuteAufgaben({ ...leer, anliegen: [{ id: "a", titel: "X", mieter: "M", erstellt: "2026-09-03T08:00:00Z" }] }, HEUTE);
    expect(frisch[0].dringend).toBe(false);
    const alt = baueHeuteAufgaben({ ...leer, anliegen: [{ id: "a", titel: "X", mieter: "M", erstellt: "2026-08-20T08:00:00Z" }] }, HEUTE);
    expect(alt[0].dringend).toBe(true);
    const z = baueHeuteAufgaben({ ...leer, meldungen: [{ id: "z", art: null, mieter: "M", datum: "2026-08-01" }] }, HEUTE);
    expect(z[0].dringend).toBe(true);
  });

  it("bei Gleichstand kommt Geld vor Kommunikation vor Terminen", () => {
    // EHRLICH ZU DIESEM TEST: Der `rang`-Vergleich in `baueHeuteAufgaben` ist
    // bei der heutigen Reihenfolge der push-Blöcke REDUNDANT — `Array.sort` ist
    // stabil, die Einfügereihenfolge ist bereits miete → anliegen → zaehler →
    // frist. Die Mutation „rang ignorieren" bleibt deshalb grün, und das ist
    // kein Testfehler, sondern eine Eigenschaft des Codes. Der Vergleich bleibt
    // trotzdem drin: Er hält die Absicht fest, falls jemand die Blöcke umstellt.
    const a = baueHeuteAufgaben(
      {
        offeneMieten: [{ mieterId: "m", name: "A", objekt: "B", monat: "2026-09" }],
        anliegen: [{ id: "a", titel: "X", mieter: "M", erstellt: "2026-09-01T00:00:00Z" }],
        meldungen: [{ id: "z", art: null, mieter: "M", datum: "2026-09-01" }],
        fristen: [{ datum: "2026-09-01", label: "F", sub: "s", warn: false }],
      },
      "2026-09-20", // alles dringend, alles am 01.
    );
    expect(a.map((x) => x.art)).toEqual(["miete", "anliegen", "zaehler", "frist"]);
  });

  it("die Liste ist gedeckelt — die Karte soll nicht die Seite werden", () => {
    const viele = Array.from({ length: 30 }, (_, i) => ({
      datum: `2026-09-${String((i % 28) + 1).padStart(2, "0")}`,
      label: `F${i}`, sub: "x", warn: false,
    }));
    expect(baueHeuteAufgaben({ ...leer, fristen: viele }, HEUTE)).toHaveLength(5);
    expect(baueHeuteAufgaben({ ...leer, fristen: viele }, HEUTE, 3)).toHaveLength(3);
  });

  it("ein leerer Anliegen-Titel bekommt einen Ersatztext statt einer leeren Zeile", () => {
    const a = baueHeuteAufgaben({ ...leer, anliegen: [{ id: "a", titel: "   ", mieter: "M", erstellt: "2026-09-07T00:00:00Z" }] }, HEUTE);
    expect(a[0].label).toBe("Neues Anliegen");
  });

  it("der Monat steht ausgeschrieben da, nicht als 2026-09", () => {
    const a = baueHeuteAufgaben({ ...leer, offeneMieten: [{ mieterId: "m", name: "A", objekt: "B", monat: "2026-09" }] }, HEUTE);
    expect(a[0].label).toContain("September 2026");
  });
});

describe("Reihenfolge auf dem Dashboard (Vorgabe des Betreibers, 08.09.2026)", () => {
  // Das externe Feedback wollte die Aufgaben ganz oben; der Betreiber hat die
  // Seite danach LIVE gesehen und das Gegenteil entschieden: Kennzahlen und
  // Verläufe zuerst, Termine und Aufgaben ans Ende. Eine gesehene Seite schlägt
  // eine vermutete — dieser Test hält die Entscheidung fest, damit sie nicht
  // beim nächsten Feedback-Durchlauf still zurückgedreht wird.
  const seite = readFileSync("app/(app)/page.tsx", "utf8");

  it("die Kennzahlen stehen vor den Aufgaben", () => {
    const kpis = seite.indexOf('staffel grid-5');
    const aufgaben = seite.indexOf("Termine &amp; Aufgaben");
    expect(kpis).toBeGreaterThan(0);
    expect(aufgaben).toBeGreaterThan(0);
    expect(kpis).toBeLessThan(aufgaben);
  });

  it("auch die beiden Verlaufs-Charts stehen davor", () => {
    const aufgaben = seite.indexOf("Termine &amp; Aufgaben");
    for (const chart of ["Portfolio-Wertentwicklung", "Cashflow-Entwicklung"]) {
      expect(seite.indexOf(chart), chart).toBeLessThan(aufgaben);
    }
  });

  it("es gibt nur EINEN Aufgaben-Block — nicht zwei mit denselben Fristen", () => {
    // „Heute wichtig" und „Fristen & Aufgaben" listeten beide dieselben
    // Fristen. Zusammengefasst auf die reichere Fassung (mit Handlung je Zeile).
    // Geprüft wird die ÜBERSCHRIFT, nicht das Wort: Die Kommentare im Code
    // erklären die Zusammenlegung und dürfen den alten Namen nennen.
    // (Zweites Mal dieselbe zu grobe Zusicherung an einem Tag — beim CTA-Test
    // schlug sie ebenfalls auf einem Kommentar an.)
    expect(seite).not.toMatch(/<h3>\s*Heute wichtig\s*<\/h3>/);
    expect(seite.split("heuteAufgaben.map").length - 1).toBe(1);
  });
});

describe("Navigation: drei Gruppen statt elf gleichrangiger Punkte", () => {
  it("die drei Gruppen sind überschneidungsfrei und vollständig", () => {
    const alle = [...VERWALTEN, ...ABRECHNEN, ...PLANEN].map((n) => n.href);
    expect(new Set(alle).size).toBe(alle.length);
    expect(ALLE_ZIELE.map((n) => n.href).sort()).toEqual([...alle].sort());
  });

  it("keine Gruppe ist länger als sechs Punkte — das war der Befund", () => {
    for (const [name, g] of [["Verwalten", VERWALTEN], ["Abrechnen", ABRECHNEN], ["Planen", PLANEN]] as const) {
      expect(g.length, name).toBeLessThanOrEqual(6);
      expect(g.length, name).toBeGreaterThan(0);
    }
  });

  it("das Tägliche liegt in Verwalten, das Rechnerische in Abrechnen", () => {
    expect(VERWALTEN.map((n) => n.href)).toContain("/");
    expect(VERWALTEN.map((n) => n.href)).toContain("/tenants");
    expect(ABRECHNEN.map((n) => n.href)).toContain("/steuer");
    expect(ABRECHNEN.map((n) => n.href)).toContain("/mietkonto");
    expect(PLANEN.map((n) => n.href)).toContain("/kauf");
  });

  it("die Sidebar rendert alle drei Gruppen und klappt nur Planen ein", () => {
    const s = readFileSync("components/Sidebar.tsx", "utf8");
    for (const g of ["VERWALTEN.map", "ABRECHNEN.map", "PLANEN.map"]) expect(s).toContain(g);
    expect(s).toContain("<details");
    // Wer gerade in einem Planen-Bereich arbeitet, findet die Gruppe offen vor.
    expect(s).toContain("open={PLANEN.some((n) => isActive(n.href))}");
  });
});

describe("Ehrliche Beschriftung, solange ein Zugangscode nötig ist", () => {
  it("der Start-Knopf verspricht keine offene Registrierung", () => {
    expect(REGISTRIERUNG_OFFEN).toBe(false);
    expect(START_CTA).toMatch(/Early-Access/);
  });

  it("keine Landing-Datei schreibt die alte Beschriftung noch fest hin", () => {
    // Wird das hier rot, hat jemand die Beschriftung wieder hart eingetragen —
    // und damit die Aussage von der Registrierung entkoppelt.
    for (const p of [
      "components/LandingPage.tsx",
      "components/landing/QlxHeader.tsx",
      "components/landing/Shell.tsx",
      "components/landing/data.tsx",
    ]) {
      // Geprüft wird die BESCHRIFTUNG im JSX (>…<), nicht das Vorkommen des
      // Wortes: Ein Kommentar, der die alte Beschriftung erwähnt, ist harmlos.
      expect(readFileSync(p, "utf8"), p).not.toMatch(/>\s*Kostenlos starten\s*</);
      expect(readFileSync(p, "utf8"), p).not.toMatch(/cta:\s*"Kostenlos starten"/);
    }
  });

  it("die geführten Demo-Wege gehen über eine Weißliste, nicht über freie Pfade", () => {
    const route = readFileSync("app/api/demo/route.ts", "utf8");
    expect(route).toContain("DEMO_ZIELE");
    // Ein freier Pfad-Parameter wäre eine offene Weiterleitung auf der eigenen Domain.
    expect(route).not.toMatch(/searchParams\.get\("ziel"\)/);
    const landing = readFileSync("components/LandingPage.tsx", "utf8");
    for (const weg of ["miete", "nk", "schaden"]) expect(landing).toContain(`/api/demo?weg=${weg}`);
  });
});
