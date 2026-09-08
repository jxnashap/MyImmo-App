import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";

// lib/actions/bewertung.ts — „Jetzt aktualisieren" auf der Objektseite.
//
// DER GRUND, WARUM DIESE DATEI ZUERST DRAN WAR (08.09.2026): Der Wächter aus
// `schreibFehler.test.ts` meldete sie als sauber — er hatte sie nie angesehen.
// Er zählte Klammern im Rohtext, und die Kommentare `// 1)` … `// 5)` in dieser
// Datei enthalten schließende Klammern ohne öffnende. Die Klammertiefe rutschte
// ins Negative, es wurde keine einzige Anweisung erkannt, und der Test war grün.
// Dahinter lagen VIER Schreibvorgänge ohne jede Fehlerauswertung: der Marktwert
// selbst, der Vergleichsangebots-Schnappschuss (Löschen und Einfügen) und die
// Wert-Historie. Der Knopf meldete „Aktualisiert", während nichts gespeichert war.
//
// Lehre, festgehalten in `tests/stubs/tsAnweisungen.ts`: Ein Wächter, der nichts
// findet, muss beweisen können, dass er hingesehen hat.

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) {
    vi.doUnmock(m);
  }
});

const OBJEKT = {
  id: "obj-1",
  user_id: "nutzer-1",
  typ: "Wohnung",
  obj_status: "Vermietet",
  flaeche: 80,
  grundstuecksflaeche: null,
  baujahr: 1995,
  miete: 900,
  adresse: "Musterweg 1, 23611 Bad Schwartau",
  latitude: 53.9,
  longitude: 10.7,
  bodenrichtwert: 400,
  bodenrichtwert_stichtag: "2025-01-01",
  liegenschaftszins: 3.5,
  restnutzungsdauer: 50,
  vergleichspreis_m2: 3200,
  vergleichsmiete_m2: 11,
};

async function lade(init: Parameters<typeof fakeSupabase>[0] = {}) {
  vi.resetModules();
  const { db, client } = fakeSupabase({
    antwortFolge: {
      "properties:select": [OBJEKT, []],
      "bewertung_historie:select": [[]],
    },
    ...init,
  });
  const spuren = mockeNextUndSupabase(client);
  const mod = await import("@/lib/actions/bewertung");
  return { db, spuren, mod };
}

const zugriff = (
  db: { zugriffe: { tabelle: string; op: string; daten?: Record<string, unknown>; filter: string[] }[] },
  tabelle: string,
  op: string,
) => db.zugriffe.find((x) => x.tabelle === tabelle && x.op === op);

describe("Bewertung aktualisieren", () => {
  it("ein fremdes Objekt wird nicht angefasst", async () => {
    // Die Datei prüft die Eigentümerschaft selbst (prop.user_id !== user.id) —
    // das ist die Absicherung, die hier nicht wegfallen darf.
    const { db, mod } = await lade({
      antwortFolge: { "properties:select": [{ ...OBJEKT, user_id: "jemand-anderes" }] },
    });
    await mod.refreshBewertung("obj-1", fd({}));
    expect(db.zugriffe.some((x) => x.op === "update" || x.op === "insert")).toBe(false);
  });

  it("der berechnete Marktwert wird auf das eigene Objekt geschrieben", async () => {
    const { db, mod } = await lade();
    await mod.refreshBewertung("obj-1", fd({}));
    const z = zugriff(db, "properties", "update")!;
    expect(z.filter).toContain("eq:id=obj-1");
    expect(z.filter).toContain("eq:user_id=nutzer-1");
    expect(z.daten).toHaveProperty("marktwert_aktuell");
    expect(z.daten).toHaveProperty("bewertungsverfahren");
  });

  it("manuelle Eingaben haben Vorrang vor den gespeicherten Kennzahlen", async () => {
    const { db, mod } = await lade();
    await mod.refreshBewertung("obj-1", fd({ liegenschaftszins: "4,5", restnutzungsdauer: "40", vergleichspreis_m2: "2800" }));
    const d = zugriff(db, "properties", "update")!.daten!;
    expect(d.liegenschaftszins).toBe(4.5);
    expect(d.restnutzungsdauer).toBe(40);
    expect(d.vergleichspreis_m2).toBe(2800);
  });

  it("ein leeres Feld überschreibt den gespeicherten Wert nicht", async () => {
    const { db, mod } = await lade();
    await mod.refreshBewertung("obj-1", fd({ liegenschaftszins: "" }));
    expect(zugriff(db, "properties", "update")!.daten!.liegenschaftszins).toBe(3.5);
  });

  it("nur die drei bekannten Verfahren dürfen erzwungen werden", async () => {
    // ACHTUNG, hier stand zuerst eine wertlose Zusicherung: `not.toBe("erfunden")`.
    // Sie blieb grün, als die Weißliste testweise entfernt wurde — denn
    // `bewerten()` macht aus einem unbekannten Verfahren stillschweigend
    // „sach". Der beobachtbare Unterschied ist ein anderer: OHNE Weißliste
    // gilt der erfundene Wert als gesetzte Vorgabe, die automatische Wahl
    // („ertrag" bei vermieteter Wohnung) fällt weg — und der Sachwert lässt
    // sich hier gar nicht rechnen, der Marktwert wäre NULL. Genau das wird
    // geprüft.
    const { db: mitSach, mod: m1 } = await lade();
    await m1.refreshBewertung("obj-1", fd({ bewertungsverfahren: "sach" }));
    expect(zugriff(mitSach, "properties", "update")!.daten!.bewertungsverfahren).toBe("sach");

    for (const boese of ["erfunden", "; drop table--", "SACH"]) {
      const { db, mod } = await lade();
      await mod.refreshBewertung("obj-1", fd({ bewertungsverfahren: boese }));
      const d = zugriff(db, "properties", "update")!.daten!;
      expect(d.bewertungsverfahren, boese).toBe("ertrag");
      expect(d.marktwert_aktuell, boese).toBeGreaterThan(0);
    }
  });

  it("scheitert das Speichern, bricht der Lauf ab", async () => {
    // DER FUND. Vorher wurde der Fehler verschluckt und der Knopf meldete
    // „Aktualisiert", obwohl der Marktwert nirgends stand.
    const { mod } = await lade({ fehlerBei: { "properties:update": { message: "boom" } } });
    await expect(mod.refreshBewertung("obj-1", fd({}))).rejects.toThrow(/nicht gespeichert/);
  });

  it("der Vergleichsangebots-Schnappschuss wird nicht halb ersetzt", async () => {
    // Gelungenes Löschen mit gescheitertem Einfügen hinterlässt eine leere
    // Liste, die aussieht, als gäbe es keine Vergleichsangebote.
    const { mod } = await lade({ fehlerBei: { "vergleichsangebote:delete": { message: "boom" } } });
    await expect(mod.refreshBewertung("obj-1", fd({}))).rejects.toThrow(/Vergleichsangebote/);
  });

  it("das Ersetzen ist auf das eigene Konto eingeschränkt", async () => {
    const { db, mod } = await lade();
    await mod.refreshBewertung("obj-1", fd({}));
    const z = zugriff(db, "vergleichsangebote", "delete")!;
    expect(z.filter).toContain("eq:immobilie_id=obj-1");
    expect(z.filter).toContain("eq:user_id=nutzer-1");
  });
});

describe("Wert-Historie", () => {
  it("ein unveränderter Wert erzeugt keinen neuen Eintrag", async () => {
    // Erst den Wert ermitteln, den der Lauf berechnet …
    const { db: erst, mod: m1 } = await lade();
    await m1.refreshBewertung("obj-1", fd({}));
    const wert = zugriff(erst, "properties", "update")!.daten!.marktwert_aktuell as number;
    expect(wert).toBeGreaterThan(0);

    // … und ihn dann als letzten Historienstand vorgeben.
    const { db, mod } = await lade({
      antwortFolge: {
        "properties:select": [OBJEKT, []],
        "bewertung_historie:select": [[{ marktwert: wert }]],
      },
    });
    await mod.refreshBewertung("obj-1", fd({}));
    expect(zugriff(db, "bewertung_historie", "insert")).toBeUndefined();
  });

  it("ein geänderter Wert wird fortgeschrieben", async () => {
    const { db, mod } = await lade({
      antwortFolge: {
        "properties:select": [OBJEKT, []],
        "bewertung_historie:select": [[{ marktwert: 1 }]],
      },
    });
    await mod.refreshBewertung("obj-1", fd({}));
    const z = zugriff(db, "bewertung_historie", "insert")!;
    expect(z.daten).toMatchObject({ user_id: "nutzer-1", immobilie_id: "obj-1", quelle: "ImmoWertV/App" });
  });

  it("scheitert das Lesen der Historie, wird nicht blind fortgeschrieben", async () => {
    // Eine fehlgeschlagene Abfrage kommt leer zurück und sähe aus wie „noch
    // kein Wert erfasst" — die Historie bekäme bei jedem Lauf denselben Wert.
    const { mod } = await lade({ fehlerBei: { "bewertung_historie:select": { message: "boom" } } });
    await expect(mod.refreshBewertung("obj-1", fd({}))).rejects.toThrow(/Historie/);
  });
});
