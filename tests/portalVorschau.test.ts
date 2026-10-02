// Mieterportal-Vorschau (01.10.2026): Der Vermieter sieht unter
// /anliegen?tab=vorschau, was sein Mieter im Portal sieht — mit demselben
// Lader und derselben Darstellung wie /portal.
//
// Was hier zählt, ist die Gleichheit: Beim Mieter schneidet die RLS heraus,
// was er nicht sehen darf (nur Miete/Nebenkosten, nur freigegebene Belege und
// Dokumente, nur die Spalten der Sicht). Beim Vermieter greift diese RLS
// nicht — er darf alles Eigene lesen. Steht der Filter nicht AUSDRÜCKLICH in
// der Abfrage, zeigt die Vorschau mehr als das Portal, und der Vermieter
// glaubt, sein Mieter sähe z. B. Kautionsbuchungen oder interne Belege.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { ladePortalDaten, MIETER_PORTAL_SPALTEN, PORTAL_ZAHLUNG_KATEGORIEN, vorschauUrl } from "@/lib/portalDaten";

type Abfrage = { tabelle: string; spalten: string | null; filter: string[] };

/** Kleine Attrappe, die anders als der Action-Prüfstand auch die SPALTEN mitschreibt. */
function fakeDb(antworten: Record<string, unknown>) {
  const abfragen: Abfrage[] = [];
  const from = (tabelle: string) => {
    const a: Abfrage = { tabelle, spalten: null, filter: [] };
    abfragen.push(a);
    const k: Record<string, unknown> = {};
    k.select = (sp: string) => { a.spalten = sp; return k; };
    for (const m of ["eq", "in", "order", "limit", "is"]) {
      k[m] = (x: unknown, y?: unknown) => { a.filter.push(`${m}:${String(x)}=${JSON.stringify(y)}`); return k; };
    }
    const antwort = () => ({ data: antworten[tabelle] ?? null, error: null });
    k.maybeSingle = async () => antwort();
    k.then = (f: (w: unknown) => unknown) => Promise.resolve(antwort()).then(f);
    return k;
  };
  return { db: { from }, abfragen };
}

const V = "vermieter-1";
const M = "mieter-1";
const MIETERZEILE = { id: M, prop_id: "obj-1", vorname: "Sophie", nachname: "Berger", kaltmiete: 900, nk_vorauszahlung: 170, stellplatz_miete: null };

describe("Lader in der Vorschau (Quelle: Vermieter)", () => {
  async function lade(antworten: Record<string, unknown> = {}) {
    const { db, abfragen } = fakeDb({
      mieter: MIETERZEILE,
      properties: { id: "obj-1", bezeichnung: "Altbau", adresse: "Lindenstr. 4" },
      mieter_zugaenge: { user_id: "konto-m" },
      anliegen: [{ id: "a1", typ: "schaden", titel: "Heizung", status: "offen", created_at: "2026-09-01" }],
      einnahmen: [],
      ...antworten,
    });
    const daten = await ladePortalDaten(db, { art: "vermieter", vermieterId: V, mieterId: M });
    const von = (t: string) => abfragen.filter((a) => a.tabelle === t);
    return { daten, abfragen, von };
  }

  it("liest aus `mieter` GENAU die Spalten der Sicht — nichts, was der Mieter nie bekommt", async () => {
    const { von } = await lade();
    const [m] = von("mieter");
    expect(m.spalten).toBe(MIETER_PORTAL_SPALTEN);
    for (const geheim of ["notiz", "miethistorie", "iban", "kaution_bank", "email", "telefon"]) {
      expect(m.spalten!.split(",")).not.toContain(geheim);
    }
    expect(m.filter).toContain(`eq:user_id="${V}"`);
    expect(m.filter).toContain(`eq:id="${M}"`);
  });

  it("die Spaltenliste ist dieselbe wie in der Sicht mieter_portal (Migration)", () => {
    const sql = readFileSync("supabase/migrations/20261001120000_mieter_sicht_spalten.sql", "utf8");
    const block = /create or replace view public\.mieter_portal[\s\S]*?select ([\s\S]*?)\n\s*from public\.mieter m/.exec(sql)![1];
    const sicht = block.split(",").map((s) => s.trim().replace(/^m\./, ""));
    expect(MIETER_PORTAL_SPALTEN.split(",")).toEqual(sicht);
  });

  it("jede Abfrage ist auf den eigenen Vermieter beschränkt", async () => {
    const { abfragen } = await lade();
    for (const a of abfragen) {
      const eigen = a.filter.some((f) => f === `eq:user_id="${V}"` || f === `eq:vermieter_id="${V}"`);
      // anliegen_dateien hängt an Anliegen, die selbst schon gefiltert sind.
      if (a.tabelle !== "anliegen_dateien") expect(eigen, a.tabelle).toBe(true);
    }
  });

  it("Zahlungen nur Miete/Nebenkosten — wie die RLS beim Mieter", async () => {
    const { von } = await lade();
    expect(von("einnahmen")[0].filter).toContain(`in:kategorie=${JSON.stringify([...PORTAL_ZAHLUNG_KATEGORIEN])}`);
  });

  it("Belege nur, wenn freigegeben; Dokumente nur über eine aktive Zustellung an DIESES Konto", async () => {
    const { von, daten } = await lade({
      zustellungen: [{ id: "z1", notiz_id: "n1", zugestellt_am: "2026-09-01", gelesen_am: null, bestaetigung_noetig: false, bestaetigt_am: null }],
      notizen: [{ id: "n1", titel: "NK 2025", kategorie: "Nebenkostenabrechnung", datei_name: "nk.pdf", created_at: "2026-08-01" }],
    });
    expect(von("kosten")[0].filter).toContain("eq:mieter_freigabe=true");
    const [z] = von("zustellungen");
    expect(z.filter).toContain(`eq:empfaenger_user_id="konto-m"`);
    expect(z.filter).toContain("is:zurueckgezogen_am=null");
    expect(z.filter).toContain(`eq:vermieter_id="${V}"`);
    // Das Dokument wird nur über die IDs der Zustellungen geholt — nicht über die Mieter-Zeile.
    expect(von("notizen")[0].filter).toContain(`in:id=${JSON.stringify(["n1"])}`);
    expect(von("notizen")[0].filter.some((f) => f.startsWith("in:mieter_id"))).toBe(false);
    expect(daten.freigegebeneDocs.map((d) => [d.id, d.zustellung.id])).toEqual([["n1", "z1"]]);
  });

  it("ohne verknüpftes Konto: keine Dokumente — es ist niemandem etwas zugestellt", async () => {
    const { von, daten } = await lade({ mieter_zugaenge: null, notizen: [{ id: "n1" }] });
    expect(von("zustellungen")).toEqual([]);
    expect(von("notizen")).toEqual([]);
    expect(daten.freigegebeneDocs).toEqual([]);
  });

  it("Anliegen und Zählerstände hängen am Konto des Mieters", async () => {
    const { von, daten } = await lade();
    expect(von("anliegen")[0].filter).toContain(`eq:mieter_user_id="konto-m"`);
    expect(von("zaehlerstand_meldungen")[0].filter).toContain(`eq:mieter_user_id="konto-m"`);
    expect(daten.mieterKontoVerknuepft).toBe(true);
    expect(daten.anliegen).toHaveLength(1);
  });

  it("ohne verknüpftes Konto: keine Anliegen/Zählerstände — genau wie beim Mieter", async () => {
    const { von, daten } = await lade({ mieter_zugaenge: null });
    expect(von("anliegen")).toHaveLength(0);
    expect(von("zaehlerstand_meldungen")).toHaveLength(0);
    expect(daten.mieterKontoVerknuepft).toBe(false);
    // Die Wohnung selbst ist trotzdem zu sehen.
    expect(daten.wohnungen[0].m.kaltmiete).toBe(900);
    expect(daten.wohnungen[0].p?.bezeichnung).toBe("Altbau");
  });

  it("ein fremder Mieter liefert nichts", async () => {
    const { daten } = await lade({ mieter: null });
    expect(daten.wohnungen).toEqual([]);
  });
});

describe("Lader im Portal (Quelle: Mieter)", () => {
  it("liest Sichten statt Tabellen und filtert Zahlungen ebenso", async () => {
    const { db, abfragen } = fakeDb({
      mieter_zugaenge: [{ mieter_id: M, prop_id: "obj-1" }],
      mieter_portal: [MIETERZEILE],
      properties_portal: [{ id: "obj-1", bezeichnung: "Altbau", adresse: null }],
    });
    const daten = await ladePortalDaten(db, { art: "mieter", mieterUserId: "konto-m" });
    const tabellen = abfragen.map((a) => a.tabelle);
    expect(tabellen).toContain("mieter_portal");
    expect(tabellen).toContain("properties_portal");
    expect(tabellen).not.toContain("mieter");
    expect(tabellen).not.toContain("properties");
    expect(abfragen.find((a) => a.tabelle === "einnahmen")!.filter).toContain(`in:kategorie=${JSON.stringify([...PORTAL_ZAHLUNG_KATEGORIEN])}`);
    expect(daten.wohnungen[0].p?.bezeichnung).toBe("Altbau");
  });
});

describe("Vorschau-Reiter und Nur-Lesen", () => {
  const seite = readFileSync("app/(app)/anliegen/page.tsx", "utf8");

  it("der Mieter kommt nur aus der eigenen Liste — eine fremde ID im Link fällt auf den ersten eigenen zurück", () => {
    expect(seite).toContain("vorschauListe.find((m) => m.id === searchParams.mieter) ?? vorschauListe[0] ?? null");
    expect(seite).toContain('{ art: "vermieter", vermieterId: user!.id, mieterId: vorschauMieter.id }');
  });

  it("die Vorschau rendert dieselbe Ansicht wie /portal, mit `vorschau`", () => {
    expect(seite).toMatch(/<PortalAnsicht[\s\S]{0,300}\n\s*vorschau\n/);
    expect(readFileSync("app/(app)/portal/page.tsx", "utf8")).toContain("<PortalAnsicht");
  });

  it("in der Vorschau gibt es keine Formulare und keine Abmelde-/Konto-Knöpfe", () => {
    const ansicht = readFileSync("components/PortalAnsicht.tsx", "utf8");
    expect(ansicht).toMatch(/\{vorschau \? \([\s\S]*?pointerEvents: "none"[\s\S]*?\) : \([\s\S]*?\/auth\/signout/);
    for (const k of ["AnfragenVomVermieter", "AnliegenPortal", "DokumenteAnfrage", "ZaehlerPortal"]) {
      expect(ansicht, k).toMatch(new RegExp(`<${k} [^>]*nurLesen=\\{vorschau\\}`));
    }
    expect(readFileSync("components/AnliegenPortal.tsx", "utf8")).toContain("{offenForm && !nurLesen && (");
    expect(readFileSync("components/AnliegenPortal.tsx", "utf8")).toContain("disabled={pending || nurLesen}");
    expect(readFileSync("components/ZaehlerPortal.tsx", "utf8")).toContain("{offenForm && !nurLesen && (");
    expect(readFileSync("components/DokumenteAnfrage.tsx", "utf8")).toContain("{gewaehlt && !nurLesen && (");
    expect(readFileSync("components/AnfragenVomVermieter.tsx", "utf8")).toContain('{a.status === "offen" && !nurLesen && (');
  });

  it("die Reiter der Vorschau bleiben in der Vorschau", () => {
    expect(vorschauUrl("m 1", "zaehler")).toBe("/anliegen?tab=vorschau&mieter=m%201&portal=zaehler");
    expect(seite).toContain("hrefFuer={(t) => vorschauUrl(vorschauMieter.id, t)}");
  });
});
