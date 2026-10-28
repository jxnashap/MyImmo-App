// Gesamtdurchsicht 27.10.2026 (Design, UX, Abläufe in MyImmo, BuyImmo, Portal und Website).
// Jeder Fund wurde im Browser an der Live-Seite gesehen; die Tests halten die Korrektur fest.
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { baueHeuteAufgaben } from "@/lib/heute";
import { jahresPruefung, type JpKosten, type JpEinnahme, type JahresPruefung } from "@/lib/jahresPruefung";

const lies = (p: string) => readFileSync(p, "utf8");
const ohneKommentare = (s: string) => s.split("\n").filter((z) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(z)).join("\n");

afterEach(() => { vi.doUnmock("@/lib/actions/zustellung"); vi.resetModules(); });

describe("Mieterportal", () => {
  it("P01: „Schaden melden“ öffnet das Formular auch, wenn der Reiter schon geladen war", () => {
    // Der Wisch-Reiter hält den Reiter eingehängt; useState liest `neu` nur beim ersten Rendern.
    // Ein Schlüssel aus `neu` hängt die Liste neu ein — sonst blieb sie nach dem Klick zu.
    expect(ohneKommentare(lies("components/PortalAnsicht.tsx"))).toMatch(/<AnliegenPortal key=\{neu \?\? "liste"\}/);
  });
  it("P02: der Schadens-Assistent sprengt am Handy nicht die Breite", () => {
    expect(lies("components/SchadenAssistent.tsx")).toMatch(/gridTemplateColumns: "minmax\(0, 1fr\)", minWidth: 0/);
  });
  it("P02b: das Dateifeld schiebt Feld und Beschriftung nicht aus der Karte", () => {
    const sa = ohneKommentare(lies("components/SchadenAssistent.tsx"));
    expect(sa).toMatch(/const feld = \{ display: "grid", gridTemplateColumns: "minmax\(0, 1fr\)",/);
    expect(sa).not.toMatch(/<label style=\{\{ display: "grid", gap: 4/);
    expect(lies("app/globals.css")).toMatch(/\ninput\[type="file"\] \{ max-width: 100%; min-width: 0; \}/);
  });
  it("P03: am Handy alle fünf Portal-Reiter sichtbar statt einer rollenden Leiste", () => {
    expect(lies("components/GlassLeiste.tsx")).toMatch(/alleSichtbar \? "glass-bar glass-bar-alle" : "glass-bar"/);
    const css = lies("app/globals.css");
    const block = css.slice(css.indexOf("@media (max-width: 600px) {\n  .glass-bar-alle"));
    expect(block).toMatch(/^@media \(max-width: 600px\) \{\n  \.glass-bar-alle \{ overflow-x: visible;/);
    expect(block).toMatch(/\.glass-bar-alle \.glass-item \{[^}]*flex: 1 1 0; min-width: 0;/);
  });
});

describe("M02: Bereitgestellt ist nicht zugegangen — grün erst mit Abruf", () => {
  async function zeile(gelesen: string | null) {
    vi.resetModules();
    vi.doMock("@/lib/actions/zustellung", () => ({ stelleDokumentZu: async () => ({}), zieheZustellungZurueck: async () => ({}) }));
    const { default: DokumentZustellung } = await import("@/components/DokumentZustellung");
    return renderToStaticMarkup(createElement(DokumentZustellung, {
      notizId: "n1", mieterId: "m1", titel: "NK 2025", hatDatei: true, mieterName: "Anna Weber",
      pruefung: { sperre: null, warnungen: [], email: "anna@example.org" } as never,
      zustellungen: [{ id: "z1", empfaenger_email: "anna@example.org", zugestellt_am: "2026-10-01T10:00:00Z", gelesen_am: gelesen, bestaetigung_noetig: false, bestaetigt_am: null, zurueckgezogen_am: null }],
    }));
  }
  it("nicht abgerufen → graues „Bereitgestellt“", async () => {
    const html = await zeile(null);
    expect(html).toContain('<span class="badge badge-neutral">Bereitgestellt</span>');
    expect(html).not.toContain("badge-green");
    expect(html).toContain("noch nicht abgerufen");
  });
  it("abgerufen → grünes „Abgerufen“", async () => {
    const html = await zeile("2026-10-03T08:00:00Z");
    expect(html).toContain('<span class="badge badge-green">Abgerufen</span>');
  });
  it("die Mieter-Aufgabe sagt „bereitgestellt“", () => {
    expect(lies("lib/mieterAufgaben.ts")).toMatch(/Bereitgestellt am \$\{de\(z\.zugestellt_am\)\} — noch nicht geöffnet\./);
  });
});

describe("M03: Eine Möglichkeit wird nie „überfällig“", () => {
  const frist = (moeglich: boolean) => baueHeuteAufgaben(
    { offeneMieten: [], anliegen: [], meldungen: [], fristen: [{ datum: "2026-09-01", label: "Mieterhöhung möglich", sub: "Anna", warn: false, moeglich }] },
    "2026-10-27",
  )[0];
  it("Möglichkeit mit Datum in der Vergangenheit → nicht dringend", () => {
    expect(frist(true).dringend).toBe(false);
  });
  it("Pflicht-Frist in der Vergangenheit → dringend (Gegenprobe)", () => {
    expect(frist(false).dringend).toBe(true);
  });
  it("Dashboard reicht `moeglich` an allen vier Fristquellen durch, /termine zählt Möglichkeiten nicht als Aufgabe", () => {
    const d = lies("app/(app)/page.tsx");
    expect(d.match(/warn: f\.typ === "warn", moeglich: f\.typ === "ok"/g)?.length).toBe(4);
    const t = lies("app/(app)/termine/page.tsx");
    expect(t).toMatch(/const istAufgabe = \(e: Eintrag\) => e\.typ === "warn" \|\| e\.quelle === "eigen";/);
    expect(t).toMatch(/e\.typ !== "ok" && e\.erledigtSchluessel/);
  });
  it("Kopf des Dashboards zählt laufende Mietverhältnisse, nicht alle je angelegten", () => {
    expect(lies("app/(app)/page.tsx")).toMatch(/const laufendeMietverhaeltnisse = mieterRows\.filter\(\(m\) => laeuftAm\(m, heuteISO0\)\)\.length;/);
  });
});

describe("M13: Jahresprüfung bündelt Zinsbuchungen ohne Beleg", () => {
  let n = 0;
  const kost = (x: Partial<JpKosten>): JpKosten => ({
    id: `k${++n}`, prop_id: "p1", buchungsdatum: "2025-03-10", betrag: 100, kategorie: "Reparatur", beschreibung: null, umlagefaehig: null,
    rechnung_path: null, rechnung_name: null, beleg_eingang_id: null, ...x,
  });
  const mieten: JpEinnahme[] = Array.from({ length: 12 }, (_, i) => ({
    id: `e${i}`, prop_id: "p1", mieter_id: "anna", buchungsdatum: `2025-${String(i + 1).padStart(2, "0")}-02`, betrag: 1000, kategorie: "Miete",
    soll_monat: `2025-${String(i + 1).padStart(2, "0")}`, nk_anteil: 200, beschreibung: null,
  }));
  const pruefe = (kosten: JpKosten[]): JahresPruefung => jahresPruefung({
    jahr: 2025, heute: "2026-10-27",
    objekt: { id: "p1", bezeichnung: "Haus", einheiten_anzahl: 1, kaufdatum: "2019-05-01" },
    mieter: [{ id: "anna", prop_id: "p1", vorname: "Anna", nachname: "Weber", einheit: "EG", mietbeginn: "2020-01-01", mietende: null, kaltmiete: 800, nk_vorauszahlung: 200, stellplatz_miete: 0, minderungen: null }],
    zeitraeume: [], einnahmen: mieten, kosten, kredite: [], meldungen: [], verbrauch: [], belegEingang: [], nk: { quelle: "keine", positionen: [] },
  });
  const belege = (r: JahresPruefung) => r.punkte.filter((p) => p.art === "beleg");

  it("zwölf Zinsbuchungen → EIN Hinweis mit Summe; die Reparatur bleibt ein eigener Punkt", () => {
    const zinsen = Array.from({ length: 12 }, (_, i) => kost({ kategorie: "Schuldzinsen", betrag: 250, buchungsdatum: `2025-${String(i + 1).padStart(2, "0")}-30` }));
    const r = pruefe([...zinsen, kost({ betrag: 480, beschreibung: "Therme" })]);
    const b = belege(r);
    expect(b).toHaveLength(2);
    const z = b.find((p) => p.schluessel === "beleg:zinsen")!;
    expect(z.schwere).toBe("hinweis");
    expect(z.betrag).toBe(3000);
    expect(z.text).toMatch(/^12 Zinsbuchungen \(.*3\.000.*\) ohne Beleg — die Zinsbescheinigung der Bank für 2025 genügt als ein Beleg$/);
    expect(z.href).toBe("/cashflow?jahr=2025&prop=p1");
    // Die echte Lücke steht vor dem Hinweis (Schwere „mittel“ vor „hinweis“).
    expect(b[0].text).toMatch(/^Reparatur vom .* ohne Beleg — Therme$/);
  });
  it("eine einzelne Zinsbuchung bleibt ein Einzelpunkt", () => {
    const b = belege(pruefe([kost({ kategorie: "Schuldzinsen", betrag: 250 })]));
    expect(b).toHaveLength(1);
    expect(b[0].text).toMatch(/^Schuldzinsen vom /);
    expect(b[0].schwere).toBe("mittel");
  });
  it("Einzelbelege stehen nach Datum, nicht nach Kennung", () => {
    const spaet = kost({ id: "a-zuerst", buchungsdatum: "2025-11-01" });
    const frueh = kost({ id: "z-zuletzt", buchungsdatum: "2025-02-01" });
    const b = belege(pruefe([spaet, frueh]));
    expect(b.map((p) => p.href)).toEqual(["/kosten/z-zuletzt/edit", "/kosten/a-zuerst/edit"]);
  });
});

describe("BuyImmo", () => {
  const ka = lies("components/KaufAssistent.tsx");
  it("K01: Die Demo-Finanzierung rechnet sich nach (Darlehen = Gesamt − Eigenkapital, Rate aus Zins + Tilgung)", () => {
    // Vorher eine Wohnung aus dem eigenen Bestand mit Zahlen, die nicht zueinander passten.
    expect(ohneKommentare(ka)).not.toMatch(/Altbau-ETW Leipzig Süd/);
    // Ganze Zeilen: „rate: DEMO_RATE“ steckt sonst auch in „monatsrate: DEMO_RATE“.
    for (const feld of ["gesamtInvest: DEMO_GESAMT", "eigenkapital: DEMO_EK", "darlehen: DEMO_KREDIT", "rate: DEMO_RATE", "monatsrate: DEMO_RATE", "sollzins: DEMO_ZINS", "anfangstilgung: DEMO_TILGUNG"]) {
      expect(ka.split("\n").map((z) => z.trim()), feld).toContain(`${feld},`);
    }
    expect(ka).toMatch(/const DEMO_KREDIT = DEMO_GESAMT - DEMO_EK;/);
    expect(ka).toMatch(/const DEMO_RATE = Math\.round\(\(DEMO_KREDIT \* \(DEMO_ZINS \+ DEMO_TILGUNG\)\) \/ 100 \/ 12\);/);
    // Werte der Demo-Kaufprüfung „Leipzig-Schönefeld“ (Schritt 1).
    expect(ka).toMatch(/const DEMO_GESAMT = 176601;/);
    expect(ka).toMatch(/kp: 159000,/);
    expect(ka).toMatch(/kaltmiete: 545,/);
  });
  it("K03 u. a.: Kaufweg-Texte werten nicht (§ 34i)", () => {
    expect(ka).not.toMatch(/Der Standard für fast alle Fälle|Für Vermieter interessant|voll als Werbungskosten abziehbar/);
    const mk = lies("components/kauf/MachbarkeitKarte.tsx");
    expect(mk).not.toMatch(/Sieht machbar aus|"Machbar —/);
    expect(mk).toMatch(/gruen: "Alle Prüfpunkte im grünen Bereich"/);
    expect(lies("components/kalkulator/AfaAssistent.tsx")).not.toMatch(/<th>Optimal<\/th>/);
    const sp = lies("components/strategie/StrategiePlaner.tsx");
    expect(sp).not.toMatch(/Er kann Kapital geben/);
    expect(sp).toMatch(/Eigenkapital rechnerisch gedeckt/);
    // Ein negativer Überschuss steht rot da, nicht neben einem grünen Haken.
    expect(sp).toMatch(/r\.ueberschussMo < 0 \? \{ color: "var\(--red\)"/);
  });
  it("K: Demo-Startwerte im Objekt-Rechner sind kein Objekt aus dem Bestand", () => {
    expect(lies("components/kauf/ObjektRechner.tsx")).toMatch(/const DEMO_START = \{\n  adresse: "Musterstraße 12, 04129 Leipzig",\n  kaufpreis: "195000",/);
  });
});

describe("Website sagt, was der Code tut", () => {
  it("W09: Mieten werden im Mietkonto bestätigt, nicht als wiederkehrende Buchung „rückwirkend bis 10 Jahre“", () => {
    const lp = lies("components/LandingPage.tsx");
    expect(lp).not.toMatch(/Buchungen laufen lassen|rückwirkend bis 10 Jahre/);
    expect(lp).toMatch(/Das Mietkonto kennt die Miete aus dem Vertrag — du bestätigst nur den Eingang/);
  });
  it("W10: Der Hausmeister schlägt eine Firma vor; Mieterkontakt nur mit Freigabe", () => {
    for (const p of ["components/landing/RollenFlow.tsx", "app/(pub)/funktionen/page.tsx"]) {
      const s = ohneKommentare(lies(p));
      expect(s, p).not.toMatch(/wählt die Firma aus dem Verzeichnis|Termin-Link mit dem Kontakt des Mieters|mit Kontakt des Mieters"/);
      expect(s, p).toMatch(/schlägt eine Firma vor/);
    }
    expect(lies("components/landing/RollenFlow.tsx")).toMatch(/Mieterkontakt nur mit deiner Freigabe/);
  });
  it("W11: Die Demo zeigt nicht „jede Funktion“ (Makler, Anlegen und KI sind gesperrt)", () => {
    for (const p of ["components/LandingPage.tsx", "components/landing/Shell.tsx"]) {
      expect(lies(p), p).not.toMatch(/zeigt die Demo jede Funktion/);
    }
  });
  it("Vierte Rolle heißt Dienstleister (eine „Verwaltung“-Rolle gibt es nicht)", () => {
    expect(lies("components/LandingPage.tsx")).toMatch(/Rollen: Vermieter, Mieter, Hausmeister, Dienstleister/);
  });
  it("W12: Das Vision-Bild zeigte eine fremde englische App — Datei entfernt, nicht mehr verwendet", () => {
    expect(ohneKommentare(lies("app/(pub)/vision/page.tsx"))).not.toMatch(/slug="vision"/);
    expect(() => readFileSync("public/landing/hero/vision.mp4")).toThrow();
  });
  it("Keine Werbung mit „den sonst niemand hat“ und kein DSGVO-Paragraf als Knopftext", () => {
    expect(lies("lib/funktionen.ts")).not.toMatch(/den sonst niemand hat/);
    expect(lies("components/KontoVerwaltung.tsx")).not.toMatch(/Art\. 15 und 20 DSGVO/);
    expect(lies("components/landing/data.tsx")).not.toMatch(/Ergebnis in 1–3 Tagen/);
  });
});
