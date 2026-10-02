import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";
import { vollmachtStatus, vollmachtHinweise, VERTRETER_SPALTEN, type Vertreter } from "@/lib/vertreter";

// Einstellungen → Vertreter (02.10.2026): Vertrauensperson mit Vollmacht für Bank und Notar.
// Kein App-Zugang. Geprüft wird: Gültigkeit, Hinweise, Speichern nur ins eigene Konto, nur
// PDF/JPG/PNG als Scan, Auslieferung über dateiKopf().

const HEUTE = "2026-10-02";
const basis = (x: Partial<Vertreter> = {}): Vertreter => ({
  id: "v1", vorname: "Max", nachname: "Muster", beziehung: null, geburtsdatum: null, geburtsort: null,
  strasse: null, plz: null, ort: null, land: null, email: null, telefon: null,
  vollmacht_art: "bank", vollmacht_form: "beglaubigt", umfang: null, ausgestellt_am: null,
  gueltig_bis: null, widerrufen_am: null, im_ausland_unterzeichnet: false, apostille: false,
  beglaubigt_durch: null, original_bei: "Musterbank", notiz: null, datei_name: "vollmacht.pdf", datei_size: 1000, ...x,
});

describe("Gültigkeit der Vollmacht", () => {
  it("ohne Enddatum gültig; Ablauf in ≤ 60 Tagen warnt; Vergangenheit = abgelaufen", () => {
    expect(vollmachtStatus(basis(), HEUTE)).toBe("gueltig");
    expect(vollmachtStatus(basis({ gueltig_bis: "2026-12-01" }), HEUTE)).toBe("laeuft_ab"); // 60 Tage
    expect(vollmachtStatus(basis({ gueltig_bis: "2026-12-02" }), HEUTE)).toBe("gueltig"); // 61 Tage
    expect(vollmachtStatus(basis({ gueltig_bis: HEUTE }), HEUTE)).toBe("laeuft_ab");
    expect(vollmachtStatus(basis({ gueltig_bis: "2026-10-01" }), HEUTE)).toBe("abgelaufen");
  });
  it("Widerruf schlägt alles — aber erst ab dem Widerrufsdatum", () => {
    expect(vollmachtStatus(basis({ widerrufen_am: HEUTE, gueltig_bis: "2030-01-01" }), HEUTE)).toBe("widerrufen");
    expect(vollmachtStatus(basis({ widerrufen_am: "2026-11-01" }), HEUTE)).toBe("gueltig");
  });
});

describe("Hinweise", () => {
  const texte = (x: Partial<Vertreter>) => vollmachtHinweise(basis(x), HEUTE).map((h) => h.text);

  it("vollständige, beglaubigte Bankvollmacht: keine Hinweise (der Normalfall)", () => {
    expect(vollmachtHinweise(basis(), HEUTE)).toEqual([]);
  });
  it("Grundbuch/General nur unterschrieben oder auf Bankformular → § 29 GBO", () => {
    for (const form of ["privatschriftlich", "bankformular"] as const) {
      expect(texte({ vollmacht_art: "grundbuch", vollmacht_form: form }).some((t) => t.includes("§ 29 GBO"))).toBe(true);
      expect(texte({ vollmacht_art: "general", vollmacht_form: form }).some((t) => t.includes("§ 29 GBO"))).toBe(true);
    }
    expect(texte({ vollmacht_art: "grundbuch", vollmacht_form: "beglaubigt" }).some((t) => t.includes("§ 29 GBO"))).toBe(false);
    expect(texte({ vollmacht_art: "bank", vollmacht_form: "privatschriftlich" }).some((t) => t.includes("§ 29 GBO"))).toBe(false);
  });
  it("Darlehen privatschriftlich → bei der Bank nachfragen", () => {
    expect(texte({ vollmacht_art: "darlehen", vollmacht_form: "privatschriftlich" }).some((t) => t.includes("Vollmachtsformular"))).toBe(true);
    expect(texte({ vollmacht_art: "darlehen", vollmacht_form: "bankformular" }).some((t) => t.includes("Vollmachtsformular"))).toBe(false);
  });
  it("im Ausland beglaubigt ohne Apostille → Hinweis; mit Apostille nicht", () => {
    expect(texte({ im_ausland_unterzeichnet: true }).some((t) => t.includes("Apostille"))).toBe(true);
    expect(texte({ im_ausland_unterzeichnet: true, apostille: true }).some((t) => t.includes("Apostille"))).toBe(false);
    expect(texte({ im_ausland_unterzeichnet: true, vollmacht_form: "privatschriftlich" }).some((t) => t.includes("Apostille"))).toBe(false);
  });
  it("fehlender Scan und fehlender Ort des Originals werden genannt", () => {
    expect(texte({ datei_name: null })).toContain("Noch kein Scan der Vollmacht hinterlegt.");
    expect(texte({ original_bei: null }).some((t) => t.includes("Original"))).toBe(true);
  });
  it("widerrufen: nur der Widerrufs-Hinweis, Warnungen stehen vorn", () => {
    expect(vollmachtHinweise(basis({ widerrufen_am: "2026-09-01", datei_name: null }), HEUTE)).toEqual([
      expect.objectContaining({ art: "warn", text: expect.stringContaining("§ 175 BGB") }),
    ]);
    const h = vollmachtHinweise(basis({ gueltig_bis: "2026-09-01", datei_name: null }), HEUTE);
    expect(h[0]).toMatchObject({ art: "warn", text: "Abgelaufen am 01.09.2026." });
  });
});

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(m);
});

async function lade(init = {}) {
  vi.resetModules();
  const { db, client } = fakeSupabase(init);
  mockeNextUndSupabase(client);
  const mod = await import("@/lib/actions/vertreter");
  return { db, mod };
}
const GUT = { nachname: "Muster", vollmacht_art: "darlehen", vollmacht_form: "beglaubigt" };
const OK = { antworten: { vertreter: { id: "v1" } } };
const schreib = (db: { zugriffe: { tabelle: string; op: string; daten?: unknown; filter: string[] }[] }) =>
  db.zugriffe.find((z) => z.tabelle === "vertreter" && (z.op === "insert" || z.op === "update"));

describe("speichereVertreter", () => {
  it("legt im eigenen Konto an; Haken werden zu booleans", async () => {
    const { db, mod } = await lade(OK);
    expect(await mod.speichereVertreter(fd({ ...GUT, vorname: " Max ", apostille: "on" }))).toEqual({ ok: true });
    const z = schreib(db)!;
    expect(z.op).toBe("insert");
    expect(z.daten).toMatchObject({ user_id: "nutzer-1", nachname: "Muster", vorname: "Max", apostille: true, im_ausland_unterzeichnet: false, vollmacht_art: "darlehen" });
  });
  it("ändern filtert auf ID UND eigenes Konto; user_id wird nie umgeschrieben", async () => {
    const { db, mod } = await lade(OK);
    await mod.speichereVertreter(fd({ ...GUT, id: "v1" }));
    const z = schreib(db)!;
    expect(z.op).toBe("update");
    expect(z.filter).toEqual(expect.arrayContaining(["eq:id=v1", "eq:user_id=nutzer-1"]));
    expect("user_id" in (z.daten as object)).toBe(false);
  });
  it("Pflichtangaben und Prüfungen brechen ab, bevor geschrieben wird", async () => {
    const faelle: [Record<string, string>, string][] = [
      [{ ...GUT, nachname: "  " }, "Nachnamen"],
      [{ ...GUT, vollmacht_art: "alles" }, "Art der Vollmacht"],
      [{ ...GUT, vollmacht_form: "muendlich" }, "Form der Vollmacht"],
      [{ ...GUT, email: "kein-at" }, "E-Mail"],
      [{ ...GUT, gueltig_bis: "01.01.2027" }, "Datum"],
      [{ ...GUT, ausgestellt_am: "2026-05-01", gueltig_bis: "2026-04-30" }, "vor dem Ausstellungsdatum"],
    ];
    for (const [werte, meldung] of faelle) {
      const { db, mod } = await lade(OK);
      const r = await mod.speichereVertreter(fd(werte));
      expect("error" in r && r.error).toContain(meldung);
      expect(schreib(db)).toBeUndefined();
    }
  });
  it("Scan: PDF wird gespeichert, HTML/SVG abgelehnt, über 8 MB abgelehnt", async () => {
    const pdf = new File([new Uint8Array([37, 80, 68, 70])], "v.pdf", { type: "application/pdf" });
    const { db, mod } = await lade(OK);
    await mod.speichereVertreter(fd({ ...GUT, datei: pdf }));
    expect(schreib(db)!.daten).toMatchObject({ datei_name: "v.pdf", datei_type: "application/pdf", datei_size: 4, datei_data: "data:application/pdf;base64,JVBERg==" });

    for (const typ of ["text/html", "image/svg+xml"]) {
      const { db: d2, mod: m2 } = await lade(OK);
      const r = await m2.speichereVertreter(fd({ ...GUT, datei: new File(["<x>"], "x", { type: typ }) }));
      expect("error" in r && r.error).toContain("PDF, JPG oder PNG");
      expect(schreib(d2)).toBeUndefined();
    }
    const gross = new File([new Uint8Array(8 * 1024 * 1024 + 1)], "g.pdf", { type: "application/pdf" });
    const { db: d3, mod: m3 } = await lade(OK);
    expect(await m3.speichereVertreter(fd({ ...GUT, datei: gross }))).toEqual({ error: "Die Datei ist zu groß (höchstens 8 MB)." });
    expect(schreib(d3)).toBeUndefined();
  });
  it("Scan entfernen nur beim Ändern; ohne Haken bleibt der Scan unberührt", async () => {
    const { db, mod } = await lade(OK);
    await mod.speichereVertreter(fd({ ...GUT, id: "v1", datei_entfernen: "on" }));
    expect(schreib(db)!.daten).toMatchObject({ datei_name: null, datei_data: null });
    const { db: d2, mod: m2 } = await lade(OK);
    await m2.speichereVertreter(fd({ ...GUT, id: "v1" }));
    expect("datei_data" in (schreib(d2)!.daten as object)).toBe(false);
  });
  it("Datenbankfehler oder Treffer-Null wird gemeldet, nicht als Erfolg", async () => {
    const { mod } = await lade({ antworten: { vertreter: null } });
    expect(await mod.speichereVertreter(fd({ ...GUT, id: "fremd" }))).toEqual({ error: "Der Vertreter konnte nicht gespeichert werden." });
    const { mod: m2 } = await lade({ ...OK, fehlerBei: { vertreter: { message: "x" } } });
    expect("error" in (await m2.speichereVertreter(fd(GUT)))).toBe(true);
  });
});

describe("entferneVertreter", () => {
  it("filtert auf das eigene Konto und meldet Fehler", async () => {
    const { db, mod } = await lade();
    expect(await mod.entferneVertreter("v1")).toEqual({ ok: true });
    const z = db.zugriffe.find((x) => x.tabelle === "vertreter" && x.op === "delete")!;
    expect(z.filter).toEqual(expect.arrayContaining(["eq:id=v1", "eq:user_id=nutzer-1"]));
    const { mod: m2 } = await lade({ fehlerBei: { vertreter: { message: "x" } } });
    expect(await m2.entferneVertreter("v1")).toEqual({ error: "Der Vertreter konnte nicht entfernt werden." });
  });
});

describe("Anbindung", () => {
  it("die Liste lädt den Scan-Inhalt NICHT mit", () => {
    expect(VERTRETER_SPALTEN).not.toContain("datei_data");
    expect(readFileSync("app/(app)/einstellungen/page.tsx", "utf8")).toContain('from("vertreter").select(VERTRETER_SPALTEN)');
  });
  it("die Datei-Route filtert auf das eigene Konto und liefert über dateiKopf()", () => {
    const r = readFileSync("app/(app)/einstellungen/vertreter/[id]/route.ts", "utf8");
    expect(r).toContain('.eq("user_id", user.id)');
    expect(r).toContain("dateiKopf(v.datei_type, v.datei_name");
  });
  it("der Reiter sagt, dass der Vertreter KEINEN Zugang bekommt", () => {
    expect(readFileSync("components/VertreterPanel.tsx", "utf8")).toContain("keinen Zugang zu MyImmo");
    expect(readFileSync("components/SettingsView.tsx", "utf8")).toContain('{ key: "vertreter", label: "Vertreter"');
  });
});
