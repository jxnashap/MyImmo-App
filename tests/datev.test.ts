import { describe, it, expect } from "vitest";
import { baueDatevBuchungen, baueDatevExtf, DATEV_GEGENKONTO } from "@/lib/datev";

const propName = (id: string | null) => (id === "p1" ? "Wohnung Köln" : "");

describe("baueDatevBuchungen", () => {
  const einnahmen = [
    { buchungsdatum: "2024-06-01", betrag: 750, kategorie: "Miete", prop_id: "p1" },
    { buchungsdatum: "2023-06-01", betrag: 700, kategorie: "Miete", prop_id: "p1" }, // anderes Jahr
    { buchungsdatum: "2024-07-01", betrag: -10, kategorie: "Miete", prop_id: "p1" }, // ungültig
  ];
  const kosten = [
    { buchungsdatum: "2024-03-15", betrag: 200, kategorie: "Reparatur", prop_id: "p1" },
    { buchungsdatum: "2024-02-01", betrag: 120, kategorie: "Grundsteuer", prop_id: null },
  ];

  it("filtert nach Jahr und positiven Beträgen und sortiert nach Datum", () => {
    const b = baueDatevBuchungen(2024, einnahmen, kosten, propName);
    expect(b).toHaveLength(3);
    expect(b.map((x) => x.buchungsdatum)).toEqual(["2024-02-01", "2024-03-15", "2024-06-01"]);
  });

  it("bucht Einnahmen im Haben auf ein Erlöskonto, Kosten im Soll auf ein Aufwandskonto", () => {
    const b = baueDatevBuchungen(2024, einnahmen, kosten, propName);
    const miete = b.find((x) => x.buchungstext.startsWith("Miete"))!;
    expect(miete.sollHaben).toBe("H");
    expect(miete.konto).toBe(8100);
    expect(miete.gegenkonto).toBe(DATEV_GEGENKONTO);
    const rep = b.find((x) => x.buchungstext.startsWith("Reparatur"))!;
    expect(rep.sollHaben).toBe("S");
    expect(rep.konto).toBe(4260);
  });
});

describe("baueDatevExtf", () => {
  const buchungen = baueDatevBuchungen(
    2024,
    [{ buchungsdatum: "2024-06-01", betrag: 750.5, kategorie: "Miete", prop_id: "p1" }],
    [{ buchungsdatum: "2024-03-15", betrag: 200, kategorie: "Reparatur", prop_id: "p1" }],
    propName,
  );
  const extf = baueDatevExtf(buchungen, { jahr: 2024, zeitstempel: "20240701120000000" });
  const zeilen = extf.replace(/^﻿/, "").split("\r\n");

  it("beginnt mit BOM und EXTF-Kennung im Header", () => {
    expect(extf.charCodeAt(0)).toBe(0xfeff);
    expect(zeilen[0]).toMatch(/^"EXTF";700;21;"Buchungsstapel";13;20240701120000000;/);
  });

  it("hat einen 31-Felder-Header und 14 Spaltenüberschriften", () => {
    expect(zeilen[0].split(";")).toHaveLength(31);
    expect(zeilen[1].split(";")).toHaveLength(14);
    expect(zeilen[1]).toContain('"Umsatz (ohne Soll/Haben-Kz)"');
    expect(zeilen[1]).toContain('"Buchungstext"');
  });

  it("setzt WJ-Beginn und Datumsbereich aus den Buchungen", () => {
    const h = zeilen[0].split(";");
    expect(h[12]).toBe("20240101"); // WJ-Beginn
    expect(h[14]).toBe("20240315"); // Datum von (erste Buchung)
    expect(h[15]).toBe("20240601"); // Datum bis (letzte Buchung)
  });

  it("formatiert Beträge deutsch und das Belegdatum als DDMM", () => {
    const rep = zeilen[2].split(";"); // erste Buchung = Reparatur 15.03.
    expect(rep[0]).toBe("200,00");
    expect(rep[1]).toBe('"S"');
    expect(rep[9]).toBe("1503"); // DDMM
    const miete = zeilen[3].split(";");
    expect(miete[0]).toBe("750,50");
    expect(miete[1]).toBe('"H"');
    expect(miete[9]).toBe("0106");
  });

  it("erzeugt bei leerem Stapel dennoch gültigen Header + Spalten", () => {
    const leer = baueDatevExtf([], { jahr: 2025, zeitstempel: "20250101000000000" });
    const z = leer.replace(/^﻿/, "").split("\r\n").filter(Boolean);
    expect(z).toHaveLength(2); // Header + Spalten
    expect(z[0].split(";")[12]).toBe("20250101");
  });
});
