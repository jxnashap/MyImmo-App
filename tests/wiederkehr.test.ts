import { describe, it, expect } from "vitest";
import {
  terminDatum, termine, betragFuerDatum, validierePerioden, naechsterTag, type Periode,
} from "@/lib/wiederkehr";

describe("terminDatum — Tag-Ankerung & Monatslänge", () => {
  it("klemmt den 31. auf den letzten Monatstag", () => {
    expect(terminDatum(2026, 1, 31)).toBe("2026-01-31");
    expect(terminDatum(2026, 2, 31)).toBe("2026-02-28"); // kein Schaltjahr
    expect(terminDatum(2024, 2, 31)).toBe("2024-02-29"); // Schaltjahr
    expect(terminDatum(2026, 4, 31)).toBe("2026-04-30");
  });
  it("lässt gültige Tage unverändert", () => {
    expect(terminDatum(2026, 3, 15)).toBe("2026-03-15");
  });
});

describe("termine — Erzeugung Start→heute", () => {
  it("monatlich, Tag-Ankerung am 1.", () => {
    const t = termine("2026-01-01", "monatlich", "2026-04-15");
    expect(t).toEqual(["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"]);
  });

  it("monatlich mit 31er-Anker (Feb geklemmt)", () => {
    const t = termine("2026-01-31", "monatlich", "2026-03-31");
    expect(t).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });

  it("halbjährlich ab 15.03 → 15.03, 15.09, 15.03…", () => {
    const t = termine("2025-03-15", "halbjaehrlich", "2026-10-01");
    expect(t).toEqual(["2025-03-15", "2025-09-15", "2026-03-15", "2026-09-15"]);
  });

  it("quartalsweise ankert am Startmonat", () => {
    const t = termine("2026-02-10", "quartalsweise", "2026-12-31");
    expect(t).toEqual(["2026-02-10", "2026-05-10", "2026-08-10", "2026-11-10"]);
  });

  it("jährlich", () => {
    const t = termine("2020-06-01", "jaehrlich", "2023-06-01");
    expect(t).toEqual(["2020-06-01", "2021-06-01", "2022-06-01", "2023-06-01"]);
  });

  it("kappt bei höchstens 10 Jahren zurück", () => {
    const t = termine("2010-01-01", "jaehrlich", "2026-06-26", null, 10);
    // frühestens 2016-06-26 → erstes jährliches am/ab diesem Datum ist 2017-01-01
    expect(t[0]).toBe("2017-01-01");
    expect(t[t.length - 1]).toBe("2026-01-01");
  });

  it("stoppt am Enddatum (Mietende)", () => {
    const t = termine("2026-01-01", "monatlich", "2026-12-31", "2026-03-01");
    expect(t).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
  });

  it("erzeugt keine Zukunft über heute hinaus", () => {
    const t = termine("2026-01-01", "monatlich", "2026-02-15");
    expect(t).toEqual(["2026-01-01", "2026-02-01"]);
  });
});

describe("betragFuerDatum — Mietverlauf", () => {
  const perioden: Periode[] = [
    { von: "2020-01-01", bis: "2023-12-31", betrag: 600 },
    { von: "2024-01-01", bis: null, betrag: 680 },
  ];
  it("liefert den im Zeitraum gültigen Betrag", () => {
    expect(betragFuerDatum(perioden, "2021-05-01")).toBe(600);
    expect(betragFuerDatum(perioden, "2023-12-31")).toBe(600);
    expect(betragFuerDatum(perioden, "2024-01-01")).toBe(680);
    expect(betragFuerDatum(perioden, "2030-01-01")).toBe(680);
  });
  it("null außerhalb aller Zeiträume", () => {
    expect(betragFuerDatum(perioden, "2019-12-31")).toBeNull();
  });
});

describe("validierePerioden", () => {
  it("akzeptiert lückenlose Reihe mit einem offenen Ende", () => {
    expect(validierePerioden([
      { von: "2020-01-01", bis: "2023-12-31", betrag: 600 },
      { von: "2024-01-01", bis: null, betrag: 680 },
    ])).toEqual({ ok: true });
  });
  it("erkennt Lücke", () => {
    const r = validierePerioden([
      { von: "2020-01-01", bis: "2023-12-30", betrag: 600 },
      { von: "2024-01-01", bis: null, betrag: 680 },
    ]);
    expect(r.ok).toBe(false);
  });
  it("erkennt Überschneidung", () => {
    const r = validierePerioden([
      { von: "2020-01-01", bis: "2024-06-30", betrag: 600 },
      { von: "2024-01-01", bis: null, betrag: 680 },
    ]);
    expect(r.ok).toBe(false);
  });
  it("verbietet offenen Zeitraum in der Mitte", () => {
    const r = validierePerioden([
      { von: "2020-01-01", bis: null, betrag: 600 },
      { von: "2024-01-01", bis: null, betrag: 680 },
    ]);
    expect(r.ok).toBe(false);
  });
});

describe("naechsterTag — Rollover", () => {
  it("Monats- und Jahreswechsel inkl. Schaltjahr", () => {
    expect(naechsterTag("2026-03-15")).toBe("2026-03-16");
    expect(naechsterTag("2026-01-31")).toBe("2026-02-01");
    expect(naechsterTag("2024-02-29")).toBe("2024-03-01");
    expect(naechsterTag("2026-12-31")).toBe("2027-01-01");
  });
});
