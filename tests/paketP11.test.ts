import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fakeSupabase, mockeNextUndSupabase } from "./stubs/actionHarness";
import {
  DOKUMENT_SLOTS,
  BEWERBUNG_SLOTS,
  VERTRAG_SLOTS,
  slotLabel,
  loeschGrenze,
  faelligeBewerbungen,
  nachweiseMail,
} from "@/lib/bewerbungsDokumente";

// Paket P11 der Gesamtprüfung (07.10.2026), Befund B45: Bewerbungslink nach der DSK-Orientierungshilfe
// Selbstauskünfte V2.0 (01/2026). Umgesetzt ist der eindeutige Teil; Rechtsgrundlage und Einwilligungstext
// bleiben bis zur Anwaltsfrage 10 unverändert (Entscheidung des Betreibers, 10.10.2026).

const lies = (p: string) => readFileSync(p, "utf8");
const EINKOMMEN = ["gehalt", "arbeitsvertrag", "einkommen_selbst", "einkommen_sonstig", "buergschaft"];

describe("Negativliste: was der Bewerbungslink nicht mehr anfragt", () => {
  it("keine Mietschuldenfreiheitsbescheinigung (BGH VIII ZR 238/08) — weder als Slot noch im Text", () => {
    expect(DOKUMENT_SLOTS.map((s) => s.slug)).not.toContain("mietschuldenfrei");
    for (const f of ["components/BewerbungForm.tsx", "components/BewerbungenManager.tsx", "app/(app)/bewerben/[token]/page.tsx"])
      expect(lies(f), f).not.toMatch(/Mietschuldenfrei/i);
    expect(lies("lib/actions/bewerbenPublic.ts")).not.toMatch(/"mietschuldenfrei"/);
  });
  it("keine Einkommensnachweise am Link — die kommen erst vor dem Vertrag (DSK C. 2)", () => {
    expect(BEWERBUNG_SLOTS.map((s) => s.slug).filter((s) => EINKOMMEN.includes(s))).toEqual([]);
    expect(VERTRAG_SLOTS.map((s) => s.slug).sort()).toEqual([...EINKOMMEN].sort());
    expect(lies("components/BewerbungForm.tsx")).not.toMatch(/Gehaltsabrechnung/);
  });
  it("Bonität nur als Auskunft für Vermieter, ausdrücklich nicht die Art.-15-Datenkopie (DSK C. 3)", () => {
    const s = BEWERBUNG_SLOTS.find((x) => x.slug === "schufa")!;
    expect(s.label).toMatch(/für Vermieter/);
    expect(s.hinweis).toMatch(/nicht die kostenlose Datenkopie nach Art\. 15/);
  });
});

describe("Ältere Dateien behalten einen Namen", () => {
  it("gestrichener Slot wird lesbar benannt, bestehende bleiben", () => {
    expect(slotLabel("mietschuldenfrei")).toMatch(/Mietschuldenfreiheitsbescheinigung \(wird nicht mehr angefragt\)/);
    expect(slotLabel("gehalt")).toBe("Letzte 3 Gehaltsabrechnungen");
    expect(slotLabel(null)).toBe("Weitere Unterlagen");
  });
});

describe("Löschfrist: sechs Monate, jeder Status (DSK D.)", () => {
  it("Stichtag rechnet auf den Zahlen des Datums, auch am Monatsende", () => {
    expect(loeschGrenze("2026-10-10")).toBe("2026-04-10");
    expect(loeschGrenze("2026-08-31")).toBe("2026-02-28");
    expect(loeschGrenze("2027-03-31")).toBe("2026-09-30");
    expect(loeschGrenze("2026-01-15")).toBe("2025-07-15");
  });
  it("offene, Favoriten und Absagen gleichermaßen — junge nicht, Stichtag selbst nicht", () => {
    const liste = [
      { id: "a", status: "neu", created_at: "2026-03-01T10:00:00Z" },
      { id: "b", status: "favorit", created_at: "2026-04-09T23:00:00Z" },
      { id: "c", status: "abgelehnt", created_at: "2025-12-24T08:00:00Z" },
      { id: "d", status: "abgelehnt", created_at: "2026-04-10T00:00:00Z" },
      { id: "e", status: "neu", created_at: "2026-09-30T12:00:00Z" },
    ];
    expect(faelligeBewerbungen(liste, "2026-10-10").map((b) => b.id)).toEqual(["a", "b", "c"]);
    expect(faelligeBewerbungen([], "2026-10-10")).toEqual([]);
  });
  it("Erinnerung und Löschen benutzen dieselbe Regel mit dem Stichtag vom Server", () => {
    const m = lies("components/BewerbungenManager.tsx");
    expect(m).toMatch(/const alte = faelligeBewerbungen\(bewerbungen, heute\)/);
    expect(m).not.toMatch(/new Date\(\)/);
    expect(lies("lib/actions/bewerber.ts")).toMatch(/\.lt\("created_at", loeschGrenze\(heuteBerlin\(\)\)\)/);
    expect(lies("app/(app)/anliegen/page.tsx")).toMatch(/<BewerbungenManager[^>]*heute=\{heuteBerlin\(\)\}/);
  });
});

describe("Zweiter Schritt: Nachweise bei Favoriten per Mail anfordern", () => {
  it("die Mail nennt die Wohnung, alle Einkommensnachweise und das Schwärzen", () => {
    const m = nachweiseMail({ name: "Lea Kraus", objektName: "ETW Leipzig" });
    expect(m.betreff).toContain("„ETW Leipzig“");
    expect(m.text).toMatch(/^Guten Tag Lea Kraus,/);
    for (const s of VERTRAG_SLOTS) expect(m.text, s.slug).toContain(s.label);
    expect(m.text).toMatch(/schwärzen/);
    expect(m.text).not.toMatch(/Mietschuldenfrei|SCHUFA/i);
  });
  it("der Knopf erscheint nur beim Favoriten und verschickt selbst nichts (mailto)", () => {
    const m = lies("components/BewerbungenManager.tsx");
    expect(m).toMatch(/b\.status === "favorit" && \(\(\) => \{[\s\S]{0,300}mailtoLink\(b\.email, m\.betreff, m\.text\)/);
  });
});

describe("Server: Einkommensnachweise lassen sich am Link nicht mehr einschalten", () => {
  const KEY = process.env.DATA_ENCRYPTION_KEY;
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    if (KEY !== undefined) process.env.DATA_ENCRYPTION_KEY = KEY;
    for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(m);
  });
  it("aktualisiereBewerberLink speichert nur Unterlagen der Phase „bewerbung“", async () => {
    const { db, client } = fakeSupabase();
    mockeNextUndSupabase(client);
    const mod = await import("@/lib/actions/bewerber");
    const f = new FormData();
    for (const s of ["schufa", "gehalt", "mietschuldenfrei", "wbs", "einkommen_selbst"]) f.append("dokumente", s);
    await mod.aktualisiereBewerberLink("l-1", f);
    const upd = db.zugriffe.find((z) => z.tabelle === "bewerber_links" && z.op === "update");
    expect((upd?.daten as { dokumente_gewuenscht: string[] }).dokumente_gewuenscht).toEqual(["schufa", "wbs"]);
  });
  it("der öffentliche Upload ordnet nur Phase-„bewerbung“-Unterlagen zu, alles andere als „sonstiges“", () => {
    expect(lies("lib/actions/bewerbenPublic.ts")).toMatch(/new Set\(\[\.\.\.BEWERBUNG_SLOTS\.map\(\(s\) => s\.slug\), "sonstiges"\]\)/);
  });
  it("die öffentliche Seite zeigt auch einem alten Link nur Phase-„bewerbung“-Unterlagen", () => {
    expect(lies("components/BewerbungForm.tsx")).toMatch(/const slots: DokumentSlot\[\] = BEWERBUNG_SLOTS\.filter/);
  });
});
