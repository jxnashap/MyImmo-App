import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { speicherDb } from "./stubs/speicherDb";
import { baueVollexport, EXPORT_TABELLEN, EXPORT_AUSNAHMEN, sichererName, type ExportDb } from "@/lib/export/vollexport";

// B05 (Prüfstand 11.10.2026): Vollständiger Export. Geprüft wird am echten ZIP — entpackt, gelesen,
// gegen das Manifest gerechnet —, nicht an einer Textsuche im Quelltext.

const U = "nutzer-1";
const ANDERER = "fremd-1";
const KEY = process.env.DATA_ENCRYPTION_KEY;
beforeEach(() => { process.env.DATA_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString("base64"); });
afterEach(() => { if (KEY === undefined) delete process.env.DATA_ENCRYPTION_KEY; else process.env.DATA_ENCRYPTION_KEY = KEY; });

const b64 = (s: string) => Buffer.from(s).toString("base64");
async function exportiere(init: Parameters<typeof speicherDb>[0], rolle: "vermieter" | "mieter" | "service" = "vermieter") {
  const { client } = speicherDb(init);
  const e = await baueVollexport(client as unknown as ExportDb, U, rolle, "2026-10-11", new Date("2026-10-11T10:00:00Z"));
  const zip = await JSZip.loadAsync(e.zip);
  const text = async (p: string) => (await zip.file(p)?.async("string")) ?? null;
  return { ...e, roh: e.zip, zip, text };
}

describe("Vollständigkeit der Tabellenliste", () => {
  it("jede Tabelle aus den Migrationen ist exportiert oder begründet ausgenommen", () => {
    const ORDNER = "supabase/migrations";
    const tabellen = new Set<string>();
    for (const f of readdirSync(ORDNER).filter((x) => x.endsWith(".sql"))) {
      const sql = readFileSync(`${ORDNER}/${f}`, "utf8");
      for (const m of sql.matchAll(/create table (?:if not exists )?(?:public\.)?([a-z_0-9]+)\s*(?:\(|as)/gi)) tabellen.add(m[1].toLowerCase());
    }
    expect(tabellen.size).toBeGreaterThan(50); // der Wächter hat hingesehen
    const exportiert = new Set(Object.values(EXPORT_TABELLEN).flat().map((t) => t.name));
    const offen = [...tabellen].filter((t) => !exportiert.has(t) && !(t in EXPORT_AUSNAHMEN));
    expect(offen, `ohne Export und ohne Begründung: ${offen.join(", ")}`).toEqual([]);
    for (const [t, grund] of Object.entries(EXPORT_AUSNAHMEN)) expect(grund.length, t).toBeGreaterThan(10);
  });
});

describe("Export: Tabellen", () => {
  it("lädt MEHR als 1.000 Zeilen vollständig (PostgREST schneidet ohne range still ab)", async () => {
    const kosten = Array.from({ length: 2345 }, (_, i) => ({ id: `k${String(i).padStart(5, "0")}`, user_id: U, betrag: i }));
    kosten.push({ id: "kfremd", user_id: ANDERER, betrag: 1 });
    const e = await exportiere({ tabellen: { kosten } });
    expect(e.manifest.tabellen.find((t) => t.name === "kosten")).toEqual({ name: "kosten", zeilen: 2345 });
    const csv = (await e.text("daten/kosten.csv"))!;
    expect(csv.split("\n")).toHaveLength(2346); // Kopf + 2345
    expect(csv).toContain("k02344");
    expect(csv).not.toContain("kfremd");
    expect(e.manifest.vollstaendig).toBe(true);
    expect(e.dateiname).toBe("myimmo-export-2026-10-11.zip");
  });

  it("bricht eine Seite ab, ist der Export UNVOLLSTÄNDIG — im Manifest, im Dateinamen und im LIESMICH", async () => {
    const kosten = Array.from({ length: 1500 }, (_, i) => ({ id: `k${String(i).padStart(5, "0")}`, user_id: U }));
    const e = await exportiere({ tabellen: { kosten }, fehlerAbSeite: { kosten: 1 } });
    expect(e.manifest.vollstaendig).toBe(false);
    expect(e.manifest.tabellen.find((t) => t.name === "kosten")).toMatchObject({ zeilen: 0, fehler: expect.stringMatching(/Seite 1/) });
    expect(e.dateiname).toBe("myimmo-export-UNVOLLSTAENDIG-2026-10-11.zip");
    expect(await e.text("LIESMICH.txt")).toMatch(/^ACHTUNG: DIESER EXPORT IST UNVOLLSTÄNDIG/);
    // Kein halbes CSV, das wie vollständig aussähe.
    expect(e.zip.file("daten/kosten.csv")).toBeNull();
  });

  it("die neuen Tabellen sind drin (Nebenkosten am Objekt, Sanierung, Zustellungen, Vertreter …)", async () => {
    const t = (name: string, extra = {}) => [{ id: `${name}-1`, user_id: U, vermieter_id: U, ...extra }];
    const e = await exportiere({ tabellen: {
      nk_objekt_jahr: t("nk_objekt_jahr"), nk_objekt_kosten: t("nk_objekt_kosten"), sanierungsprojekte: t("sanierungsprojekte", { daten: { raeume: 3 } }),
      zustellungen: t("zustellungen"), vertreter: t("vertreter"), freigabe_termine: t("freigabe_termine"),
    } });
    for (const n of ["nk_objekt_jahr", "nk_objekt_kosten", "sanierungsprojekte", "zustellungen", "vertreter", "freigabe_termine"]) {
      expect(e.manifest.tabellen.find((x) => x.name === n)?.zeilen, n).toBe(1);
    }
    // JSON-Spalten bleiben Daten (früher wurde „daten“ pauschal als Datei ausgeblendet).
    const json = JSON.parse((await e.text("daten/alles.json"))!);
    expect(json.sanierungsprojekte[0].daten).toEqual({ raeume: 3 });
  });

  it("Kind-Tabellen kommen über ihre Eltern (Anhänge und Verlauf eines Anliegens)", async () => {
    const e = await exportiere({ tabellen: {
      anliegen: [{ id: "a1", vermieter_id: U }, { id: "a2", vermieter_id: ANDERER }],
      anliegen_dateien: [{ id: "d1", anliegen_id: "a1", name: "Wasser.jpg", daten: b64("BILD-1") }, { id: "d2", anliegen_id: "a2", name: "x.jpg", daten: b64("FREMD") }],
      anliegen_ereignisse: [{ id: "e1", anliegen_id: "a1" }, { id: "e2", anliegen_id: "a2" }],
    } });
    expect(e.manifest.tabellen.find((t) => t.name === "anliegen_dateien")?.zeilen).toBe(1);
    expect(e.manifest.tabellen.find((t) => t.name === "anliegen_ereignisse")?.zeilen).toBe(1);
    expect(await e.text("dateien/anliegen_dateien/d1_Wasser.jpg")).toBe("BILD-1");
    expect(Object.keys(e.zip.files).some((p) => p.includes("d2"))).toBe(false);
  });

  it("verschlüsselte Felder kommen entschlüsselt heraus, der Blind-Index nicht", async () => {
    const { encrypt } = await import("@/lib/crypto/secure");
    const e = await exportiere({ tabellen: { ibans: [{ id: "i1", user_id: U, iban: encrypt("DE02120300000000202051"), inhaber: encrypt("Max"), iban_bidx: "abc" }] } });
    const json = JSON.parse((await e.text("daten/alles.json"))!);
    expect(json.ibans[0]).toMatchObject({ iban: "DE02120300000000202051", inhaber: "Max" });
    expect(json.ibans[0]).not.toHaveProperty("iban_bidx");
  });
});

describe("Export: Dateien", () => {
  it("zwei Dateien mit GLEICHEM Namen überschreiben sich nicht", async () => {
    const e = await exportiere({ tabellen: { notizen: [
      { id: "n1", user_id: U, datei_name: "Rechnung.pdf", datei_data: `data:application/pdf;base64,${b64("ERSTE")}` },
      { id: "n2", user_id: U, datei_name: "Rechnung.pdf", datei_data: b64("ZWEITE") },
    ] } });
    expect(await e.text("dateien/notizen/n1_Rechnung.pdf")).toBe("ERSTE");
    expect(await e.text("dateien/notizen/n2_Rechnung.pdf")).toBe("ZWEITE");
    // Die CSV-Zelle nennt genau den Pfad im ZIP — die Referenz bleibt nachvollziehbar.
    expect(await e.text("daten/notizen.csv")).toContain("(Datei: dateien/notizen/n1_Rechnung.pdf)");
  });

  it("Sonderzeichen und Pfad-Tricks bleiben im eigenen Ordner", async () => {
    expect(sichererName("../../etc/passwd")).toBe("etc_passwd");
    expect(sichererName("Ümläut & Co: Beleg?.pdf")).toBe("Ümläut _ Co_ Beleg_.pdf");
    const e = await exportiere({ tabellen: { notizen: [{ id: "n1", user_id: U, datei_name: "../../x.pdf", datei_data: b64("X") }] } });
    const pfade = Object.keys(e.zip.files);
    expect(pfade.every((p) => !p.includes(".."))).toBe(true);
    expect(pfade).toContain("dateien/notizen/n1_x.pdf");
  });

  it("Belege im Storage werden geladen; jede Datei hat Größe und SHA-256 im Manifest", async () => {
    const e = await exportiere({
      tabellen: { kosten: [{ id: "k1", user_id: U, rechnung_path: `${U}/abc.pdf` }] },
      dateien: { belege: { [`${U}/abc.pdf`]: "PDF-INHALT" } },
    });
    const eintrag = e.manifest.dateien.find((d) => d.id === "k1")!;
    expect(eintrag).toMatchObject({ pfad: "dateien/kosten/k1_beleg_abc.pdf", groesse: 10 });
    const bytes = await e.zip.file("dateien/kosten/k1_beleg_abc.pdf")!.async("uint8array");
    expect(createHash("sha256").update(bytes).digest("hex")).toBe((eintrag as { sha256: string }).sha256);
    expect(e.manifest.vollstaendig).toBe(true);
  });

  it("ein FEHLENDER Storage-Beleg wird nicht still übersprungen", async () => {
    const e = await exportiere({ tabellen: { kosten: [{ id: "k1", user_id: U, rechnung_path: `${U}/weg.pdf` }] } });
    expect(e.manifest.vollstaendig).toBe(false);
    expect(e.manifest.dateien).toContainEqual({ pfad: null, quelle: "belege:kosten.rechnung_path", id: "k1", fehler: "Object not found" });
    expect(await e.text("daten/kosten.csv")).toContain("Datei fehlt");
    expect(e.dateiname).toMatch(/UNVOLLSTAENDIG/);
  });

  it("eine kaputte Base64-Datei wird gemeldet, nicht leer abgelegt", async () => {
    const e = await exportiere({ tabellen: { notizen: [{ id: "n1", user_id: U, datei_name: "a.pdf", datei_data: "%%%kein base64%%%" }] } });
    expect(e.manifest.vollstaendig).toBe(false);
    expect(e.manifest.dateien[0]).toMatchObject({ pfad: null, id: "n1" });
  });

  it("verschlüsselte Dateien (Bewerbungsunterlagen) liegen entschlüsselt im ZIP", async () => {
    const { encrypt } = await import("@/lib/crypto/secure");
    const e = await exportiere({ tabellen: { bewerbung_dateien: [{ id: "b1", user_id: U, name: "Ausweis.pdf", data: encrypt(`data:application/pdf;base64,${b64("AUSWEIS")}`) }] } });
    expect(await e.text("dateien/bewerbung_dateien/b1_Ausweis.pdf")).toBe("AUSWEIS");
  });

  it("ein unterbrochener Download ist erkennbar: abgeschnittenes ZIP lässt sich nicht öffnen", async () => {
    const e = await exportiere({ tabellen: { notizen: [{ id: "n1", user_id: U, datei_name: "a.pdf", datei_data: b64("A".repeat(5000)) }] } });
    await expect(JSZip.loadAsync(e.roh.slice(0, Math.floor(e.roh.length / 2)))).rejects.toThrow();
    // und eine veränderte Datei verrät sich an der Prüfsumme im Manifest
    const eintrag = e.manifest.dateien[0] as { sha256: string };
    expect(createHash("sha256").update("A".repeat(4999) + "B").digest("hex")).not.toBe(eintrag.sha256);
    expect(createHash("sha256").update("A".repeat(5000)).digest("hex")).toBe(eintrag.sha256);
  });
});

describe("Export: Rollen", () => {
  it("Mieter: nur der eigene Zugang — keine Objekte, keine Mieterstammdaten", async () => {
    const e = await exportiere({ tabellen: {
      properties: [{ id: "p1", user_id: U, kaufpreis: 1 }],
      anliegen: [{ id: "a1", mieter_user_id: U, vermieter_id: "v" }, { id: "a2", mieter_user_id: ANDERER }],
    } }, "mieter");
    expect(e.manifest.tabellen.map((t) => t.name)).not.toContain("properties");
    expect(e.manifest.tabellen.find((t) => t.name === "anliegen")?.zeilen).toBe(1);
    expect(await e.text("LIESMICH.txt")).toMatch(/Auskunftsersuchen/);
  });
});
