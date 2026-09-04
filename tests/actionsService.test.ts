import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";

// lib/actions/service.ts — Service-Partner (Handwerker/Hausmeister).
//
// WARUM DIESE DATEI DIE HEIKELSTE IST: Hier schreibt ein FREMDER Nutzer in die
// Daten des Vermieters. Der Handwerker legt Aufträge an, meldet Beträge und
// lädt Rechnungen hoch — und aus einem dieser Beträge wird per Klick eine
// Kosten-Buchung, die in die Steuerauswertung läuft.
//
// Die Grenzen, die das zusammenhalten, sind reine Filter-Bedingungen in
// Abfragen. Fällt eine weg, merkt es niemand: Die App funktioniert weiter,
// nur eben für zu viele Leute.

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) {
    vi.doUnmock(m);
  }
});

async function lade(init = {}) {
  const { db, client } = fakeSupabase(init);
  mockeNextUndSupabase(client);
  const mod = await import("@/lib/actions/service");
  return { db, mod };
}

function insert(db: { zugriffe: { tabelle: string; op: string; daten?: unknown }[] }, tabelle: string) {
  return db.zugriffe.find((z) => z.tabelle === tabelle && z.op === "insert")?.daten as
    | Record<string, unknown>
    | undefined;
}
function update(db: { zugriffe: { tabelle: string; op: string; daten?: unknown; filter: string[] }[] }, tabelle: string) {
  return db.zugriffe.find((z) => z.tabelle === tabelle && z.op === "update");
}

describe("Einladungscodes für Service-Partner", () => {
  it("das Format ist SV-XXXX-XXXX ohne verwechselbare Zeichen", async () => {
    const { db, mod } = await lade({ antworten: { einladungscodes: { code: "SV-AAAA-BBBB", gueltig_bis: "x" } } });
    const codes: string[] = [];
    for (let i = 0; i < 30; i++) {
      db.zugriffe.length = 0;
      await mod.erzeugeServiceCode();
      codes.push(String(insert(db, "einladungscodes")?.code));
    }
    for (const c of codes) {
      expect(c).toMatch(/^SV-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
      expect(c.slice(3)).not.toMatch(/[01OIL]/);
    }
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("der Code wird mit der Rolle „service“ angelegt, nicht als Mieter-Code", async () => {
    // Ein Rollen-Mix wäre eine Rechteausweitung: Ein Service-Code, der als
    // Mieter-Code einlöst, gäbe Zugriff auf Mietdaten.
    const { db, mod } = await lade({ antworten: { einladungscodes: { code: "SV-A-B", gueltig_bis: "x" } } });
    await mod.erzeugeServiceCode();
    expect(insert(db, "einladungscodes")).toMatchObject({ rolle: "service", vermieter_id: "nutzer-1" });
  });

  it("der Widerruf trifft nur eigene, nicht eingelöste Service-Codes", async () => {
    const { db, mod } = await lade();
    await mod.widerrufeServiceCode("SV-A-B");
    const del = db.zugriffe.find((z) => z.op === "delete");
    expect(del?.filter).toContain("eq:vermieter_id=nutzer-1");
    expect(del?.filter).toContain("eq:rolle=service");
    expect(del?.filter).toContain("is:eingeloest_am=null");
  });

  it("das Lösen einer Partner-Verknüpfung ist auf den eigenen Vermieter begrenzt", async () => {
    const { db, mod } = await lade();
    await mod.entferneServicePartner("sv-1");
    const del = db.zugriffe.find((z) => z.op === "delete");
    expect(del?.filter).toContain("eq:vermieter_id=nutzer-1");
    expect(del?.filter).toContain("eq:user_id=sv-1");
  });
});

describe("Auftrag vom Vermieter: drei Zugehörigkeitsprüfungen", () => {
  const AUFTRAG = { serviceUserId: "sv-1", titel: "Heizung defekt" };

  it("ohne verknüpften Partner entsteht kein Auftrag", async () => {
    const { db, mod } = await lade({ antworten: { service_zugaenge: null } });
    const r = await mod.erstelleAuftrag(fd(AUFTRAG));
    expect(r.error).toContain("nicht gefunden");
    expect(insert(db, "auftraege")).toBeUndefined();
  });

  it("ein fremder Mieter wird NICHT mitgeteilt — der Auftrag entsteht ohne ihn", async () => {
    // Der Mieterkontakt ist ein Opt-in. Läuft die Prüfung ins Leere, darf der
    // Auftrag trotzdem entstehen, aber ohne die Kontaktdaten.
    const { db, mod } = await lade({
      antwortFolge: { mieter: [null], service_zugaenge: [{ user_id: "sv-1" }] },
    });
    const r = await mod.erstelleAuftrag(fd({ ...AUFTRAG, mieterId: "fremder-mieter" }));
    expect(r.ok).toBe(true);
    expect(insert(db, "auftraege")).toMatchObject({ mieter_id: null });
  });

  it("der eigene Mieter wird übernommen", async () => {
    const { db, mod } = await lade({
      antwortFolge: { mieter: [{ id: "m1" }], service_zugaenge: [{ user_id: "sv-1" }] },
    });
    await mod.erstelleAuftrag(fd({ ...AUFTRAG, mieterId: "m1" }));
    expect(insert(db, "auftraege")).toMatchObject({ mieter_id: "m1" });
  });

  it("Mieter- und Objektabfrage filtern auf die eigene user_id", async () => {
    const { db, mod } = await lade({
      antwortFolge: {
        mieter: [{ id: "m1" }],
        service_zugaenge: [{ user_id: "sv-1" }],
        properties: [{ bezeichnung: "Haus", adresse: "Weg 1" }],
      },
    });
    await mod.erstelleAuftrag(fd({ ...AUFTRAG, mieterId: "m1", propId: "p1" }));
    for (const t of ["mieter", "properties"]) {
      expect(db.zugriffe.find((z) => z.tabelle === t)?.filter).toContain("eq:user_id=nutzer-1");
    }
  });

  it("ohne Partner-Auswahl oder ohne Betreff passiert nichts", async () => {
    const { db, mod } = await lade();
    expect((await mod.erstelleAuftrag(fd({ titel: "X" }))).error).toContain("Service-Partner");
    expect((await mod.erstelleAuftrag(fd({ serviceUserId: "sv-1", titel: "   " }))).error).toContain("Betreff");
    expect(db.zugriffe.some((z) => z.op === "insert")).toBe(false);
  });
});

describe("Antrag vom Handwerker: er darf sich nichts selbst freigeben", () => {
  const ANTRAG = { vermieterId: "v-1", titel: "Dach reparieren" };

  it("ein Antrag entsteht IMMER im Status „freigabe“", async () => {
    // Das ist die eigentliche Schranke: Der Handwerker legt an, der Vermieter
    // entscheidet. Ein Antrag, der als „offen“ entstünde, wäre bereits erteilt.
    const { db, mod } = await lade();
    await mod.beantrageAuftrag(fd(ANTRAG));
    expect(insert(db, "auftraege")).toMatchObject({
      status: "freigabe",
      erstellt_von: "service",
      service_user_id: "nutzer-1",
      vermieter_id: "v-1",
    });
  });

  it("ein Status aus dem Formular wird ignoriert", async () => {
    const { db, mod } = await lade();
    await mod.beantrageAuftrag(fd({ ...ANTRAG, status: "erledigt", betrag: "9999" }));
    const zeile = insert(db, "auftraege")!;
    expect(zeile.status).toBe("freigabe");
    expect("betrag" in zeile).toBe(false);
  });

  it("eine Firma, die dem Auftraggeber nicht gehört, bricht den Antrag ab", async () => {
    const { db, mod } = await lade({ antworten: { firmen: null } });
    const r = await mod.beantrageAuftrag(fd({ ...ANTRAG, firmaId: "fremd" }));
    expect(r.error).toContain("gehört nicht zu diesem Auftraggeber");
    expect(insert(db, "auftraege")).toBeUndefined();
  });

  it("Titel und Beschreibung werden gekappt", async () => {
    const { db, mod } = await lade();
    await mod.beantrageAuftrag(fd({ ...ANTRAG, titel: "T".repeat(500), beschreibung: "B".repeat(5000) }));
    const zeile = insert(db, "auftraege")!;
    expect(String(zeile.titel)).toHaveLength(200);
    expect(String(zeile.beschreibung)).toHaveLength(2000);
  });
});

describe("Freigabe durch den Vermieter", () => {
  it("entschieden wird nur, was im Status „freigabe“ steht und einem gehört", async () => {
    const { db, mod } = await lade({ antworten: { auftraege: { id: "a1" } } });
    await mod.entscheideAuftrag("a1", true);
    const upd = update(db, "auftraege")!;
    expect(upd.daten).toMatchObject({ status: "offen" });
    expect(upd.filter).toContain("eq:vermieter_id=nutzer-1");
    expect(upd.filter).toContain("eq:status=freigabe"); // kein erneutes Entscheiden
  });

  it("Ablehnen setzt „nicht_freigegeben“", async () => {
    const { db, mod } = await lade({ antworten: { auftraege: { id: "a1" } } });
    await mod.entscheideAuftrag("a1", false);
    expect(update(db, "auftraege")?.daten).toMatchObject({ status: "nicht_freigegeben" });
  });

  it("ein fremder Mieter bricht die Freigabe ganz ab", async () => {
    // Bewusst strenger als beim Anlegen: Wer hier einen Mieter auswählt, will
    // dessen Kontakt teilen. Geht das schief, darf nicht stillschweigend ohne
    // Kontakt freigegeben werden.
    const { db, mod } = await lade({ antworten: { mieter: null } });
    const r = await mod.entscheideAuftrag("a1", true, "fremd");
    expect(r.error).toContain("Freigabe abgebrochen");
    expect(update(db, "auftraege")).toBeUndefined();
  });

  it("greift die Bedingung nicht (nichts geändert), gibt es eine Fehlermeldung", async () => {
    const { mod } = await lade({ antworten: { auftraege: null } });
    expect((await mod.entscheideAuftrag("a1", true)).error).toBeTruthy();
  });
});

describe("Rückmeldung des Handwerkers", () => {
  const OK = { antworten: { auftraege: { id: "a1" } } };

  it("nur die drei erlaubten Status kommen durch", async () => {
    const { db, mod } = await lade(OK);
    for (const s of ["angenommen", "erledigt", "abgelehnt"]) {
      expect((await mod.beantworteAuftrag(fd({ id: "a1", status: s }))).ok).toBe(true);
    }
    for (const s of ["freigabe", "offen", "geloescht", ""]) {
      expect((await mod.beantworteAuftrag(fd({ id: "a1", status: s }))).error).toContain("Ungültige Eingabe");
    }
    expect(db.zugriffe.filter((z) => z.op === "update")).toHaveLength(3);
  });

  it("beantwortbar sind nur freigegebene Aufträge — die Freigabe ist nicht umgehbar", async () => {
    const { db, mod } = await lade(OK);
    await mod.beantworteAuftrag(fd({ id: "a1", status: "erledigt" }));
    const upd = update(db, "auftraege")!;
    expect(upd.filter).toContain("eq:service_user_id=nutzer-1");
    // `in` speichert die Liste im Wert — deshalb auf den Anfang prüfen.
    expect(upd.filter.some((f) => f.startsWith("in:status"))).toBe(true);
  });

  it("deutsche und englische Beträge werden gelesen — auch Tausenderpunkte", async () => {
    // Der Fund vom 04.09.2026: "1.000" ergab 1, "12.345" ergab 12,35. Aus
    // tausend Euro wurde ein Euro, und das in einer Zahl, die anschliessend
    // als Kosten gebucht wird.
    for (const [eingabe, erwartet] of [
      ["1.234,56", 1234.56],
      ["1234.56", 1234.56],
      ["1234,5", 1234.5],
      ["89 €", 89],
      ["1.000", 1000],
      ["12.345", 12345],
      ["1.234.567", 1234567],
      ["0.5", 0.5],
      ["1234", 1234],
      // Führende Null: bleibt ein halber Euro, wird NICHT zu 500.
      ["0.500", 0.5],
    ] as const) {
      vi.resetModules();
      const { db, mod } = await lade(OK);
      await mod.beantworteAuftrag(fd({ id: "a1", status: "erledigt", betrag: String(eingabe) }));
      expect(update(db, "auftraege")?.daten).toMatchObject({ betrag: erwartet });
    }
  });

  it("ein Lohnanteil über dem Gesamtbetrag wird abgelehnt", async () => {
    // § 35a: Der Lohnanteil wandert in die NK-Abrechnung des Mieters. Ein
    // Anteil größer als das Ganze wäre dort eine falsche Bescheinigung.
    const { db, mod } = await lade(OK);
    const r = await mod.beantworteAuftrag(fd({ id: "a1", status: "erledigt", betrag: "100", lohnanteil: "150" }));
    expect(r.error).toContain("nicht über dem Gesamtbetrag");
    expect(db.zugriffe.some((z) => z.op === "update")).toBe(false);
  });

  it("ein Lohnanteil ohne Gesamtbetrag wird abgelehnt", async () => {
    const { mod } = await lade(OK);
    expect((await mod.beantworteAuftrag(fd({ id: "a1", status: "erledigt", lohnanteil: "50" }))).error).toContain(
      "ohne Gesamtbetrag",
    );
  });

  it("Rechnung: über 4 MB oder falscher Typ wird abgelehnt", async () => {
    const { db, mod } = await lade(OK);
    const gross = new File([new Uint8Array(4 * 1024 * 1024 + 1)], "r.pdf", { type: "application/pdf" });
    expect((await mod.beantworteAuftrag(fd({ id: "a1", status: "erledigt", rechnung: gross }))).error).toContain("4 MB");
    const falsch = new File([new Uint8Array(10)], "r.exe", { type: "application/x-msdownload" });
    expect((await mod.beantworteAuftrag(fd({ id: "a1", status: "erledigt", rechnung: falsch }))).error).toContain(
      "nur Fotos",
    );
    expect(db.zugriffe.some((z) => z.op === "update")).toBe(false);
  });

  it("Beträge zählen nur beim Erledigen, nicht beim Annehmen", async () => {
    const { db, mod } = await lade(OK);
    await mod.beantworteAuftrag(fd({ id: "a1", status: "angenommen", betrag: "500" }));
    expect(Object.keys((update(db, "auftraege")?.daten ?? {}) as Record<string, unknown>)).not.toContain("betrag");
  });
});

describe("Übernahme als Kosten: der Punkt, an dem Geld entsteht", () => {
  const ERLEDIGT = {
    titel: "Heizung",
    objekt_name: "Haus",
    prop_id: "p1",
    betrag: 500,
    lohnanteil: 200,
    rechnung_name: null,
    rechnung_type: null,
    rechnung_data: null,
    kosten_id: null,
    status: "erledigt",
    service_user_id: "sv-1",
  };

  function laden(over: Record<string, unknown> = {}) {
    return {
      antwortFolge: {
        auftraege: [{ ...ERLEDIGT, ...over }],
        service_zugaenge: [{ firma: "Meier GmbH", email: null }],
        kosten: [{ id: "k1" }],
      },
    };
  }

  it("ein bereits übernommener Auftrag wird NICHT ein zweites Mal gebucht", async () => {
    // Ohne diese Sperre entstünde bei jedem Klick eine weitere Kosten-Buchung —
    // dieselbe Rechnung mehrfach in der Steuerauswertung.
    const { db, mod } = await lade(laden({ kosten_id: "k-alt" }));
    const r = await mod.uebernimmAuftragAlsKosten(fd({ id: "a1" }));
    expect(r.error).toContain("bereits als Kosten erfasst");
    expect(insert(db, "kosten")).toBeUndefined();
  });

  it("nur erledigte Aufträge lassen sich übernehmen", async () => {
    const { db, mod } = await lade(laden({ status: "angenommen" }));
    expect((await mod.uebernimmAuftragAlsKosten(fd({ id: "a1" }))).error).toContain("Nur erledigte");
    expect(insert(db, "kosten")).toBeUndefined();
  });

  it("ohne Betrag wird nichts gebucht", async () => {
    const { db, mod } = await lade(laden({ betrag: 0 }));
    expect((await mod.uebernimmAuftragAlsKosten(fd({ id: "a1" }))).error).toContain("keinen Betrag");
    expect(insert(db, "kosten")).toBeUndefined();
  });

  it("der Auftrag wird nur im eigenen Bestand gesucht", async () => {
    const { db, mod } = await lade({ antworten: { auftraege: null } });
    const r = await mod.uebernimmAuftragAlsKosten(fd({ id: "fremd" }));
    expect(r.error).toContain("nicht gefunden");
    expect(db.zugriffe[0].filter).toContain("eq:vermieter_id=nutzer-1");
  });

  it("die Kategorie kommt aus einer Weißliste", async () => {
    const { db, mod } = await lade(laden());
    await mod.uebernimmAuftragAlsKosten(fd({ id: "a1", kategorie: "Freitext" }));
    expect(insert(db, "kosten")).toMatchObject({ kategorie: "Reparatur" });
  });

  it("der Lohnanteil landet als § 35a-Notiz in der Buchung", async () => {
    const { db, mod } = await lade(laden());
    await mod.uebernimmAuftragAlsKosten(fd({ id: "a1", kategorie: "Instandhaltung" }));
    const k = insert(db, "kosten")!;
    expect(k).toMatchObject({ kategorie: "Instandhaltung", betrag: 500, user_id: "nutzer-1" });
    expect(String(k.notiz)).toContain("200.00 €");
    expect(String(k.notiz)).toContain("§ 35a");
    expect(String(k.notiz)).toContain("Meier GmbH");
  });

  it("nach dem Buchen wird der Auftrag als übernommen markiert", async () => {
    // Sonst greift die Doppel-Sperre beim nächsten Klick nicht.
    const { db, mod } = await lade(laden());
    await mod.uebernimmAuftragAlsKosten(fd({ id: "a1" }));
    const upd = update(db, "auftraege")!;
    expect(upd.daten).toEqual({ kosten_id: "k1" });
    expect(upd.filter).toContain("eq:vermieter_id=nutzer-1");
  });

  it("Löschen trifft nur eigene Aufträge", async () => {
    const { db, mod } = await lade();
    await mod.loescheAuftrag("a1");
    expect(db.zugriffe.find((z) => z.op === "delete")?.filter).toContain("eq:vermieter_id=nutzer-1");
  });
});
