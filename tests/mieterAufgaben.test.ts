import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { baueMieterAufgaben, ANTWORT_TAGE } from "@/lib/mieterAufgaben";
import type { PortalDaten } from "@/lib/portalDaten";

// Mieter-Startseite „Was muss ich erledigen?“ (02.10.2026, Schritt 4 aus
// docs/zukunft/MIETERPORTAL-AUSBAU.md § 9). Reine Funktion über die Portal-Daten.

const HEUTE = "2026-10-02";

type D = Pick<PortalDaten, "freigegebeneDocs" | "anliegen" | "verlauf" | "vermieterAnfragen">;
const leer = (): D => ({ freigegebeneDocs: [], anliegen: [], verlauf: {}, vermieterAnfragen: [] });

const doc = (z: Partial<PortalDaten["freigegebeneDocs"][number]["zustellung"]> = {}) => ({
  id: "n1", titel: "NK 2025", kategorie: null, datei_name: "nk.pdf", created_at: "2026-09-01",
  zustellung: { id: "z1", notiz_id: "n1", zugestellt_am: "2026-09-20T10:00:00Z", gelesen_am: null, bestaetigung_noetig: false, bestaetigt_am: null, ...z },
});
const anl = (x: Partial<PortalDaten["anliegen"][number]> = {}) => ({
  id: "a1", typ: "schaden", titel: "Heizung", beschreibung: null, status: "offen", created_at: "2026-09-25T08:00:00Z",
  termin_vorschlaege: null, termin_bestaetigt: null, ...x,
});
const anfrage = (x: Record<string, unknown> = {}) => ({
  id: "f1", typ: "zaehlerstand", titel: "Zählerstand", beschreibung: null, termin: null, faellig_bis: null,
  status: "offen", antwort: null, created_at: "2026-09-28T08:00:00Z", ...x,
});
const ereignis = (x: Record<string, unknown>) => ({
  id: "e", anliegen_id: "a1", autor_rolle: "vermieter", art: "nachricht", text: "Komme Montag", status_neu: null,
  created_at: "2026-10-01T09:00:00Z", ...x,
});

describe("Was muss ich erledigen?", () => {
  it("nichts zu tun: leere Liste (der Normalfall)", () => {
    expect(baueMieterAufgaben(leer(), HEUTE)).toEqual([]);
    const ruhig = { ...leer(), freigegebeneDocs: [doc({ gelesen_am: "2026-09-21T00:00:00Z" })], anliegen: [anl({ status: "erledigt", termin_vorschlaege: ["2026-10-05T10:00"] })], vermieterAnfragen: [anfrage({ status: "erledigt" })] };
    expect(baueMieterAufgaben(ruhig, HEUTE)).toEqual([]);
  });

  it("Bestätigung verlangt: dringend; ungeöffnetes Dokument: nicht dringend", () => {
    const r = baueMieterAufgaben({ ...leer(), freigegebeneDocs: [doc({ bestaetigung_noetig: true }), { ...doc({ id: "z2" }), titel: "Mietvertrag" }] }, HEUTE);
    expect(r.map((a) => [a.id, a.dringend, a.tab])).toEqual([["bestaetigen:z1", true, "dokumente"], ["neu:z2", false, "dokumente"]]);
    // Schon bestätigt → nichts mehr, auch wenn nie geöffnet gezählt wurde.
    expect(baueMieterAufgaben({ ...leer(), freigegebeneDocs: [doc({ bestaetigung_noetig: true, bestaetigt_am: "2026-09-21T00:00:00Z", gelesen_am: "2026-09-21T00:00:00Z" })] }, HEUTE)).toEqual([]);
  });

  it("Terminwahl offen: dringend — und verdrängt die Antwort-Zeile desselben Anliegens", () => {
    const d = { ...leer(), anliegen: [anl({ termin_vorschlaege: ["2026-10-05T10:00", "2026-10-06T14:00"] })], verlauf: { a1: [ereignis({})] } };
    const r = baueMieterAufgaben(d as D, HEUTE);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: "termin:a1", dringend: true, text: "Dein Vermieter schlägt 2 Termine vor." });
    // Bestätigter Termin: keine Terminwahl mehr.
    expect(baueMieterAufgaben({ ...d, anliegen: [anl({ termin_vorschlaege: ["2026-10-05T10:00"], termin_bestaetigt: "2026-10-05T10:00" })] } as D, HEUTE).some((a) => a.id.startsWith("termin"))).toBe(false);
  });

  it("Antwort des Vermieters: nur als LETZTER Eintrag und nur die ersten 14 Tage", () => {
    const mit = (v: unknown[]) => baueMieterAufgaben({ ...leer(), anliegen: [anl()], verlauf: { a1: v } } as D, HEUTE);
    expect(mit([ereignis({})]).map((a) => a.id)).toEqual(["antwort:a1"]);
    expect(mit([ereignis({}), ereignis({ id: "e2", autor_rolle: "mieter", created_at: "2026-10-02T08:00:00Z" })])).toEqual([]);
    expect(mit([ereignis({ art: "status", text: null, status_neu: "in_arbeit" })])).toEqual([]);
    expect(mit([ereignis({ created_at: `2026-09-${String(2 + 30 - ANTWORT_TAGE).padStart(2, "0")}T09:00:00Z` })]).length).toBe(1);
    expect(mit([ereignis({ created_at: "2026-09-17T09:00:00Z" })])).toEqual([]);
  });

  it("Anfrage des Vermieters: Frist ≤ 3 Tage oder überschritten = dringend", () => {
    const r = (frist: string | null) => baueMieterAufgaben({ ...leer(), vermieterAnfragen: [anfrage({ faellig_bis: frist })] } as D, HEUTE)[0];
    expect(r(null)).toMatchObject({ dringend: false, text: "Bitte beantworten." });
    expect(r("2026-10-05")).toMatchObject({ dringend: true, text: "Bitte bis 05.10.2026 erledigen." });
    expect(r("2026-10-06").dringend).toBe(false);
    expect(r("2026-09-30")).toMatchObject({ dringend: true, text: "War fällig am 30.09.2026." });
  });

  it("Dringendes steht oben — auch wenn es ÄLTER ist als das Nicht-Dringende", () => {
    // Die Testwerte sind so gewählt, dass „nach Datum“ die umgekehrte Reihenfolge ergäbe.
    const r = baueMieterAufgaben({
      ...leer(),
      freigegebeneDocs: [doc({ bestaetigung_noetig: true, zugestellt_am: "2026-09-01T00:00:00Z" })],
      vermieterAnfragen: [anfrage({ created_at: "2026-09-30T00:00:00Z" })],
    } as D, HEUTE);
    expect(r.map((a) => [a.id, a.dringend])).toEqual([["bestaetigen:z1", true], ["anfrage:f1", false]]);
  });
});

describe("Anbindung", () => {
  const ansicht = readFileSync("components/PortalAnsicht.tsx", "utf8");
  it("die Liste steht im ersten Reiter und braucht keine eigene Abfrage", () => {
    expect(ansicht).toContain("baueMieterAufgaben(daten, heuteBerlin())");
    expect(ansicht).toMatch(/<MieterAufgabenListe aufgaben=\{aufgaben\}/);
  });
  it("der Notfall-Kasten steht auf der Startseite UND im Anliegen-Reiter", () => {
    expect(ansicht.match(/<NotfallKasten notdienste=\{notdienste\} \/>/g)?.length).toBe(2);
  });
});
