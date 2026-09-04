import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Tarif-Schranken (A5 der Start-Checkliste), eingebaut am 04.09.2026.
//
// AUSGANGSLAGE: `lib/plan.ts` hatte die vollstaendige Tarif-Matrix, aber
// `darfFeature()` und `einheitenLimit()` wurden an NULL Stellen der App
// aufgerufen. `BILLING_ENFORCED=true` waere wirkungslos geblieben — kassieren,
// ohne zu beschraenken.
//
// DIE WICHTIGSTE ZUSICHERUNG dieser Datei ist NICHT, dass die Schranken
// sperren, sondern dass sie im Early Access NICHTS TUN: kein Datenbank-
// Zugriff, keine Verhaltensaenderung. Nur deshalb durften sie ueberall
// eingebaut werden, bevor das Bezahlsystem live geht.

const ENV = process.env.BILLING_ENFORCED;
afterEach(() => {
  if (ENV === undefined) delete process.env.BILLING_ENFORCED;
  else process.env.BILLING_ENFORCED = ENV;
  vi.resetModules();
});

/** Supabase-Attrappe, die JEDEN Zugriff mitzaehlt. */
function spionClient() {
  const zugriffe: string[] = [];
  return {
    zugriffe,
    client: {
      from(tabelle: string) {
        zugriffe.push(tabelle);
        const kette: Record<string, unknown> = {};
        for (const m of ["select", "eq", "order", "limit"]) kette[m] = () => kette;
        kette.maybeSingle = async () => ({ data: null });
        kette.then = undefined;
        return kette;
      },
    } as never,
  };
}

describe("Early Access: die Schranken sind ein No-op", () => {
  beforeEach(() => {
    delete process.env.BILLING_ENFORCED;
    vi.resetModules();
  });

  it("darfFeatureJetzt erlaubt alles — OHNE die Datenbank zu befragen", async () => {
    const { darfFeatureJetzt } = await import("@/lib/planGate");
    const spion = spionClient();
    for (const f of ["nk_pdf", "steuer", "ki_import", "mieterportal", "dokumente"] as const) {
      expect(await darfFeatureJetzt(spion.client, f)).toBe(true);
    }
    // Der eigentliche Punkt: kein einziger Tabellenzugriff.
    expect(spion.zugriffe).toEqual([]);
  });

  it("featureSperre meldet nie eine Sperre", async () => {
    const { featureSperre } = await import("@/lib/planGate");
    const spion = spionClient();
    expect(await featureSperre(spion.client, "steuer")).toBeNull();
    expect(spion.zugriffe).toEqual([]);
  });

  it("pruefeEinheiten erlaubt unbegrenzt — ebenfalls ohne Abfrage", async () => {
    const { pruefeEinheiten } = await import("@/lib/planGate");
    const spion = spionClient();
    const r = await pruefeEinheiten(spion.client, 99);
    expect(r.erlaubt).toBe(true);
    expect(r.limit).toBe(Number.POSITIVE_INFINITY);
    expect(r.meldung).toBeNull();
    expect(spion.zugriffe).toEqual([]);
  });

  it("auch ein anderer Wert als 'true' schaltet NICHT scharf", async () => {
    // Tippfehler in der Env duerfen nicht versehentlich sperren.
    for (const wert of ["1", "TRUE", "yes", ""]) {
      process.env.BILLING_ENFORCED = wert;
      vi.resetModules();
      const { darfFeatureJetzt } = await import("@/lib/planGate");
      const spion = spionClient();
      expect(await darfFeatureJetzt(spion.client, "steuer")).toBe(true);
      expect(spion.zugriffe).toEqual([]);
    }
  });
});

describe("Scharf geschaltet: die Schranken greifen", () => {
  beforeEach(() => {
    process.env.BILLING_ENFORCED = "true";
    vi.resetModules();
  });

  /** Client, der ein Abo mit dem angegebenen Tarif liefert. */
  function aboClient(plan: string | null, einheiten: number[] = []) {
    return {
      from(tabelle: string) {
        if (tabelle === "abos") {
          const k: Record<string, unknown> = {};
          k.select = () => k;
          k.limit = () => k;
          k.maybeSingle = async () => ({
            data: plan ? { plan, status: "aktiv", zyklus: "monat" } : null,
          });
          return k;
        }
        // properties
        return { select: async () => ({ data: einheiten.map((n) => ({ einheiten_anzahl: n })) }) };
      },
    } as never;
  }

  it("Kostenlos: Steuer gesperrt, Meldung nennt den noetigen Tarif", async () => {
    const { featureSperre } = await import("@/lib/planGate");
    const m = await featureSperre(aboClient(null), "steuer");
    expect(m).toContain("MyImmo Privat");
  });

  it("Privat: NK-PDF frei, KI-Import gesperrt", async () => {
    const { darfFeatureJetzt } = await import("@/lib/planGate");
    expect(await darfFeatureJetzt(aboClient("privat"), "nk_pdf")).toBe(true);
    expect(await darfFeatureJetzt(aboClient("privat"), "ki_import")).toBe(false);
  });

  it("Einheiten-Limit zaehlt EINHEITEN, nicht Objekte", async () => {
    // Privat = 5 Einheiten. Zwei Objekte mit je 2 Einheiten = 4 belegt;
    // ein weiteres mit 2 waere 6 -> gesperrt, mit 1 waere 5 -> erlaubt.
    const { pruefeEinheiten } = await import("@/lib/planGate");
    expect((await pruefeEinheiten(aboClient("privat", [2, 2]), 1)).erlaubt).toBe(true);
    const zuViel = await pruefeEinheiten(aboClient("privat", [2, 2]), 2);
    expect(zuViel.erlaubt).toBe(false);
    expect(zuViel.belegt).toBe(4);
    expect(zuViel.limit).toBe(5);
    expect(zuViel.meldung).toContain("5 Einheiten");
  });

  it("Objekte ohne Einheitenzahl zaehlen als eine Einheit", async () => {
    const { pruefeEinheiten } = await import("@/lib/planGate");
    const r = await pruefeEinheiten(aboClient("kostenlos", [0, 0]), 1);
    expect(r.belegt).toBe(2); // nicht 0
  });
});

describe("Bestandsschutz: was der Schalter mit Konten OHNE Abo-Zeile macht", () => {
  // Am 04.09.2026 in der Produktionsdatenbank gemessen: `abos` hat 0 Zeilen,
  // es gibt 22 Konten, 5 davon liegen ueber dem Kostenlos-Limit. Diese Tests
  // halten fest, WARUM `BILLING_ENFORCED=true` ohne Vorarbeit die eigenen
  // Nutzer aussperrt — damit die Erkenntnis nicht nur in einer Doku steht,
  // die beim Umlegen des Schalters niemand aufschlaegt.
  beforeEach(() => {
    process.env.BILLING_ENFORCED = "true";
    vi.resetModules();
  });

  it("kein Abo-Datensatz = Kostenlos = 1 Einheit, keine Privat-Funktion", async () => {
    const { effektiverPlan, einheitenLimit, darfFeature } = await import("@/lib/plan");
    expect(effektiverPlan(null)).toBe("kostenlos");
    expect(einheitenLimit(null, true)).toBe(1);
    for (const f of ["nk_pdf", "steuer", "dokumente", "mieterportal"] as const) {
      expect(darfFeature(null, f, true)).toBe(false);
    }
  });

  it("`gueltig_bis` laeuft NICHT von selbst ab — nur `status` zaehlt", async () => {
    // Diese Eigenschaft ist der Grund, warum das Bestandsschutz-Skript sein
    // Ende ueber den Status regelt und nicht ueber ein Datum. Wer sich hier
    // auf `gueltig_bis` verlaesst, baut einen Ablauf, den es nicht gibt.
    const { effektiverPlan } = await import("@/lib/plan");
    const laengstAbgelaufen = {
      plan: "plus",
      status: "testphase",
      zyklus: null,
      provider_customer_id: null,
      provider_subscription_id: null,
      gueltig_bis: "2020-01-01T00:00:00Z",
      storniert_zum: null,
    } as const;
    expect(effektiverPlan(laengstAbgelaufen)).toBe("plus");
  });

  it("die Tarifwerte des Bestandsschutz-Skripts sind gueltig und reichen aus", async () => {
    const { einheitenLimit, istZahlend } = await import("@/lib/plan");
    const skript = readFileSync("scripts/sql/bestandsschutz-vor-billing.sql", "utf8");
    // Das Skript vergibt 'plus'/'testphase'. Aendert jemand die Werte dort,
    // ohne sie hier nachzuziehen, faellt es hier auf.
    expect(skript).toContain("'plus'");
    expect(skript).toContain("'testphase'");
    expect(istZahlend("testphase")).toBe(true);
    // Groesstes Konto am 04.09.2026: 8 Einheiten. Plus deckt 24.
    expect(einheitenLimit({ plan: "plus", status: "testphase" } as never, true)).toBeGreaterThanOrEqual(8);
  });

  it("das Skript liegt NICHT in supabase/migrations/", () => {
    // Es aendert kein Schema und darf nicht mit der Migrationshistorie
    // vermischt werden — eine dort abgelegte, absichtlich nicht ausgefuehrte
    // Datei wuerde die Regel „Datei == ausgefuehrt" entwerten.
    const migrationen = readdirSync("supabase/migrations");
    expect(migrationen.some((n) => n.includes("bestandsschutz"))).toBe(false);
  });
});

describe("Die Schranken sind auch wirklich eingebaut", () => {
  // Ohne diesen Test bleibt die Gefahr, dass planGate.ts existiert und wieder
  // niemand es aufruft — genau der Zustand, der bis zum 04.09.2026 bestand.
  function dateien(ordner: string): string[] {
    return readdirSync(ordner).flatMap((n) => {
      const pfad = join(ordner, n);
      if (statSync(pfad).isDirectory()) return dateien(pfad);
      return pfad.endsWith(".ts") || pfad.endsWith(".tsx") ? [pfad] : [];
    });
  }

  const quellen = [...dateien("app"), ...dateien("lib")].filter((p) => !p.includes("planGate.ts"));
  const mitGate = quellen.filter((p) => /featureSperre|pruefeEinheiten|darfFeatureJetzt/.test(readFileSync(p, "utf8")));

  it("mindestens die fuenf Stellen aus docs/BEZAHLSYSTEM.md sind belegt", () => {
    expect(mitGate.length).toBeGreaterThanOrEqual(8);
  });

  it("Steuer-Ausgaben, KI-Routen, NK-PDF, Einladung und Objekt-Anlage", () => {
    const pfade = mitGate.map((p) => p.replace(/\\/g, "/")).join("\n");
    for (const erwartet of [
      "app/api/berichte/anlage-v/route.ts",
      "app/api/berichte/jahresbericht/route.ts",
      "app/api/export/datev/route.ts",
      "app/api/import/route.ts",
      "app/api/nk-ocr/route.ts",
      "app/(app)/tenants/[id]/nk/pdf/route.ts",
      "lib/actions/einladung.ts",
      "lib/actions/properties.ts",
    ]) {
      expect(pfade).toContain(erwartet);
    }
  });

  it("die Schranke steht NACH der Anmeldepruefung", () => {
    // Sonst bekaeme ein Nicht-Angemeldeter 402 statt 401 — und die Meldung
    // ueber den noetigen Tarif waere eine Auskunft an Unbefugte.
    for (const p of ["app/api/berichte/anlage-v/route.ts", "app/api/import/route.ts"]) {
      // Die Importzeile am Dateikopf enthaelt `featureSperre` ebenfalls und
      // steht natuerlich vor allem anderen — deshalb auf den AUFRUF pruefen,
      // nicht auf das blosse Vorkommen. (Erster Versuch scheiterte genau daran.)
      const s = readFileSync(p, "utf8");
      const aufruf = s.indexOf("await featureSperre(");
      expect(aufruf).toBeGreaterThan(-1);
      expect(s.indexOf("if (!user)")).toBeLessThan(aufruf);
    }
  });
});
