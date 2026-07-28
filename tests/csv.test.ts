import { describe, it, expect } from "vitest";
import { csvZelle, csvZelleGequotet, entschaerfeFormel } from "@/lib/csv";

// Formel-Einschleusung: Der Angriffsweg führt über die ÖFFENTLICHE
// Bewerbungsseite in den Export des Vermieters. Quoten allein schützt nicht —
// Excel entfernt die Anführungszeichen beim Import und wertet danach aus.

describe("entschaerfeFormel", () => {
  it.each([
    ["=1+1", "'=1+1"],
    ["+1", "'+1"],
    ["-1", "'-1"],
    ["@SUM(A1)", "'@SUM(A1)"],
    ["\tirgendwas", "'\tirgendwas"],
    ["\rirgendwas", "'\rirgendwas"],
  ])("entschärft %j", (roh, erwartet) => {
    expect(entschaerfeFormel(roh)).toBe(erwartet);
  });

  it.each([["Müller"], ["1000"], ["Reparatur Bad"], ["a=b"], ["Straße 1"]])(
    "lässt harmlosen Text %j unverändert",
    (s) => {
      expect(entschaerfeFormel(s)).toBe(s);
    },
  );
});

describe("csvZelle", () => {
  it("entschärft den klassischen Angriff aus einem Bewerber-Freitext", () => {
    // So etwas kann ein Fremder ohne Konto in `bewerbungen.nachricht` schreiben.
    const angriff = '=cmd|\' /C calc\'!A0';
    expect(csvZelle(angriff).startsWith("'=") || csvZelle(angriff).startsWith("\"'=")).toBe(true);
  });

  it("quotet Semikolon, Anführungszeichen und Zeilenumbruch", () => {
    expect(csvZelle("a;b")).toBe('"a;b"');
    expect(csvZelle('sagt "hallo"')).toBe('"sagt ""hallo"""');
    expect(csvZelle("zeile1\nzeile2")).toBe('"zeile1\nzeile2"');
  });

  it("quotet nicht ohne Not", () => {
    expect(csvZelle("Müller")).toBe("Müller");
    expect(csvZelle(1250.5)).toBe("1250.5");
  });

  it("null und undefined werden zur leeren Zelle", () => {
    expect(csvZelle(null)).toBe("");
    expect(csvZelle(undefined)).toBe("");
  });

  it("Objekte werden als JSON ausgegeben", () => {
    expect(csvZelle({ a: 1 })).toBe('"{""a"":1}"');
  });

  it("berücksichtigt ein abweichendes Trennzeichen", () => {
    expect(csvZelle("a,b", ",")).toBe('"a,b"');
    expect(csvZelle("a,b", ";")).toBe("a,b");
  });

  it("eine entschärfte Formel bleibt nach dem Quoten entschärft", () => {
    // Der Wert enthält ein Semikolon UND beginnt mit '=' — beides muss greifen.
    expect(csvZelle("=A1;B1")).toBe("\"'=A1;B1\"");
  });
});

describe("csvZelleGequotet", () => {
  it("quotet immer und entschärft trotzdem", () => {
    expect(csvZelleGequotet("=1+1")).toBe("\"'=1+1\"");
    expect(csvZelleGequotet("Müller")).toBe('"Müller"');
  });

  it("verdoppelt Anführungszeichen (statt sie zu entfernen)", () => {
    expect(csvZelleGequotet('a"b')).toBe('"a""b"');
  });

  it("null wird zur leeren gequoteten Zelle", () => {
    expect(csvZelleGequotet(null)).toBe('""');
  });
});
