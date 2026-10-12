import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mockeNextUndSupabase, fd } from "./stubs/actionHarness";
import { speicherDb, type SpeicherDbInit } from "./stubs/speicherDb";
import { vorgangStand, type Ereignis } from "@/lib/vorgang";
import { vorgangMerkmal } from "@/lib/anliegenListe";

// Ablauf C (Prüfstand 11.10.2026, Phase 5): Mieter meldet → Vermieter → Hausmeister → Fachbetrieb-
// Vorschlag → Freigabe → Auftrag → Rechnung → Kosten → Erledigung und Rückmeldung im Portal.
// Die Datenbank-Stationen (Trigger, Regeln, Rollen) prüft supabase/test/rls/ablauf_c_durchgang.sql mit
// echten Rollen; hier die App: Stand-Anzeige, Abschluss ohne Partner, Kostenübernahme.
//
// Vorher-Zustand (belegt am Code vor diesem Paket):
//   · Ein Auftrag aus einem angenommenen Angebot (Firma OHNE Konto) kam nie auf „erledigt“ — die Firma
//     kann über ihren Link nur zu-/absagen. „Als Kosten übernehmen“ blieb unerreichbar.
//   · Nach dem Entfernen eines Partners standen seine offenen Aufträge als „Partner“ da, ohne Hinweis.
//   · Der Mieter sah nicht, wer zuständig ist.
//   · Sicherheitslücke (DB): fremde Mieter-/Anliegen-IDs am Auftrag → fremder Mieterkontakt über den Link.

const U = "nutzer-1";
const ev = (x: Partial<Ereignis>): Ereignis => ({
  id: Math.random().toString(36), anliegen_id: "a1", autor_rolle: "system", art: "auftrag", text: null, status_neu: null,
  created_at: "2026-10-01T10:00:00Z", zustaendig: null, ...x,
});

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(m);
});

// ------------------------------------------------------------------------------------------------
describe("Stand eines Vorgangs: wer ist zuständig, wie weit ist der Auftrag", () => {
  it("ohne Auftrag: der Vermieter", () => {
    expect(vorgangStand([ev({ art: "nachricht", text: "Hallo" })], "offen")).toEqual({ zustaendig: "vermieter", auftrag: null, auftragErledigtAnliegenOffen: false });
  });
  it("Hausmeister beauftragt → Hausmeister; Fachbetrieb freigegeben → Handwerker; jeweils der LETZTE Eintrag", () => {
    const v = [
      ev({ status_neu: "offen", zustaendig: "hausmeister", created_at: "2026-10-01T10:00:00Z" }),
      ev({ status_neu: "freigabe", zustaendig: "hausmeister", created_at: "2026-10-02T10:00:00Z" }),
    ];
    expect(vorgangStand(v, "in_arbeit")).toMatchObject({ zustaendig: "hausmeister", auftrag: "wartet auf Freigabe des Vermieters" });
    v.push(ev({ status_neu: "offen", zustaendig: "handwerker", created_at: "2026-10-03T10:00:00Z" }));
    expect(vorgangStand(v, "in_arbeit")).toMatchObject({ zustaendig: "handwerker", auftrag: "beauftragt" });
  });
  it("abgelehnt oder nicht freigegeben → wieder der Vermieter", () => {
    expect(vorgangStand([ev({ status_neu: "abgelehnt", zustaendig: "handwerker" })], "in_arbeit").zustaendig).toBe("vermieter");
    expect(vorgangStand([ev({ status_neu: "nicht_freigegeben", zustaendig: "hausmeister" })], "in_arbeit").zustaendig).toBe("vermieter");
  });
  it("Auftrag erledigt, Anliegen offen → Hinweis; Anliegen erledigt → keiner", () => {
    expect(vorgangStand([ev({ status_neu: "erledigt", zustaendig: "handwerker" })], "in_arbeit").auftragErledigtAnliegenOffen).toBe(true);
    expect(vorgangStand([ev({ status_neu: "erledigt", zustaendig: "handwerker" })], "erledigt").auftragErledigtAnliegenOffen).toBe(false);
  });
  it("Altbestand ohne `zustaendig` → Handwerker (wie der alte Text „Ein Handwerker wurde beauftragt.“)", () => {
    expect(vorgangStand([ev({ status_neu: "offen", zustaendig: null })], "offen").zustaendig).toBe("handwerker");
  });
  it("Reihenfolge nach Zeit, nicht nach Liste", () => {
    const v = [ev({ status_neu: "erledigt", created_at: "2026-10-05T10:00:00Z" }), ev({ status_neu: "angenommen", created_at: "2026-10-01T10:00:00Z" })];
    expect(vorgangStand(v, "in_arbeit").auftrag).toBe("erledigt");
  });
  it("Vermieter-Liste: „Auftrag erledigt“ als Merkmal — eine neue Nachricht des Mieters geht vor", () => {
    const slot = (s: string) => s;
    const erledigt = [ev({ status_neu: "erledigt" })];
    expect(vorgangMerkmal({ status: "in_arbeit", verlauf: erledigt, terminBestaetigt: null, terminVorschlaege: [] }, slot)).toEqual({ text: "Auftrag erledigt", cls: "badge-green" });
    const mitNachricht = [...erledigt, ev({ art: "nachricht", autor_rolle: "mieter", text: "Danke, aber tropft noch", created_at: "2026-10-02T10:00:00Z" })];
    expect(vorgangMerkmal({ status: "in_arbeit", verlauf: mitNachricht, terminBestaetigt: null, terminVorschlaege: [] }, slot)?.text).toBe("Neue Nachricht");
    expect(vorgangMerkmal({ status: "erledigt", verlauf: erledigt, terminBestaetigt: null, terminVorschlaege: [] }, slot)).toBeNull();
  });
});

describe("Anzeige im Verlauf (EINE Darstellung für Portal und Vermieter)", () => {
  async function verlauf(props: Record<string, unknown>) {
    vi.resetModules();
    mockeNextUndSupabase(speicherDb({ tabellen: {} }).client);
    const { default: VorgangVerlauf } = await import("@/components/VorgangVerlauf");
    return renderToStaticMarkup(createElement(VorgangVerlauf, props as never)).replace(/<!-- -->/g, "");
  }
  it("Mieterin sieht Zuständigkeit und Stand — ohne Namen und Beträge", async () => {
    const html = await verlauf({
      anliegenId: "a1", sicht: "mieter", anliegenStatus: "in_arbeit",
      ereignisse: [ev({ status_neu: "offen", zustaendig: "hausmeister", text: "Der Hausmeister kümmert sich darum." })],
    });
    expect(html).toMatch(/Zuständig: <strong[^>]*>Hausmeister<\/strong> · Auftrag: beauftragt/);
    expect(html).not.toMatch(/bitte das Anliegen abschließen/);
  });
  it("Vermieter bekommt den Hinweis zum Abschließen; ohne Status keine Zeile (alte Aufrufer)", async () => {
    const e = [ev({ status_neu: "erledigt", zustaendig: "handwerker" })];
    expect(await verlauf({ anliegenId: "a1", sicht: "vermieter", anliegenStatus: "in_arbeit", antworten: false, ereignisse: e })).toMatch(/bitte das Anliegen abschließen oder nachfragen/);
    expect(await verlauf({ anliegenId: "a1", sicht: "mieter", ereignisse: e })).not.toMatch(/data-vorgang-stand/);
    // Die Mieterin sieht „erledigt“, aber keine Aufforderung an den Vermieter.
    const mieterin = await verlauf({ anliegenId: "a1", sicht: "mieter", anliegenStatus: "in_arbeit", nurLesen: true, ereignisse: e });
    expect(mieterin).toMatch(/Auftrag: erledigt/);
    expect(mieterin).not.toMatch(/bitte das Anliegen abschließen/);
  });
});

// ------------------------------------------------------------------------------------------------
const auftrag = (x: Record<string, unknown> = {}) => ({
  id: "o1", vermieter_id: U, service_user_id: null, firma_id: "f1", prop_id: "p1", titel: "Heizung Brenner tauschen",
  objekt_name: "Haus", status: "offen", betrag: null, lohnanteil: null, kosten_id: null, rechnung_name: null, rechnung_type: null, rechnung_data: null, ...x,
});
async function lade(init: Partial<SpeicherDbInit> & { tabellen?: SpeicherDbInit["tabellen"] } = {}) {
  vi.resetModules();
  const db = speicherDb({
    ...init,
    tabellen: {
      auftraege: [auftrag()], service_zugaenge: [], firmen: [{ id: "f1", user_id: U, name: "Heizung Böhm" }], kosten: [],
      ...init.tabellen,
    },
    eindeutig: { kosten: [["auftrag_id"]] },
    vorgaben: { kosten: () => ({ id: `k-${Math.random().toString(36).slice(2, 7)}` }) },
  });
  mockeNextUndSupabase(db.client);
  const mod = await import("@/lib/actions/service");
  return { db, mod, a: () => db.tabellen.auftraege[0], kosten: () => db.tabellen.kosten };
}

describe("Vermieter schließt einen Auftrag ohne Partner ab → Kosten genau einmal", () => {
  it("Firma über den Link: Betrag eintragen → erledigt; dann „Als Kosten übernehmen“ mit Firmenname in der Notiz", async () => {
    const { mod, a, kosten } = await lade();
    expect(await mod.schliesseAuftragAb(fd({ id: "o1", betrag: "1.240,50", lohnanteil: "400" }))).toEqual({ ok: true });
    expect(a()).toMatchObject({ status: "erledigt", betrag: 1240.5, lohnanteil: 400, antwort: "Vom Vermieter abgeschlossen (Rechnung liegt vor)." });
    expect(await mod.uebernimmAuftragAlsKosten(fd({ id: "o1", kategorie: "Reparatur", buchungsdatum: "2026-10-08" }))).toEqual({ ok: true });
    expect(kosten()).toEqual([expect.objectContaining({ auftrag_id: "o1", betrag: 1240.5, buchungsdatum: "2026-10-08", prop_id: "p1" })]);
    expect(String(kosten()[0].notiz)).toMatch(/Übernommen aus Service-Auftrag \(Heizung Böhm\)\. Davon Arbeits-\/Lohnanteil: 400\.00 €/);
    expect(a().kosten_id).toBe(kosten()[0].id);
    // Zweiter Klick: keine zweite Buchung.
    expect((await mod.uebernimmAuftragAlsKosten(fd({ id: "o1" }))).error).toMatch(/bereits als Kosten erfasst/);
    expect(kosten()).toHaveLength(1);
  });

  it("Partner MIT Zugang: Vermieter darf nicht abschließen (der Partner meldet Betrag und Rechnung)", async () => {
    const { mod, a } = await lade({ tabellen: { auftraege: [auftrag({ service_user_id: "h1", firma_id: null })], service_zugaenge: [{ user_id: "h1", vermieter_id: U, rolle: "hausmeister" }] } });
    const r = await mod.schliesseAuftragAb(fd({ id: "o1", betrag: "100" }));
    expect(r).toEqual({ error: "Diesen Auftrag schließt der Partner ab — er hat Zugang und meldet Betrag und Rechnung." });
    expect(a().status).toBe("offen");
  });

  it("Partner entfernt (kein Zugang mehr): Vermieter schließt ab", async () => {
    const { mod, a } = await lade({ tabellen: { auftraege: [auftrag({ service_user_id: "h-weg", firma_id: null, status: "angenommen" })] } });
    expect(await mod.schliesseAuftragAb(fd({ id: "o1", betrag: "80" }))).toEqual({ ok: true });
    expect(a().status).toBe("erledigt");
  });

  it("Zugang nicht prüfbar → nichts geändert (fail-closed)", async () => {
    const { mod, a } = await lade({ tabellen: { auftraege: [auftrag({ service_user_id: "h1", firma_id: null })] }, fehlerBei: { service_zugaenge: "Zeitüberschreitung" } });
    expect(await mod.schliesseAuftragAb(fd({ id: "o1", betrag: "80" }))).toEqual({ error: "Partner-Zugang konnte nicht geprüft werden — nichts geändert." });
    expect(a().status).toBe("offen");
  });

  it("Eingaben: Betrag fehlt/0, Lohn über Betrag, Auftrag schon erledigt, fremder Auftrag", async () => {
    const { mod, a } = await lade();
    expect(await mod.schliesseAuftragAb(fd({ id: "o1", betrag: "" }))).toEqual({ error: "Bitte den Rechnungsbetrag angeben." });
    expect(await mod.schliesseAuftragAb(fd({ id: "o1", betrag: "0" }))).toEqual({ error: "Bitte den Rechnungsbetrag angeben." });
    expect(await mod.schliesseAuftragAb(fd({ id: "o1", betrag: "100", lohnanteil: "150" }))).toEqual({ error: "Der Lohnanteil kann nicht über dem Gesamtbetrag liegen." });
    expect(a().status).toBe("offen");
    const fremd = await lade({ tabellen: { auftraege: [auftrag({ vermieter_id: "anderer" })] } });
    expect(await fremd.mod.schliesseAuftragAb(fd({ id: "o1", betrag: "100" }))).toEqual({ error: "Auftrag nicht gefunden." });
    const fertig = await lade({ tabellen: { auftraege: [auftrag({ status: "erledigt", betrag: 5 })] } });
    expect(await fertig.mod.schliesseAuftragAb(fd({ id: "o1", betrag: "100" }))).toEqual({ error: "Nur offene Aufträge lassen sich abschließen." });
    expect(fertig.a().betrag).toBe(5);
  });

  it("zweimal gleichzeitig → einmal abgeschlossen, der zweite meldet die Änderung", async () => {
    const { mod, a } = await lade();
    const [x, y] = await Promise.all([mod.schliesseAuftragAb(fd({ id: "o1", betrag: "100" })), mod.schliesseAuftragAb(fd({ id: "o1", betrag: "200" }))]);
    expect([x, y].filter((r) => "ok" in r)).toHaveLength(1);
    expect([x, y].find((r) => "error" in r)).toEqual({ error: "Konnte nicht gespeichert werden — der Auftrag wurde inzwischen geändert." });
    expect([100, 200]).toContain(a().betrag);
  });
});

describe("Partner entfernen: offene Aufträge werden benannt", () => {
  it("die Zahl der offenen Aufträge kommt zurück (sie tragen danach „Partner entfernt“)", async () => {
    const { mod } = await lade({
      tabellen: {
        service_zugaenge: [{ user_id: "h1", vermieter_id: U, rolle: "hausmeister" }], service_objekte: [],
        auftraege: [auftrag({ id: "o1", service_user_id: "h1" }), auftrag({ id: "o2", service_user_id: "h1", status: "erledigt" }), auftrag({ id: "o3", service_user_id: "h1", status: "angenommen" })],
      },
    });
    expect(await mod.entferneServicePartner("h1")).toEqual({ ok: true, linksErneuert: 2, offeneOhnePartner: 2 });
  });
});
