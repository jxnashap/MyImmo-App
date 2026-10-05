// Mieterportal-Listen (03.10.2026, Betreiber: „nicht so viel Text, Anliegen öffnen, eigene Seite“):
// EINE Zeile je Anliegen mit höchstens einem Merkmal; ein Klick öffnet die Detailansicht.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { vorgangMerkmal, mieterMerkmal, vorgangUrl, mitVorgang } from "@/lib/anliegenListe";
import { bauePortalNeuigkeiten, type NeuigkeitenQuelle } from "@/lib/portalNeuigkeiten";
import { baueMieterAufgaben } from "@/lib/mieterAufgaben";
import type { Ereignis } from "@/lib/vorgang";

const ev = (autor_rolle: string, art = "nachricht"): Ereignis =>
  ({ id: "e", anliegen_id: "a1", autor_rolle, art, text: "x", status_neu: null, created_at: "2026-10-01T09:00:00Z" }) as Ereignis;
const slot = (s: string) => s.slice(0, 10);

describe("Merkmal in der Zeile — Vermieter", () => {
  const basis = { status: "offen", verlauf: [] as Ereignis[], terminBestaetigt: null, terminVorschlaege: [] as string[] };
  it("nichts offen: kein Merkmal (der Normalfall)", () => {
    expect(vorgangMerkmal(basis, slot)).toBeNull();
  });
  it("letzte Nachricht vom Mieter → „Neue Nachricht“ — vor jedem Terminstand", () => {
    expect(vorgangMerkmal({ ...basis, verlauf: [ev("mieter")], terminBestaetigt: "2026-10-05T10:00" }, slot)?.text).toBe("Neue Nachricht");
  });
  it("eigene Antwort zuletzt oder Vorgang erledigt → keine „Neue Nachricht“", () => {
    expect(vorgangMerkmal({ ...basis, verlauf: [ev("mieter"), ev("vermieter")] }, slot)).toBeNull();
    expect(vorgangMerkmal({ ...basis, status: "erledigt", verlauf: [ev("mieter")] }, slot)).toBeNull();
  });
  it("Termin bestätigt bzw. Vorschläge offen", () => {
    expect(vorgangMerkmal({ ...basis, terminBestaetigt: "2026-10-05T10:00" }, slot)?.text).toBe("Termin 2026-10-05");
    expect(vorgangMerkmal({ ...basis, terminVorschlaege: ["2026-10-05T10:00"] }, slot)?.text).toBe("Terminwahl beim Mieter");
  });
});

describe("Merkmal in der Zeile — Mieter", () => {
  const basis = { status: "offen", termin_vorschlaege: null, termin_bestaetigt: null };
  it("Terminvorschläge ohne Wahl → „Termin wählen“, vor einer Antwort", () => {
    expect(mieterMerkmal({ ...basis, termin_vorschlaege: ["2026-10-05T10:00"] }, [ev("vermieter")])?.text).toBe("Termin wählen");
  });
  it("Antwort des Vermieters zuletzt → „Antwort“; eigene Nachricht zuletzt → nichts", () => {
    expect(mieterMerkmal(basis, [ev("vermieter")])?.text).toBe("Antwort");
    expect(mieterMerkmal(basis, [ev("vermieter"), ev("mieter")])).toBeNull();
  });
  it("erledigt: keine Terminwahl mehr", () => {
    expect(mieterMerkmal({ ...basis, status: "erledigt", termin_vorschlaege: ["2026-10-05T10:00"] }, [])).toBeNull();
  });
});

describe("Direktlinks auf den Vorgang", () => {
  it("Detail-Adressen", () => {
    expect(vorgangUrl("a 1")).toBe("/anliegen?vorgang=a%201");
    expect(mitVorgang("/portal?tab=anliegen", "a1")).toBe("/portal?tab=anliegen&vorgang=a1");
    expect(mitVorgang("/x", "a1")).toBe("/x?vorgang=a1");
  });
  it("Dashboard-Neuigkeit „Nachricht vom Mieter“ führt direkt zum Anliegen", () => {
    const q: NeuigkeitenQuelle = { ereignisse: [], anliegen: new Map([["a1", { titel: "Heizung", mieter: "Anna" }]]), zustellungen: [], angebote: [], rueckmeldungen: [], freigaben: [], bewerbungen: [] };
    q.ereignisse = [{ anliegen_id: "a1", autor_rolle: "mieter", art: "nachricht", text: "Hallo", created_at: "2026-10-01T09:00:00Z" }];
    expect(bauePortalNeuigkeiten(q, "2026-10-02").liste[0].href).toBe("/anliegen?vorgang=a1");
  });
  it("Mieter-Aufgabe „Termin wählen“ trägt das Anliegen", () => {
    const aufgaben = baueMieterAufgaben({
      freigegebeneDocs: [], vermieterAnfragen: [], verlauf: {},
      anliegen: [{ id: "a1", typ: "schaden", titel: "Heizung", beschreibung: null, status: "offen", created_at: "2026-09-25T08:00:00Z", termin_vorschlaege: ["2026-10-05T10:00"], termin_bestaetigt: null }],
    }, "2026-10-02");
    expect(aufgaben[0].vorgang).toBe("a1");
  });
});

describe("Die Listen zeigen keinen Verlauf mehr", () => {
  it("Vermieter-Liste: Zeile verlinkt, Verlauf/Formulare nur in der Detailansicht", () => {
    const src = readFileSync("components/AnliegenManager.tsx", "utf8");
    const zeile = src.slice(src.indexOf("function Zeile("), src.indexOf("export function AnliegenDetail"));
    expect(zeile).toContain("href={vorgangUrl(a.id)}");
    for (const nicht of ["VorgangVerlauf", "<form", "<textarea", "beschreibung"]) expect(zeile, nicht).not.toContain(nicht);
  });
  it("Mieter-Liste: Zeile verlinkt, kein Verlauf in der Liste", () => {
    const src = readFileSync("components/AnliegenPortal.tsx", "utf8");
    const liste = src.slice(src.indexOf('<div className="listen">'));
    expect(liste).toContain("href={detailHref(a.id)}");
    for (const nicht of ["VorgangVerlauf", "TerminWahl", "beschreibung"]) expect(liste, nicht).not.toContain(nicht);
  });
});
