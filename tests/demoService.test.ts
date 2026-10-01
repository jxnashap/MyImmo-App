// Demo-Service (01.10.2026): drei verknüpfte Service-Partner, Firmenverzeichnis,
// Beispielaufträge, „Ansicht Service" — und die Ansichten NUR in der Demo.
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { DEMO_EMAIL, DEMO_SERVICE_EMAIL, DEMO_SERVICE_KONTEN, ansichtenSichtbar, demoDarfRoute, istDemoKonto } from "@/lib/demo";
import { ladeServicePortalDaten, SERVICE_AUFTRAG_SPALTEN, serviceVorschauUrl } from "@/lib/servicePortalDaten";

const lies = (p: string) => readFileSync(p, "utf8");

type Abfrage = { tabelle: string; spalten: string | null; filter: string[] };
function fakeDb(antworten: Record<string, unknown>) {
  const abfragen: Abfrage[] = [];
  const from = (tabelle: string) => {
    const a: Abfrage = { tabelle, spalten: null, filter: [] };
    abfragen.push(a);
    const k: Record<string, unknown> = {};
    k.select = (sp: string) => { a.spalten = sp; return k; };
    for (const m of ["eq", "in", "order", "limit"]) {
      k[m] = (x: unknown, y?: unknown) => { a.filter.push(`${m}:${String(x)}=${JSON.stringify(y)}`); return k; };
    }
    k.then = (f: (w: unknown) => unknown) => Promise.resolve({ data: antworten[tabelle] ?? null, error: null }).then(f);
    return k;
  };
  return { db: { from }, abfragen };
}

describe("Demo-Konten", () => {
  it("die drei Service-Konten sind Demo-Konten — und nur sie", () => {
    for (const e of DEMO_SERVICE_KONTEN) expect(istDemoKonto(e)).toBe(true);
    expect(DEMO_SERVICE_KONTEN[0]).toBe(DEMO_SERVICE_EMAIL);
    expect(istDemoKonto("demo.hausmeister@myimmo.test.de")).toBe(false);
    expect(demoDarfRoute("/service")).toBe(true);
  });
  it("Liste in der App, Schreibsperre und Verknüpfung nennen dieselben Adressen", () => {
    const sql = lies("supabase/migrations/20261001180000_demo_service_konten.sql");
    const sperre = sql.slice(sql.indexOf("create or replace function public.ist_demo_nutzer"), sql.indexOf("$function$;"));
    const verk = sql.slice(sql.indexOf("create or replace function public.demo_service_verknuepfen"));
    for (const e of DEMO_SERVICE_KONTEN) {
      expect(sperre, e).toContain(`'${e}'`);
      expect(verk, e).toContain(`('${e}'`);
    }
    expect(sql).toContain("revoke execute on function public.demo_service_verknuepfen() from public, anon, authenticated;");
  });
});

describe("Ansichten nur in der Demo (Vorgabe des Betreibers)", () => {
  it("echte Konten sehen die Ansicht-Reiter nicht, Demo-Konten schon", () => {
    expect(ansichtenSichtbar(DEMO_EMAIL)).toBe(true);
    expect(ansichtenSichtbar("vermieterin@example.de")).toBe(false);
    expect(ansichtenSichtbar(null)).toBe(false);
  });
  it("die Seite lässt die Reiter nur bei sichtbaren Ansichten zu — auch nicht per Adresse", () => {
    const seite = lies("app/(app)/anliegen/page.tsx");
    expect(seite).toContain('const erlaubteTabs = ["bewerbungen", "service", ...(ansichten ? ["vorschau", "vorschau-service"] : [])];');
    expect(seite).toContain('const tab = erlaubteTabs.includes(searchParams.tab ?? "") ? (searchParams.tab as string) : "anliegen";');
    expect(seite).toMatch(/\.\.\.\(ansichten\s*\?\s*\(\[/);
  });
});

describe("Service-Lader", () => {
  it("in der Ansicht: nur Aufträge DIESES Partners bei DIESEM Vermieter, nur eigene Firmen", async () => {
    const { db, abfragen } = fakeDb({ auftraege: [], service_zugaenge: [], firmen: [] });
    await ladeServicePortalDaten(db, { art: "vermieter", vermieterId: "v1", serviceUserId: "s1" });
    const von = (t: string) => abfragen.find((a) => a.tabelle === t)!;
    expect(von("auftraege").filter).toEqual(expect.arrayContaining(['eq:service_user_id="s1"', 'eq:vermieter_id="v1"']));
    expect(von("service_zugaenge").filter).toEqual(expect.arrayContaining(['eq:user_id="s1"', 'eq:vermieter_id="v1"']));
    expect(von("firmen").filter).toContain('eq:user_id="v1"');
    expect(von("auftraege").spalten).toBe(SERVICE_AUFTRAG_SPALTEN);
    expect(SERVICE_AUFTRAG_SPALTEN).not.toContain("rechnung_data");
  });
  it("beim Partner selbst: keine Vermieter-Filter (die RLS entscheidet)", async () => {
    const { db, abfragen } = fakeDb({});
    await ladeServicePortalDaten(db, { art: "service", serviceUserId: "s1" });
    for (const a of abfragen) expect(a.filter.some((f) => f.startsWith("eq:vermieter_id"))).toBe(false);
  });
  it("Auftraggeber-Name kommt aus einem Auftrag, sonst ein Platzhalter mit Datum", async () => {
    const { db } = fakeDb({
      service_zugaenge: [{ vermieter_id: "v1", firma: null, created_at: "2026-06-01" }, { vermieter_id: "v2", firma: null, created_at: "2026-07-01" }],
      auftraege: [{ id: "a", vermieter_id: "v1", vermieter_name: "Max Mustermann" }],
    });
    const d = await ladeServicePortalDaten(db, { art: "service", serviceUserId: "s1" });
    expect(d.auftraggeber.map((a) => a.label)).toEqual(["Max Mustermann", "Auftraggeber 2 (seit 1.7.2026)"]);
    expect(serviceVorschauUrl("s 1")).toBe("/anliegen?tab=vorschau-service&partner=s%201");
  });
});

describe("Ausfüllen ja, Senden nein", () => {
  it("AuftraegePortal: in der Vorschau ruft weder Antrag noch Rückmeldung den Server", () => {
    const q = lies("components/AuftraegePortal.tsx");
    expect(q).toContain("if (vorschau) return; // Vorschau: nie an den Server");
    expect(q).toContain("disabled={pending || vorschau} onClick={() => { if (!vorschau) senden(aktion); }}");
    expect(q).toContain('disabled={pending || vorschau}>{pending ? "…" : "Antrag an den Vermieter senden"}');
  });
  it("ServiceManager: „Auftrag vergeben“ in der Demo ausfüllbar, Senden aus", () => {
    const q = lies("components/ServiceManager.tsx");
    expect(q).toContain("if (demo) return; // Demo: nie an den Server");
    expect(q).toContain('{...(demo ? { "data-demo-erlaubt": "" } : {})}');
    expect(q).toContain('disabled={pending || demo}>{pending ? "…" : "Auftrag senden"}');
    expect(lies("app/(app)/anliegen/page.tsx")).toContain("demo={demo}");
  });
  it("das Demo-Hausmeisterkonto und die Ansicht laufen im Vorschau-Modus", () => {
    expect(lies("app/(app)/service/page.tsx")).toContain("vorschau={istDemoKonto(user?.email)}");
    expect(lies("app/(app)/anliegen/page.tsx")).toMatch(/<ServicePortalAnsicht[\s\S]{0,200}\n\s*vorschau\n/);
  });
  it("die Auswahllisten der Ansichten sind von der Demo-Sperre ausgenommen", () => {
    for (const d of ["components/PortalVorschauWahl.tsx", "components/ServiceVorschauWahl.tsx"]) {
      expect(lies(d), d).toContain('<label data-demo-erlaubt=""');
    }
  });
});

describe("Demo-Start und Migrationen", () => {
  it("Partner werden VOR dem Reset verknüpft — der Reset ordnet die Aufträge über die E-Mail zu", () => {
    const r = lies("app/api/demo/route.ts");
    // Genau die erste Abfrage (fehlende Konten) muss vor dem Reset stehen —
    // der zweite Aufruf nach dem Anlegen zählt nicht (Gegenprobe M6).
    const v = r.indexOf('const { data: fehlend, error: sFehler } = await admin.rpc("demo_service_verknuepfen");');
    const z = r.indexOf('admin.rpc("demo_zuruecksetzen")');
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(z);
    expect(r).toContain("for (const email of fehlend as string[])");
  });
  it("der Seed enthält kein delete; der Reset liegt als ausstehend daneben", () => {
    expect(lies("supabase/migrations/20261001180100_demo_service_seed.sql")).not.toMatch(/\bdelete\b/i);
    expect(existsSync("supabase/ausstehend/demo_service_reset.sql")).toBe(true);
    expect(lies("supabase/ausstehend/demo_service_reset.sql")).toContain("AUSSTEHEND");
  });
});
