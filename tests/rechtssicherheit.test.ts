// Rechtssicherheit (21.10.2026): kleine Korrekturen an Wortlaut, Hinweisen und einer Sperre —
// keine neuen Funktionen. Je Punkt der Arbeitsliste ein Block; wo es geht, wird das VERHALTEN
// geprüft (Rechnung, PDF, Action), sonst die eine Stelle im Quelltext, die es trägt.
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fakeSupabase, mockeNextUndSupabase } from "./stubs/actionHarness";
import { pdfTexte, pdfZeilen } from "./stubs/pdfText";
import {
  berechneNk, CO2_FEHLT_HINWEIS, MESSDIENST_HINWEIS, VOLL_HINWEIS, VOLL_SCHLUESSEL,
  type NkRawPosition, type NkTenant,
} from "@/lib/nk";
import { verteileObjektKosten, type NkObjektKosten } from "@/lib/nkObjekt";
import { buildNkPdf } from "@/lib/pdf/nkPdf";
import { EINWILLIGUNG_VERSION, EINWILLIGUNGSTEXT, EINWILLIGUNGSTEXT_START, bestaetigungsMail } from "@/lib/newsletter";
import { einladungsMail, verantwortlichSatz, PROFILNAME_FEHLT, DATENSCHUTZ_URL } from "@/lib/mieterZugang";
import { AVV_BLOECKE } from "@/lib/avvInhalt";
import { FAQ } from "@/components/landing/data";
import { ART_FORMULIERUNGSHILFE, FORMULIERUNGSHILFE_HINWEIS } from "@/lib/briefPruefung";
import { ANTRAG_VOR_BEGINN } from "@/lib/kauf/foerderung";
import { KONTAKT_EMAIL } from "@/lib/preise";

const lies = (p: string) => readFileSync(p, "utf8");
/** Geschützte Leerzeichen wie normale lesen — die Rechtsseiten binden „Art. 6“ mit NBSP. */
const normal = (s: string) => s.replace(/ /g, " ");

const MIETER: NkTenant = {
  vorname: "Anna", nachname: "Weber", mieter_adresse: "Lindenstr. 1, 23611 Bad Schwartau", einheit: null,
  flaeche: 80, mietbeginn: "2020-01-01", mietende: null, nk_vorauszahlung: 150,
};
const OBJEKT = { bezeichnung: "Haus", adresse: "Lindenstr. 1, 23611 Bad Schwartau" };
const VZ = { gebucht: 1800, gebuchteMonate: 12 };
const pos = (p: Partial<NkRawPosition>): NkRawPosition => ({
  bezeichnung: "Müll", betrag: 1200, umlageschluessel: null, umlagefaehig: true, jahr: 2025, ...p,
});

// ------------------------------------------------------------------ 1 ----
describe("1. Aufteilung „voll“: Gesamtkosten und Schlüssel stehen in der Abrechnung", () => {
  it("Rechnung: Gesamtkosten = Betrag, Schlüssel „direkt zugeordnet (100 %)“ — auch ohne Aufteilungsangabe", () => {
    for (const aufteilung of ["voll", null, undefined]) {
      const a = berechneNk(2025, MIETER, OBJEKT, [pos({ aufteilung })], null, VZ);
      expect(a.positionen[0], String(aufteilung)).toMatchObject({ betrag: 1200, basis: 1200, umlageschluessel: VOLL_SCHLUESSEL });
    }
    expect(VOLL_SCHLUESSEL).toBe("direkt zugeordnet (100 %)");
  });

  it("andere Aufteilungen behalten ihren Schlüssel", () => {
    const a = berechneNk(2025, MIETER, OBJEKT, [pos({ aufteilung: "flaeche", flaeche_gesamt: 400, umlageschluessel: "Fläche" })], null, VZ);
    expect(a.positionen[0]).toMatchObject({ umlageschluessel: "Fläche", basis: 1200, betrag: 240 });
  });

  it("PDF druckt Gesamtkosten und Schlüssel statt „—“", async () => {
    const a = berechneNk(2025, MIETER, OBJEKT, [pos({ aufteilung: "voll" })], null, VZ);
    const t = pdfTexte(await buildNkPdf(a));
    // Die Tabellenzeile der Position: alles auf der Grundlinie von „Müll“.
    const y = t.find((x) => x.text === "Müll")?.y;
    expect(y, pdfZeilen(await buildNkPdf(a)).join(" | ")).toBeDefined();
    const zeile = t.filter((x) => x.y === y).map((x) => x.text);
    // Name, Gesamtkosten, Schlüssel, Anteil — vorher stand in Gesamt und Schlüssel ein Strich (WinAnsi 0x97).
    expect(zeile).toHaveLength(4);
    expect(zeile.filter((s) => s.startsWith("1.200,00"))).toHaveLength(2);
    expect(zeile).toContain(VOLL_SCHLUESSEL);
    expect(zeile.some((s) => s.includes("\x97"))).toBe(false);
  });

  it("„voll“ mit einem Schlüssel wie „Fläche“ warnt — „direkt“, „Alleinnutzung“ und leer nicht", () => {
    const warn = (s: string | null) => berechneNk(2025, MIETER, OBJEKT, [pos({ aufteilung: "voll", umlageschluessel: s })], null, VZ).warnungen;
    expect(warn("Fläche").join(" ")).toContain("Aufteilung „Voller Betrag“, aber Schlüssel „Fläche“");
    for (const s of [null, "", "direkt", "Alleinnutzung"]) expect(warn(s), String(s)).toEqual([]);
  });

  it("der Hinweis steht am Auswahlfeld „Voller Betrag“ (Tabelle und neue Zeile)", () => {
    expect(VOLL_HINWEIS).toBe(
      "Voller Betrag: Diese Kosten trägt der Mieter allein (z. B. eigener Zähler, Haus allein gemietet). Teilt er sie mit anderen, wähle einen Schlüssel und trage die Gesamtkosten ein — sonst fehlen Pflichtangaben.",
    );
    const pm = lies("components/PositionsManager.tsx");
    expect(pm).toMatch(/voll: VOLL_HINWEIS,/);
    expect(pm).toContain("{AUFTEILUNG_HINWEIS[nAuf] && (");
    // Die Vorschau zeigt dieselben Felder wie das PDF (EINE Regel in berechneNk).
    expect(lies("app/(app)/tenants/[id]/nk/page.tsx")).toContain('{p.basis != null ? eur2(p.basis) : "—"}');
  });
});

// ------------------------------------------------------------------ 2 ----
describe("2. Heizkosten ohne CO₂-Angaben: Warnung in beiden Rechnungen", () => {
  it("der Wortlaut nennt § 7 Abs. 3 und 4 CO2KostAufG und die Ausnahmen", () => {
    expect(CO2_FEHLT_HINWEIS).toContain("Wird mit Gas, Öl, Flüssiggas, Kohle oder fossiler Fernwärme geheizt, muss die Abrechnung die CO₂-Kostenaufteilung ausweisen (§ 7 Abs. 3 CO2KostAufG) — sonst darf der Mieter seinen Heizkostenanteil um 3 % kürzen (§ 7 Abs. 4). Bei Wärmepumpe, Strom- oder Holzheizung entfällt das.");
    // Wortlaut des Gesetzes (gesetze-im-internet.de, abgerufen 21.10.2026): „… um 3 Prozent zu kürzen“.
  });

  it("Mieter-NK: Heizkosten ohne CO₂ → Warnung; mit CO₂-Menge oder ohne Heizkosten → keine", () => {
    const heiz = pos({ bezeichnung: "Heizkosten", betrag: 900 });
    expect(berechneNk(2025, MIETER, OBJEKT, [heiz], null, VZ).warnungen).toContain(CO2_FEHLT_HINWEIS);
    expect(berechneNk(2025, MIETER, OBJEKT, [pos({ bezeichnung: "Wärmelieferung", betrag: 900 })], null, VZ).warnungen).toContain(CO2_FEHLT_HINWEIS);
    // HKVO-Aufteilung zählt als Heizung, auch wenn die Bezeichnung es nicht verrät.
    expect(berechneNk(2025, MIETER, OBJEKT, [pos({ bezeichnung: "Position 1", aufteilung: "hkvo" })], null, VZ).warnungen.join(" ")).toContain("CO₂-Angaben fehlen");
    const mitCo2 = berechneNk(2025, MIETER, OBJEKT, [heiz], { co2_kg: 2000, co2_kosten: 110, flaeche: 80, gewerbe: false }, VZ);
    expect(mitCo2.warnungen).not.toContain(CO2_FEHLT_HINWEIS);
    expect(berechneNk(2025, MIETER, OBJEKT, [pos({})], null, VZ).warnungen).not.toContain(CO2_FEHLT_HINWEIS);
    // Nicht umlagefähige Heizkosten stehen nicht in der Abrechnung — keine Warnung.
    expect(berechneNk(2025, MIETER, OBJEKT, [pos({ bezeichnung: "Heizung", umlagefaehig: false })], null, VZ).warnungen).not.toContain(CO2_FEHLT_HINWEIS);
  });

  const kosten = (k: Partial<NkObjektKosten>): NkObjektKosten => ({
    id: "k", bezeichnung: "Heizkosten", betrag: 3000, schluessel: "flaeche", umlagefaehig: true, ...k,
  });
  const mieter = [{ id: "m1", name: "Anna", flaeche: 80, mietbeginn: "2020-01-01", mietende: null }];
  const basis = { flaeche_gesamt: 400, einheiten: 5, mea_gesamt: null, mieter: {} };

  it("NK am Objekt: Heizkosten ohne CO₂ → Warnung; mit CO₂ oder ohne Heizkosten → keine", () => {
    expect(verteileObjektKosten(2025, basis, [kosten({})], mieter).warnungen).toContain(CO2_FEHLT_HINWEIS);
    expect(verteileObjektKosten(2025, { ...basis, co2_kg: 9000, co2_kosten: 500 }, [kosten({})], mieter).warnungen).not.toContain(CO2_FEHLT_HINWEIS);
    expect(verteileObjektKosten(2025, basis, [kosten({ bezeichnung: "Grundsteuer" })], mieter).warnungen).toEqual([]);
  });

  it("über das Objekt kommt der Hinweis in der Mieter-Abrechnung genau einmal an", () => {
    const e = verteileObjektKosten(2025, basis, [kosten({})], mieter);
    const a = berechneNk(2025, MIETER, OBJEKT, [pos({ bezeichnung: "Heizkosten", aufteilung: "objekt", anteil: 600 })], null, VZ, { co2: null, hinweise: e.warnungen });
    expect(a.warnungen.filter((w) => w.includes("CO₂"))).toEqual([CO2_FEHLT_HINWEIS]);
  });

  it("Messdienst-Hinweis (§ 6a Abs. 3, § 12 Abs. 1 S. 3 HeizkostenV) am HKVO-Hinweis und bei Heizkosten je Wohnung", () => {
    expect(MESSDIENST_HINWEIS).toBe("Die Abrechnung des Messdienstes mit den Angaben nach § 6a Abs. 3 HeizkostenV beilegen — sonst darf der Mieter um 3 % kürzen (§ 12 Abs. 1 S. 3 HeizkostenV).");
    const pm = lies("components/PositionsManager.tsx");
    expect(pm).toMatch(/hkvo:\s*`[^`]*\$\{MESSDIENST_HINWEIS\}`/);
    expect(pm).toMatch(/gradtag:\s*`[^`]*\$\{MESSDIENST_HINWEIS\}`/);
    const ed = lies("components/nk/NkObjektEditor.tsx");
    expect(ed).toMatch(/istHeizkosten\(form\.bezeichnung\) && \([\s\S]{0,120}\{MESSDIENST_HINWEIS\}/);
  });
});

// ------------------------------------------------------------------ 3 ----
describe("3. Belegeingang: die KI liest nur auf Klick", () => {
  const src = lies("components/BelegEingang.tsx");
  const hochladen = src.slice(src.indexOf("const hochladen ="), src.indexOf("return (", src.indexOf("const hochladen =")));

  it("Hochladen ruft keinen KI-Vorschlag auf; der Knopf „KI-Vorschlag holen“ schon", () => {
    expect(hochladen.length).toBeGreaterThan(200); // der Ausschnitt ist wirklich die Funktion
    expect(hochladen).toContain("ladeBelegHoch(fd)");
    expect(hochladen).not.toMatch(/vorschlagHolen\(/);
    expect(src).toMatch(/const kiNochmal = \(\) =>[\s\S]{0,80}vorschlagHolen\(e\.id\)/);
    expect(src).toContain('"KI-Vorschlag holen"');
  });

  it("der Hinweis nennt den Anbieter — vom Server, je nach Einrichtung", async () => {
    expect(src).toContain("Erst „KI-Vorschlag holen“ übermittelt den Beleg zur Auswertung an");
    expect(src).toContain("{kiAnbieter}");
    expect(lies("app/(app)/cashflow/belege/page.tsx")).toContain("kiAnbieter={kiAnbieterText()}");
    const alt = { ...process.env };
    try {
      for (const k of ["BEDROCK_ACCESS_KEY_ID", "BEDROCK_SECRET_ACCESS_KEY", "BEDROCK_MODEL_ID"]) delete process.env[k];
      vi.resetModules();
      expect((await import("@/lib/aiRoute")).kiAnbieterText()).toContain("Anthropic (USA");
      Object.assign(process.env, { BEDROCK_ACCESS_KEY_ID: "a", BEDROCK_SECRET_ACCESS_KEY: "b", BEDROCK_MODEL_ID: "eu.x" });
      vi.resetModules();
      expect((await import("@/lib/aiRoute")).kiAnbieterText()).toContain("Amazon Bedrock");
    } finally {
      process.env = alt;
    }
  });
});

// ------------------------------------------------------------------ 4 ----
describe("4. E-Mail-Einwilligungen: bestimmt und nicht gekoppelt", () => {
  it("Start: nur die einmalige Ankündigung", () => {
    expect(EINWILLIGUNGSTEXT_START).toBe("Ich möchte einmalig per E-Mail erfahren, wann MyImmo startet. Abmelden geht jederzeit über den Link in der Mail.");
  });
  it("Vorlagen: Absender, Inhalt und Häufigkeit — Widerruf bleibt", () => {
    expect(EINWILLIGUNGSTEXT).toContain("die MyImmo-Vorlagen per E-Mail sowie höchstens monatlich Hinweise von MyImmo zu neuen Vorlagen, Funktionen und dem Start der App");
    expect(EINWILLIGUNGSTEXT).toContain("jederzeit über den Abmeldelink in jeder E-Mail widerrufen");
    expect(EINWILLIGUNGSTEXT).not.toContain("gelegentliche Hinweise für Vermieter");
    expect(bestaetigungsMail("https://x/b").text).toContain("höchstens monatlich Hinweise von MyImmo");
  });
  it("neue Version, und die Datenschutzerklärung beschreibt dasselbe", () => {
    expect(EINWILLIGUNG_VERSION).toBe("2026-10-21");
    const ds = normal(lies("app/(pub)/datenschutz/page.tsx"));
    expect(ds).not.toContain("danach gelegentliche Hinweise für Vermieter");
    expect(ds).toMatch(/einmalig<\/strong> per E-Mail zu erfahren, wann\s+MyImmo startet/);
    expect(ds).toMatch(/höchstens\s+monatlich Hinweise von MyImmo/);
  });
});

// ------------------------------------------------------------------ 5 ----
describe("5. Fristen: kein Versprechen einer Erinnerung, die es nicht gibt", () => {
  it("Funktionsseiten und Ratgeber sagen, wo die Frist steht", () => {
    const f = lies("lib/funktionen.ts");
    const r = lies("lib/ratgeber.ts");
    for (const t of [f, r]) {
      expect(t).not.toMatch(/meldet sich rechtzeitig|Die Frist meldet sich|erinnert die App/);
    }
    expect(f).toContain("zeigt sie rechtzeitig auf dem Dashboard und unter Termine — per iCal-Datei auch in deinem Kalender");
    expect(f).not.toMatch(/Rückstands-Wächter meldet sich/);
  });
  it("„Erinnerung im Kalender“ nur, wo der Export sie mitbringt — abgeleitete Fristen haben keinen VALARM", () => {
    // Belegt den bewusst vorsichtigen Wortlaut: Nur eigene Termine mit Vorlauf bekommen VALARM.
    const ical = lies("app/(app)/termine/ical/route.ts");
    expect(ical).toContain("BEGIN:VALARM");
    expect(ical).toMatch(/add\(f\.datum, f\.label, \[wer, wo, f\.rechtsgrundlage\][^\n]*fristUid\("mieter", m\.id, f\.datum!, f\.label\)\);/);
    expect(lies("lib/funktionen.ts")).toContain("wo du dir eine Erinnerung einstellen kannst");
  });
});

// ------------------------------------------------------------------ 6 ----
let mails: { an: string; text: string; html: string }[] = [];
beforeEach(() => { vi.resetModules(); mails = []; });
afterEach(() => {
  for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin", "@/lib/mail/brevo", "@/lib/net/basisUrl"]) vi.doUnmock(m);
});
async function lade(modul: string, init: Parameters<typeof fakeSupabase>[0] = {}) {
  vi.resetModules();
  const { db, client } = fakeSupabase(init);
  mockeNextUndSupabase(client);
  vi.doMock("@/lib/mail/brevo", () => ({
    brevoBereit: () => true,
    sendeMail: async (m: { an: string; text: string; html: string }) => { mails.push(m); return true; },
  }));
  vi.doMock("@/lib/net/basisUrl", () => ({ basisUrl: async () => "https://www.myimmoapp.de" }));
  const mod = await import(modul);
  return { db, mod };
}
const MIETER_ZEILE = { id: "m1", prop_id: "p1", user_id: "nutzer-1" };
const CODE = () => ({ "einladungscodes:insert": [{ code: "MI-ABCD-2345", gueltig_bis: "2026-11-16T10:00:00Z" }] });

describe("6a. Einladung ins Mieterportal: nur mit Namen des Vermieters", () => {
  it("ohne Profilnamen: abgelehnt mit Hinweis, nichts gelöscht, nichts angelegt, keine Mail", async () => {
    for (const profil of [null, { name: "" }, { name: "   " }]) {
      const { db, mod } = await lade("@/lib/actions/einladung", { antworten: { mieter: MIETER_ZEILE, vermieter_profil: profil }, antwortFolge: CODE() });
      const r = await mod.erzeugeEinladungscode("m1", "anna@example.org", "anna@example.org");
      expect(r, JSON.stringify(profil)).toEqual({ error: PROFILNAME_FEHLT, profilFehlt: true });
      expect(db.zugriffe.filter((z) => z.op !== "select")).toEqual([]);
    }
    expect(mails).toEqual([]);
    expect(PROFILNAME_FEHLT).toBe("Trage zuerst deinen Namen unter Einstellungen → Profil ein — der Mieter muss erfahren, wer seine Daten verarbeitet.");
  });

  it("Profil nicht lesbar: kein „Profil fehlt“, aber auch keine Einladung", async () => {
    const { db, mod } = await lade("@/lib/actions/einladung", { antworten: { mieter: MIETER_ZEILE }, fehlerBei: { vermieter_profil: { message: "x" } } });
    const r = await mod.erzeugeEinladungscode("m1", "anna@example.org", "anna@example.org");
    expect(r.error).toContain("Profil konnte nicht gelesen werden");
    expect(db.zugriffe.some((z) => z.tabelle === "einladungscodes")).toBe(false);
  });

  it("mit Namen: Mail nennt den Vermieter, den Verantwortlichen und die Datenschutzhinweise — keine Anschrift", async () => {
    const { mod } = await lade("@/lib/actions/einladung", {
      antworten: { mieter: MIETER_ZEILE, vermieter_profil: { name: "Max Muster", strasse: "Geheimweg 7" } }, antwortFolge: CODE(),
    });
    const r = await mod.erzeugeEinladungscode("m1", "anna@example.org", "anna@example.org");
    expect(r).toMatchObject({ gesendet: true });
    const m = mails[0];
    expect(m.text).toContain("Max Muster nutzt MyImmo");
    expect(m.text).toContain("Verantwortlich für Ihre Daten im Mieterportal ist Max Muster. MyImmo stellt das Portal in dessen Auftrag bereit. Datenschutzhinweise: https://www.myimmoapp.de/datenschutz");
    expect(m.html).toContain(`href="${DATENSCHUTZ_URL}"`);
    expect(m.text + m.html).not.toContain("Ihr Vermieter");
    expect(m.text + m.html).not.toContain("Geheimweg");
  });

  it("die Mail lässt sich ohne Namen gar nicht bauen", () => {
    expect(() => einladungsMail({ vermieter: " ", link: "https://x", code: "MI-1", gueltigBis: "2026-11-16T10:00:00Z" })).toThrow();
    expect(verantwortlichSatz("Max")).toContain(DATENSCHUTZ_URL);
  });

  it("Oberfläche: Hinweis mit Link ins Profil; der selbst verschickte Text nennt den Verantwortlichen", () => {
    const k = lies("components/MieterEinladung.tsx");
    expect(k).toContain("setProfilFehlt(!!r.profilFehlt)");
    expect(k).toContain("<Link href={PROFIL_LINK}");
    expect(k).toContain("Verantwortlich für deine Daten im Mieterportal bin ich");
    expect(lies("lib/mieterZugang.ts")).toContain('PROFIL_LINK = "/einstellungen?tab=profil"');
  });
});

describe("6b. Bewerbungs-Link: nur mit Name und E-Mail im Profil", () => {
  const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };

  it("ohne Name oder ohne E-Mail: kein neuer Link, Hinweis aufs Profil", async () => {
    for (const profil of [null, { name: "Max", email: "" }, { name: "", email: "max@example.org" }]) {
      const { db, mod } = await lade("@/lib/actions/bewerber", { antworten: { vermieter_profil: profil } });
      const r = await mod.erstelleBewerberLink(fd({ propId: "p-1" }));
      expect(r.error, JSON.stringify(profil)).toContain("Einstellungen → Profil");
      expect(r.profilFehlt).toBe(true);
      expect(db.zugriffe.some((z) => z.tabelle === "bewerber_links")).toBe(false);
    }
  });

  it("mit Name und E-Mail entsteht der Link; bestehende Links werden nicht angefasst", async () => {
    const { db, mod } = await lade("@/lib/actions/bewerber", { antworten: { vermieter_profil: { name: "Max", email: "max@example.org" } } });
    expect(await mod.erstelleBewerberLink(fd({ propId: "p-1" }))).toEqual({ ok: true });
    expect(db.zugriffe.filter((z) => z.tabelle === "bewerber_links").map((z) => z.op)).toEqual(["insert"]);
    const ui = lies("components/BewerbungenManager.tsx");
    expect(ui).toContain("<Link href={PROFIL_LINK}");
  });

  it("das Formular nennt Speicherdauer und Widerruf — die Rechtsgrundlage bleibt (Anwaltsfrage 10)", () => {
    const f = normal(lies("components/BewerbungForm.tsx")).replace(/\s+/g, " ");
    expect(f).toContain("Kommt kein Mietvertrag zustande, löscht dein Vermieter die Angaben spätestens sechs Monate nach Abschluss der Vermietung");
    expect(f).toContain("Eine Einwilligung kannst du jederzeit gegenüber dem Vermieter widerrufen.");
    expect(f).toContain("(Art. 6 Abs. 1 lit. a/b DSGVO)");
  });
});

// ------------------------------------------------------------------ 7 ----
describe("7. DSA: Kontaktstelle und Meldeweg", () => {
  it("Impressum nennt die Kontaktstelle (Art. 11, 12) und den Meldeweg (Art. 16) mit KONTAKT_EMAIL", () => {
    const i = normal(lies("app/(pub)/impressum/page.tsx")).replace(/\s+/g, " ");
    expect(i).toContain('import { KONTAKT_EMAIL } from "@/lib/preise"');
    expect(i).toContain("Zentrale Kontaktstelle nach Art. 11 und 12 DSA für Behörden und Nutzer:");
    expect(i).toContain("(Deutsch, Englisch). Meldungen rechtswidriger Inhalte (Art. 16 DSA) bitte an dieselbe Adresse mit Fundstelle bzw. Link, Begründung, Name und E-Mail.");
    expect(KONTAKT_EMAIL).toBe("info@myimmoapp.de");
  });
  it("AGB: Prüfung von Hand, Begründung und Beschwerdeweg (Art. 14, 17 DSA) — nur ergänzt", () => {
    const a = normal(lies("app/(pub)/agb/page.tsx"));
    expect(a).toContain("prüft der Anbieter von Hand");
    expect(a).toContain("nennt er dem Nutzer den Grund und den Weg, sich dagegen zu beschweren (Art. 14, 17 DSA)");
    // Nichts umgebaut: die zwölf Ziffern stehen weiter da.
    expect((a.match(/<H2>\d+\./g) ?? []).length).toBe(12);
  });
});

// ------------------------------------------------------------------ 8 ----
describe("8. Empfänger: AWS je nach Einrichtung, Google eigenständig, FAQ wie Datenschutzerklärung", () => {
  const ds = normal(lies("app/(pub)/datenschutz/page.tsx"));

  it("AWS (Bedrock) steht im AVV und in der Datenschutzerklärung — mit dem Vertragspartner für die EU", () => {
    const sieben = AVV_BLOECKE.slice(AVV_BLOECKE.findIndex((b) => "h" in b && b.h.startsWith("7.")));
    const ul = sieben.find((b): b is { ul: string[] } => "ul" in b)!;
    expect(ul.ul.some((t) => t.startsWith("**Amazon Web Services EMEA SARL** (Luxemburg)") && t.includes("je nach Einrichtung"))).toBe(true);
    expect(ds).toContain("<strong>Amazon Web Services EMEA SARL</strong>, Luxemburg");
    expect(ds).toMatch(/je nach Einrichtung\s+an die API von <strong>Anthropic<\/strong> \(USA\) oder an <strong>Amazon Bedrock<\/strong>/);
    expect(lies("lib/aiRoute.ts")).toContain("if (bedrockKonfiguriert()) return callBedrock(payload, timeoutMs);");
  });

  it("Google ist kein Auftragsverarbeiter — eigener Satz außerhalb der Liste nach Art. 28", () => {
    const vier = ds.slice(ds.indexOf("<H2>4."), ds.indexOf("<H2>5."));
    const liste = vier.slice(vier.indexOf("<ul"), vier.indexOf("</ul>"));
    expect(liste).not.toContain("Google");
    expect(vier).toMatch(/<strong>Google Ireland Ltd\.<\/strong> ist kein Auftragsverarbeiter[\s\S]*eigenständig Verantwortlicher/);
  });

  it("Supabase-Sicherheitsprotokoll mit IP und Zeitpunkt steht in 3 d — ohne unbelegte Frist", () => {
    const d = ds.slice(ds.indexOf("d) Server-Logs"), ds.indexOf("e) KI-Funktionen"));
    expect(d).toMatch(/protokolliert unser Datenbank-Anbieter <strong>Supabase<\/strong> Anmeldungen,/);
    expect(d).toMatch(/<strong>IP-Adresse und Zeitpunkt<\/strong>/);
    // Die Supabase-Doku nennt für das Auth-Protokoll keine Aufbewahrung — also auch hier keine Zahl.
    const supa = d.slice(d.indexOf("Zusätzlich protokolliert"));
    expect(supa).not.toMatch(/\d+\s*(Tage|Tagen|Monate)/);
  });

  it("FAQ „Wo liegen meine Daten?“: Frankfurt, USA-Protokolle des Hosters, KI je nach Einrichtung", () => {
    const a = FAQ.find((f) => f.q === "Wo liegen meine Daten?")!.a as string;
    expect(a).not.toMatch(/^In der EU/);
    expect(a).toContain("Die Datenbank liegt bei Supabase in Frankfurt");
    expect(a).toContain("der Hoster kann technische Protokolle in den USA verarbeiten");
    expect(a).toContain("je nach Einrichtung über Anthropic in den USA");
    // Und die Datenschutzerklärung sagt dasselbe (Werbung darf ihr nicht widersprechen).
    expect(ds).toContain("technische Logs können in den USA verarbeitet werden");
  });
});

// ------------------------------------------------------------------ 9 ----
describe("9. Aufbewahrung: § 14b UStG / § 147a AO statt § 147 AO", () => {
  it("AGB und Datenschutzerklärung wie das Archiv", () => {
    for (const p of ["app/(pub)/agb/page.tsx", "app/(pub)/datenschutz/page.tsx"]) {
      const t = normal(lies(p));
      expect(t, p).not.toMatch(/§ 147 AO/);
      expect(t, p).toContain("§ 14b UStG für Handwerkerrechnungen, ggf. § 147a AO");
    }
    expect(lies("components/ArchivManager.tsx")).toContain("(§ 147a AO)");
  });
});

// ----------------------------------------------------------------- 10 ----
describe("10. Brief-Generator und Werbetexte: Formulierungshilfe, keine QES", () => {
  it("Kündigung und Mieterhöhung zeigen den Hinweis", () => {
    expect([...ART_FORMULIERUNGSHILFE]).toEqual(["kuendigung", "mieterhoehung"]);
    expect(FORMULIERUNGSHILFE_HINWEIS).toBe("Formulierungshilfe: MyImmo rechnet Fristen und prüft Pflichtfelder — ob Grund oder Erhöhung im Einzelfall tragen, prüft es nicht. Keine Rechtsberatung.");
    expect(lies("components/DocGenerator.tsx")).toMatch(/\{ART_FORMULIERUNGSHILFE\.includes\(art\) && \([\s\S]{0,120}\{FORMULIERUNGSHILFE_HINWEIS\}/);
  });
  it("/vorlagen und Startseite versprechen keine Prüfung bzw. keine E-Signatur", () => {
    const v = lies("app/(pub)/vorlagen/page.tsx");
    expect(v).toContain("Sperrfrist und Kappungsgrenze werden berechnet und angezeigt");
    expect(v).not.toContain("werden geprüft");
    const d = lies("components/landing/data.tsx");
    expect(d).not.toContain("e-signiert");
    expect(d).toContain("mit eingefügter Unterschrift (keine qualifizierte elektronische Signatur)");
  });
});

// ----------------------------------------------------------------- 11 ----
describe("11. Sanierungs-Guide: Zuschuss nur mit dem Hinweis „Antrag vor Beauftragung“", () => {
  it("EIN Text für Förder-Check und Guide, mit der Bedingung im Vertrag (kfw.de/458)", () => {
    expect(ANTRAG_VOR_BEGINN.titel).toBe("Antrag immer VOR Vorhabensbeginn stellen");
    expect(ANTRAG_VOR_BEGINN.text).toContain("vor Auftragsvergabe — einen Vertrag vorher nur mit aufschiebender oder auflösender Bedingung der Förderzusage");
    expect(lies("components/kauf/FoerderCheck.tsx")).toContain("<strong>{ANTRAG_VOR_BEGINN.titel}</strong> — {ANTRAG_VOR_BEGINN.text}");
    expect(lies("components/kauf/FoerderCheck.tsx")).not.toContain("Zu spät = Förderung weg.");
  });
  it("im Guide steht er IM Block „Möglicher Zuschuss“, der nur bei Zuschuss > 0 erscheint", () => {
    const g = lies("components/sanierung/GuideErgebnis.tsx");
    const block = g.slice(g.indexOf("{zuschuss.max > 0 && ("), g.indexOf("{a.einkauf.length > 0 && ("));
    expect(block.length).toBeGreaterThan(100);
    expect(block).toContain("<strong>{ANTRAG_VOR_BEGINN.titel}</strong> — {ANTRAG_VOR_BEGINN.text}");
  });
});

// ----------------------------------------------------------------- 12 ----
describe("12. Anwaltsliste um § 327r und DSA ergänzt", () => {
  it("beide Fragen stehen in der Liste", () => {
    const d = lies("docs/AUDIT-2026-10-07-gesamt.md");
    const liste = d.slice(d.indexOf("**Anwaltsliste"), d.indexOf("## 11. Fundament"));
    expect(liste).toMatch(/^12\. .*§ 327r Abs\. 1–3 BGB/m);
    expect(liste).toMatch(/^13\. .*Hosting-Dienst im Sinne des DSA/m);
  });
});
