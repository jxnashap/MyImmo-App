import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";

// STILLE SCHREIBFEHLER — der dritte Durchgang (08.09.2026).
//
// Nach den Zahlen-Eingängen und der Datei-Auslieferung war dies die dritte
// Klasse, bei der ein Fehler nicht auffällt, sondern SCHWEIGT.
//
// AUSGANGSLAGE: 128 Schreiboperationen in `lib/actions/`, davon **20**, die den
// `error` der Datenbank gar nicht erst ausgewertet haben und anschließend
// bedingungslos `{ ok: true }` zurückgaben. Die Oberfläche meldete „gespeichert"
// bzw. „widerrufen", während die Datenbank nichts getan hatte.
//
// DIE VIER STELLEN, BEI DENEN DAS MEHR ALS KOSMETIK WAR
//   · `widerrufeServiceCode`      — Code gilt als widerrufen, ist aber weiter gültig
//   · `widerrufeEinladung`        — dasselbe beim Mieter-Zugangscode
//   · `erzeugeEinladungscode`     — alter Code wird nicht gelöscht → ZWEI gültige Codes
//   · `uebernimmAuftragAlsKosten` — `kosten_id` nicht gesetzt → beim nächsten Klick
//                                   eine ZWEITE Kosten-Buchung (die Doppelbuchung
//                                   aus `mietkonto.ts`, nur an anderer Stelle)
//
// WAS DER DURCHGANG NICHT GEFUNDEN HAT — und das ist ein Ergebnis, kein
// Nicht-Ergebnis: Ein Schreibzugriff über Mandantengrenzen hinweg ist nicht
// möglich. Am 08.09.2026 live gegen die Datenbank geprüft: alle 45 Tabellen in
// `public` haben RLS aktiv, und jede der Tabellen, in die `lib/actions/` nur
// über `.eq("id", …)` schreibt, hat eine UPDATE/DELETE-Policy auf
// `auth.uid() = user_id` (bzw. `vermieter_id`). Die 38 Schreibzugriffe ohne
// eigenen Mandantenfilter sind dadurch abgesichert.
//
// BEWUSST NICHT UMGESETZT: „0 betroffene Zeilen" als Fehler zu werten. Ein per
// RLS geblocktes UPDATE liefert keinen Fehler, sondern null Zeilen — das gilt
// aber auch für ein Löschen, das jemand zweimal auslöst, und für das
// Demo-Konto, dessen Sperre genau so funktioniert. Aus „nichts getroffen" einen
// Fehler zu machen, würde harmlose Fälle zu Fehlermeldungen erheben. Der
// Mandantenfilter steht stattdessen jetzt AUSDRÜCKLICH in der Abfrage, wo er
// gefehlt hat (`deleteIban`, `deleteProperty`).

const ORDNER = "lib/actions";

/** Anweisungen an ';' auf Klammertiefe 0 trennen (Klammern, nicht Blöcke). */
function anweisungen(text: string): string[] {
  const out: string[] = [];
  let tiefe = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "(") tiefe++;
    else if (c === ")") tiefe--;
    else if (c === ";" && tiefe === 0) {
      out.push(text.slice(start, i + 1));
      start = i + 1;
    }
  }
  return out;
}

/** Schreibanweisungen, die den Fehler der Datenbank nirgends erwähnen. */
function stilleSchreibvorgaenge(quelle: string): string[] {
  return anweisungen(quelle)
    .filter((a) => /\.(update|delete|upsert|insert)\(/.test(a) && a.includes(".from("))
    .filter((a) => !/\berror\b/.test(a))
    .map((a) => a.trim().replace(/\s+/g, " ").slice(0, 100));
}

describe("Kein Schreibvorgang in lib/actions/ verschluckt den Fehler", () => {
  const dateien = readdirSync(ORDNER).filter((n) => n.endsWith(".ts"));

  it("jede Schreiboperation wertet den Fehler aus", () => {
    // Wird dieser Test rot: NICHT die Zeile hier eintragen, sondern den Fehler
    // behandeln. Eine Action, die `{ ok: true }` meldet, ohne den Schreibvorgang
    // geprüft zu haben, behauptet etwas über die Datenbank, das sie nicht weiß.
    const still: string[] = [];
    for (const n of dateien) {
      for (const a of stilleSchreibvorgaenge(readFileSync(join(ORDNER, n), "utf8"))) {
        still.push(`${n}: ${a}`);
      }
    }
    expect(still).toEqual([]);
  });

  it("es gibt überhaupt Schreiboperationen zu prüfen", () => {
    // Sicherung gegen einen Erkenner, der nach einem Umbau nichts mehr findet
    // und deshalb schweigend grün bleibt. Stand 08.09.2026: 128.
    const anzahl = dateien
      .map((n) => readFileSync(join(ORDNER, n), "utf8"))
      .flatMap(anweisungen)
      .filter((a) => /\.(update|delete|upsert|insert)\(/.test(a) && a.includes(".from(")).length;
    expect(anzahl).toBeGreaterThan(100);
  });
});

describe("Die Oberfläche wirft das Ergebnis nicht weg", () => {
  // ZWEITE HÄLFTE DESSELBEN FEHLERS: Server-seitig den Fehler zurückzugeben
  // nützt nichts, solange der Aufrufer ihn verwirft. Alle DeleteButton-Stellen
  // riefen die Action als `async () => { await x(); }` auf — die Rückgabe fiel
  // dabei weg, und der Knopf meldete anschließend „Gelöscht.".
  function tsx(ordner: string): string[] {
    return readdirSync(ordner, { withFileTypes: true }).flatMap((e) => {
      const p = join(ordner, e.name);
      return e.isDirectory() ? tsx(p) : e.name.endsWith(".tsx") ? [p] : [];
    });
  }

  it("keine Action wird als `async () => { await … }` verworfen", () => {
    const treffer: string[] = [];
    for (const p of [...tsx("components"), ...tsx("app")]) {
      const s = readFileSync(p, "utf8");
      for (const m of s.matchAll(/action=\{async \(\) => \{ await [^}]*\}\}/g)) {
        treffer.push(`${p}: ${m[0].slice(0, 70)}`);
      }
    }
    expect(treffer).toEqual([]);
  });

  it("DeleteButton wertet die Rückgabe über actionFehler() aus", () => {
    // Der Knopf fing bisher nur GEWORFENE Fehler. Server-Actions melden aber
    // per Rückgabewert — beides muss er auswerten.
    const s = readFileSync("components/DeleteButton.tsx", "utf8");
    expect(s).toContain("actionFehler(await action())");
  });

  it("actionFehler() unterscheidet Fehler von Erfolg", async () => {
    // Die eigentliche Entscheidung, ohne DOM prüfbar. Der Texttest darüber
    // hält nur fest, DASS der Knopf sie benutzt.
    const { actionFehler } = await import("@/lib/actionErgebnis");
    expect(actionFehler({ error: "Ging nicht." })).toBe("Ging nicht.");
    expect(actionFehler({ error: { message: "22008" } })).toBe("22008");
    for (const ok of [undefined, null, { ok: true }, { error: null }, { error: "" }, { error: "  " }]) {
      expect(actionFehler(ok), JSON.stringify(ok)).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------

beforeEach(() => vi.resetModules());
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) {
    vi.doUnmock(m);
  }
});

async function lade(modul: string, init: Parameters<typeof fakeSupabase>[0] = {}) {
  const { db, client } = fakeSupabase(init);
  const spuren = mockeNextUndSupabase(client);
  const mod = await import(modul);
  return { db, spuren, mod };
}

const FEHLER = { message: "connection reset" };

describe("Widerruf eines Zugangscodes", () => {
  it("scheitert das Löschen, wird KEIN Erfolg gemeldet", async () => {
    // Der Kern der Sache: „widerrufen" zu melden, während der Code weiterhin
    // eingelöst werden kann, ist schlimmer als eine Fehlermeldung.
    const { mod } = await lade("@/lib/actions/service", { fehlerBei: { einladungscodes: FEHLER } });
    const r = await mod.widerrufeServiceCode("MI-AAAA-BBBB");
    expect(r.ok).toBeUndefined();
    expect(String(r.error)).toMatch(/gültig/i);
  });

  it("im Normalfall wird widerrufen und die Seite neu geladen", async () => {
    const { db, spuren, mod } = await lade("@/lib/actions/service");
    const r = await mod.widerrufeServiceCode("MI-AAAA-BBBB");
    expect(r).toEqual({ ok: true });
    const z = db.zugriffe.find((x) => x.tabelle === "einladungscodes")!;
    expect(z.op).toBe("delete");
    // Auf den eigenen Vermieter eingeschränkt und nur auf uneingelöste Codes.
    expect(z.filter).toContain("eq:vermieter_id=nutzer-1");
    expect(z.filter).toContain("is:eingeloest_am=null");
    expect(spuren.revalidiert).toContain("/anliegen");
  });

  it("dasselbe beim Mieter-Zugangscode", async () => {
    const { mod } = await lade("@/lib/actions/einladung", { fehlerBei: { einladungscodes: FEHLER } });
    const r = await mod.widerrufeEinladung("mieter-1");
    expect(r.ok).toBeUndefined();
    expect(String(r.error)).toMatch(/gültig/i);
  });
});

describe("Neuer Mieter-Einladungscode", () => {
  it("kann der alte Code nicht gelöscht werden, wird kein neuer angelegt", async () => {
    // Sonst gäbe es zwei gültige Codes für denselben Mieter — und der alte ist
    // womöglich längst weitergegeben.
    const { db, mod } = await lade("@/lib/actions/einladung", {
      antworten: { mieter: { id: "mieter-1", prop_id: "obj-1", user_id: "nutzer-1" } },
      fehlerBei: { "einladungscodes:delete": FEHLER },
    });
    const r = await mod.erzeugeEinladungscode("mieter-1");
    expect(r.error).toBeTruthy();
    expect(db.zugriffe.some((x) => x.tabelle === "einladungscodes" && x.op === "insert")).toBe(false);
  });

  it("im Normalfall wird der alte ersetzt und ein neuer angelegt", async () => {
    const { db, mod } = await lade("@/lib/actions/einladung", {
      antworten: { mieter: { id: "mieter-1", prop_id: "obj-1", user_id: "nutzer-1" } },
      antwortFolge: { "einladungscodes:insert": [{ code: "MI-1234-5678", gueltig_bis: "2026-12-31" }] },
    });
    const r = await mod.erzeugeEinladungscode("mieter-1");
    expect(r.code).toBe("MI-1234-5678");
    const ops = db.zugriffe.filter((x) => x.tabelle === "einladungscodes").map((x) => x.op);
    expect(ops).toEqual(["delete", "insert"]);
  });
});

describe("Auftrag als Kosten verbuchen", () => {
  it("bleibt die Verknüpfung ungeschrieben, wird gewarnt statt Erfolg gemeldet", async () => {
    // Ohne `kosten_id` hält der Auftrag sich für unverbucht: Der nächste Klick
    // legt eine ZWEITE Kosten-Buchung an. Das ist der Doppelbuchungs-Fehler aus
    // `mietkonto.ts` an anderer Stelle.
    const { db, mod } = await lade("@/lib/actions/service", {
      antwortFolge: {
        "auftraege:select": [
          { titel: "Heizung", prop_id: "obj-1", betrag: 100, status: "erledigt", kosten_id: null },
        ],
        "kosten:insert": [{ id: "k1" }],
      },
      fehlerBei: { "auftraege:update": FEHLER },
    });
    const r = await mod.uebernimmAuftragAlsKosten(fd({ id: "a1", kategorie: "Reparatur" }));
    expect(r.ok).toBeUndefined();
    expect(String(r.error)).toMatch(/zugeordnet|prüfen/i);
    // Die Kosten-Buchung selbst wurde angelegt — darauf weist die Meldung hin.
    expect(db.zugriffe.some((x) => x.tabelle === "kosten" && x.op === "insert")).toBe(true);
  });
});

describe("Mandantenfilter dort, wo er gefehlt hat", () => {
  it("deleteIban schränkt auf die eigene user_id ein", async () => {
    const { db, mod } = await lade("@/lib/actions/ibans");
    await mod.deleteIban("iban-1");
    const z = db.zugriffe.find((x) => x.tabelle === "ibans" && x.op === "delete")!;
    expect(z.filter).toContain("eq:user_id=nutzer-1");
  });

  it("deleteProperty schränkt auf die eigene user_id ein", async () => {
    const { db, mod } = await lade("@/lib/actions/properties");
    await mod.deleteProperty("obj-1").catch(() => {}); // endet mit redirect()
    const z = db.zugriffe.find((x) => x.tabelle === "properties" && x.op === "delete")!;
    expect(z.filter).toContain("eq:user_id=nutzer-1");
  });
});

describe("Objekt speichern: gescheiterte Buchungsvorlagen werden gemeldet", () => {
  it("die Erfolgsmeldung enthält einen Hinweis, wenn die Vorlage nicht angelegt wurde", async () => {
    // Ohne Miet-Vorlage fehlt die Einnahme im Cashflow. Das Objekt IST
    // gespeichert — deshalb kein Abbruch, aber auch kein wortloses „gespeichert".
    const { spuren, mod } = await lade("@/lib/actions/properties", {
      fehlerBei: { wiederkehrende_buchungen: FEHLER },
    });
    await mod
      .updateProperty("obj-1", fd({ bezeichnung: "Haus A", obj_status: "Vermietet", miete: "800" }))
      .catch(() => {});
    const ziel = spuren.redirects.at(-1)!;
    expect(decodeURIComponent(ziel)).toMatch(/Buchungsvorlagen konnten nicht/);
  });

  it("ohne Fehler steht nur die normale Meldung da", async () => {
    const { spuren, mod } = await lade("@/lib/actions/properties");
    await mod
      .updateProperty("obj-1", fd({ bezeichnung: "Haus A", obj_status: "Vermietet", miete: "800" }))
      .catch(() => {});
    const ziel = decodeURIComponent(spuren.redirects.at(-1)!);
    expect(ziel).toMatch(/Immobilie gespeichert/);
    expect(ziel).not.toMatch(/Buchungsvorlagen/);
  });
});
