import { describe, it, expect } from "vitest";
import {
  berechneKennzahlen,
  istAusgeschlossen,
  istRueckkehrer,
  type KontoRoh,
} from "@/lib/kennzahlen";

const k = (
  id: string,
  email: string | null,
  erstellt: string,
  letzterLogin: string | null,
): KontoRoh => ({ id, email, erstellt, letzterLogin });

const JETZT = new Date("2026-09-02T12:00:00.000Z");

describe("istAusgeschlossen", () => {
  it("trifft Domain, Präfix und volle Adresse", () => {
    expect(istAusgeschlossen("demo.vermieter@myimmo.test", ["@myimmo.test"])).toBe(true);
    expect(istAusgeschlossen("Max@Example.com", ["@example.com"])).toBe(true);
    expect(istAusgeschlossen("j.scharp12+test@gmail.com", ["j.scharp"])).toBe(true);
    expect(istAusgeschlossen("kunde@gmail.com", ["j.scharp", "@example.com"])).toBe(false);
    expect(istAusgeschlossen(null, ["@example.com"])).toBe(false);
  });

  it("ignoriert leere Ausschlusseinträge (sonst passt jeder String)", () => {
    expect(istAusgeschlossen("kunde@gmail.com", [""])).toBe(false);
  });
});

describe("istRueckkehrer", () => {
  it("zählt nur einen späteren Kalendertag", () => {
    expect(istRueckkehrer(k("a", "a@x.de", "2026-08-01T09:00:00Z", "2026-08-01T23:00:00Z"))).toBe(
      false,
    );
    expect(istRueckkehrer(k("b", "b@x.de", "2026-08-01T09:00:00Z", "2026-08-02T08:00:00Z"))).toBe(
      true,
    );
    expect(istRueckkehrer(k("c", "c@x.de", "2026-08-01T09:00:00Z", null))).toBe(false);
  });
});

describe("berechneKennzahlen", () => {
  const eingabe = {
    konten: [
      k("v1", "eins@gmail.com", "2026-08-01T09:00:00Z", "2026-08-20T09:00:00Z"), // extern, Objekt, Rückkehrer
      k("v2", "zwei@web.de", "2026-08-30T09:00:00Z", "2026-08-30T10:00:00Z"), // extern, Objekt, kein Rückkehrer
      k("v3", "drei@gmx.de", "2026-08-29T09:00:00Z", null), // extern, kein Objekt
      k("m1", "mieter@gmail.com", "2026-07-01T09:00:00Z", "2026-07-09T09:00:00Z"), // Rollen-Konto
      k("d1", "demo.vermieter@myimmo.test", "2026-07-01T09:00:00Z", "2026-09-01T09:00:00Z"),
    ],
    objekteJeKonto: { v1: 6, v2: 1, m1: 0, d1: 6 },
    rollenKonten: new Set(["m1"]),
    ausschluss: ["@myimmo.test"],
    aktiveAbos: 0,
    jetzt: JETZT,
  };

  it("zählt nur externe Vermieter-Konten", () => {
    const z = berechneKennzahlen(eingabe);
    expect(z.externeKonten).toBe(3);
    expect(z.ausgeschlossen).toEqual({ rollen: 1, eigeneUndTest: 1 });
  });

  it("rechnet Aktivierung und Rückkehr auf die externen Konten", () => {
    const z = berechneKennzahlen(eingabe);
    expect(z.mitObjekt).toBe(2);
    expect(z.aktivierungsquote).toBe(66.7);
    expect(z.rueckkehrer).toBe(1);
    expect(z.rueckkehrerquote).toBe(33.3);
  });

  it("zählt neue Konten der letzten 7 Tage", () => {
    const z = berechneKennzahlen(eingabe);
    expect(z.neueKonten7t).toBe(2); // 29.08. und 30.08., nicht der 01.08.
  });

  it("gibt bei null externen Konten null statt einer Division durch null", () => {
    const z = berechneKennzahlen({
      ...eingabe,
      konten: [],
      objekteJeKonto: {},
      rollenKonten: new Set<string>(),
    });
    expect(z.externeKonten).toBe(0);
    expect(z.aktivierungsquote).toBeNull();
    expect(z.rueckkehrerquote).toBeNull();
  });

  it("zählt zahlende Kunden durch", () => {
    expect(berechneKennzahlen({ ...eingabe, aktiveAbos: 3 }).zahlendeKunden).toBe(3);
  });
});
