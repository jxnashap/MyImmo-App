// Gesamtprüfung P10 (09.10.2026): Ratgeber und Werbung.
// B46–B51, C34–C39, C41. Zwei Wächter:
//  1. NEGATIVLISTE — Aussagen, die nachweislich falsch waren, kommen nicht zurück.
//  2. WERBE-WÄCHTER — wo ein öffentlicher Text eine MyImmo-Funktion verspricht, steht der Beleg im Code.
// Dazu die NORMZITATE: jede korrigierte Rechtsaussage mit Quelle und Abrufdatum — wer sie ändert, prüft
// erst die Quelle neu (Regel aus CLAUDE.md: Werte nie aus einer Zusammenfassung übernehmen).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { RATGEBER, ratgeberBySlug } from "@/lib/ratgeber";

const lies = (p: string) => readFileSync(p, "utf8");

/** Alle Quelltexte, die öffentlich sichtbaren Werbe- oder Ratgebertext tragen. */
function oeffentlicheTexte(): { datei: string; text: string }[] {
  const dateien = [
    "lib/ratgeber.ts",
    "lib/funktionen.ts",
    "lib/termine.ts",
    "app/(app)/anmelden/page.tsx",
    ...(readdirSync("components/landing", { recursive: true }) as string[]).filter((f) => /\.tsx?$/.test(f)).map((f) => join("components/landing", f)),
    ...(readdirSync("app/(pub)", { recursive: true }) as string[]).filter((f) => /\.tsx?$/.test(f)).map((f) => join("app/(pub)", f)),
    "components/LandingPage.tsx",
  ].filter((f) => existsSync(f));
  return dateien.map((datei) => ({ datei, text: lies(datei) }));
}

/** Text eines Ratgeber-Artikels (alle Absätze, Listen und der Funktionskasten). */
function artikelText(slug: string): string {
  const a = ratgeberBySlug(slug);
  if (!a) throw new Error(`Artikel fehlt: ${slug}`);
  return [a.intro, ...a.sektionen.flatMap((s) => [s.h ?? "", ...(s.p ?? []), ...(s.liste ?? [])]), a.feature?.text ?? ""].join("\n");
}

describe("Negativliste — nachweislich falsche Aussagen kommen nicht zurück", () => {
  const NEGATIV: [RegExp, string][] = [
    [/Umlage-Assistent/, "C41: den Umlage-Assistenten gibt es seit 07.10.2026 nicht mehr (/umlage leitet um)"],
    [/je Mandat sauber getrennt|Mandate getrennt\)/, "B50: es gibt keine Mandantentrennung (lib/rolle.ts: Hausverwaltung = Vermieter)"],
    [/Teams, Rechte/, "B50: Team-Zugänge und Rechte sind nicht gebaut"],
    [/mit Jahresrate in den Folgejahren|weist die Jahresrate in den Folgejahren automatisch aus/, "B49: § 82b gibt es nur als Rechner, nicht in der Anlage V"],
    [/Abschreibung mit Bemessungsgrundlage und Restlaufzeit/, "C41: keine AfA-Übernahme mit Restlaufzeit"],
    [/Kaufpreis, Nebenkosten, Gebäudeanteil/, "die AfA-Basis ist Kaufpreis × Gebäudeanteil, ohne Kaufnebenkosten (lib/anlageV.ts)"],
    [/Schornsteinfeger-Kehrarbeiten/, "B51: Schornsteinfeger sind Handwerkerleistungen (BMF 09.11.2016)"],
    [/trägt in der Regel der ausziehende Mieter/, "B47: BGH VIII ZR 19/07 — der Vermieter trägt sie"],
    [/überwiegend erneuerbarer Wärmeversorgung/, "B48: § 11 Abs. 1 Nr. 3 HeizkostenV nennt Wärmerückgewinnung, Solar, KWK/Abwärme"],
    [/rund 167 €/, "C35: § 12 Abs. 1 kürzt den nicht verbrauchsabhängigen Anteil → 180 €"],
    [/seit 2014 ist bei Neuinstallationen/, "C34: § 9 Abs. 2 HeizkostenV gilt für alle Anlagen"],
    [/§ 14b TrinkwV/, "C38: Legionellen-Untersuchung steht in § 31 TrinkwV 2023"],
    [/am 10\.12\.2025 in drei Verfahren/, "C36: Urteile vom 12.11.2025"],
    [/2026 hat etwa Berlin gesenkt/, "C36: Berlin senkte zum 01.01.2025 (810 → 470 %)"],
    [/freiwillig, aber deeskalierend/, "B46: elektronische Bereitstellung ist seit 2025 gesetzlich vorgesehen (§ 556 Abs. 4 S. 2 BGB)"],
    [/Geschuldet ist Einsicht in die Originalunterlagen/, "B46: der Vermieter darf elektronisch bereitstellen"],
  ];

  it("keine öffentliche Datei enthält eine der korrigierten Aussagen", () => {
    const texte = oeffentlicheTexte();
    expect(texte.length).toBeGreaterThan(10); // der Wächter hat wirklich gesucht
    const funde: string[] = [];
    for (const { datei, text } of texte) for (const [muster, grund] of NEGATIV) if (muster.test(text)) funde.push(`${datei}: ${muster} — ${grund}`);
    expect(funde).toEqual([]);
  });

  it("der Wächter erkennt die alten Sätze (Probe gegen den alten Wortlaut)", () => {
    const alt = [
      "Der Umlage-Assistent verteilt jede Position cent-genau",
      "Die Kosten der Zwischenablesung trägt in der Regel der ausziehende Mieter.",
      "Haushaltsnahe Dienstleistungen: Hausmeister, Gartenpflege, Treppenhausreinigung, Winterdienst, Schornsteinfeger-Kehrarbeiten.",
      "Im Beispiel oben wären das rund 167 € — pro Wohnung und pro Jahr.",
    ];
    for (const z of alt) expect(NEGATIV.some(([m]) => m.test(z)), z).toBe(true);
  });
});

describe("Normzitate — jede korrigierte Rechtsaussage mit Quelle", () => {
  // Abgerufen am 09.10.2026. Statute: gesetze-im-internet.de (Wortlaut). Rechtsprechung/Verwaltung:
  // mindestens zwei unabhängige Sekundärquellen, wo das Original nicht abrufbar war.
  const NORMZITATE: { slug: string; muss: RegExp; quelle: string }[] = [
    { slug: "belegeinsicht-was-mieter-verlangen-duerfen", muss: /§ 556 Abs\. 4 Satz 1 BGB/, quelle: "§ 556 Abs. 4 S. 1 BGB: Einsicht auf Verlangen" },
    { slug: "belegeinsicht-was-mieter-verlangen-duerfen", muss: /berechtigt, die Belege elektronisch bereitzustellen \(§ 556 Abs\. 4 Satz 2 BGB\)/, quelle: "§ 556 Abs. 4 S. 2 BGB (Wortlaut)" },
    { slug: "heizkostenabrechnung-50-70-regel-fernablesung", muss: /BGH, Urteil vom 14\.11\.2007, VIII ZR 19\/07/, quelle: "iww.de 27.03.2008; Berliner MieterGemeinschaft; anwaltonline" },
    { slug: "heizkostenabrechnung-50-70-regel-fernablesung", muss: /abweichende Vereinbarung im Mietvertrag geht vor \(§ 2 HeizkostenV\)/, quelle: "§ 2 HeizkostenV (Wortlaut)" },
    { slug: "heizkostenabrechnung-50-70-regel-fernablesung", muss: /Wärmerückgewinnung oder Solaranlagen versorgt werden \(§ 11 Abs\. 1 HeizkostenV\)/, quelle: "§ 11 Abs. 1 Nr. 3 a HeizkostenV" },
    { slug: "heizkostenabrechnung-50-70-regel-fernablesung", muss: /bis zum 30\. September 2025 eingebaut sein \(§ 12 Abs\. 3 HeizkostenV\)/, quelle: "§ 12 Abs. 3 S. 1 HeizkostenV" },
    { slug: "heizkostenabrechnung-50-70-regel-fernablesung", muss: /mit einem Wärmezähler zu messen.*\(§ 9 Abs\. 2 HeizkostenV\)/, quelle: "§ 9 Abs. 2 S. 1 und 2 HeizkostenV" },
    { slug: "heizkostenabrechnung-50-70-regel-fernablesung", muss: /15 % von 1\.200 € = 180 €/, quelle: "§ 12 Abs. 1 S. 1 HeizkostenV: nicht verbrauchsabhängiger Anteil" },
    { slug: "paragraf-35a-mieter-steuern-sparen", muss: /alle Schornsteinfegerleistungen.*BMF-Schreiben vom 9\.11\.2016/, quelle: "BMF 09.11.2016 Rz. 20 / Anlage 1; handwerksblatt.de; lohnsteuer-kompakt.de" },
    { slug: "grundsteuer-auf-mieter-umlegen", muss: /drei Urteilen vom 12\.11\.2025/, quelle: "Forvis Mazars; rewis.io (BFH II R 25/24 vom 12.11.2025)" },
    { slug: "grundsteuer-auf-mieter-umlegen", muss: /zum 1\. Januar 2025 von 810 auf 470 Prozent/, quelle: "berlin.de Senatsverwaltung für Finanzen" },
    { slug: "mieterhoehung-fristen-kappungsgrenze-formfehler", muss: /§ 559e BGB[\s\S]*10 Prozent[\s\S]*0,50 € je Quadratmeter/, quelle: "§ 559e Abs. 1 und 3 BGB (Wortlaut)" },
  ];

  for (const z of NORMZITATE) {
    it(`${z.slug}: ${z.quelle}`, () => {
      expect(artikelText(z.slug)).toMatch(z.muss);
    });
  }

  it("Anlage V: drei Formulare seit VZ 2023 — der Audit-Befund C37 („2021“) ist widerlegt", () => {
    // Stotax-Anleitung Anlage V 2023 („ab dem Veranlagungszeitraum 2023 in drei Anlagen unterteilt“),
    // Haufe zu den Vordrucken 2021 („Anlage V hat sich eigentlich nicht verändert“), Formularliste 2021
    // des Bayerischen Landesamts (eine Anlage V). Nicht auf 2021 „korrigieren“.
    expect(artikelText("anlage-v-ausfuellen-abschnitt-fuer-abschnitt")).toMatch(/Seit dem Veranlagungszeitraum 2023 ist die frühere zweiseitige Anlage V in drei Formulare aufgeteilt/);
  });

  it("Legionellen-Termin nennt § 31 TrinkwV und die Ausnahme für Ein- und Zweifamilienhäuser", () => {
    const t = lies("lib/termine.ts");
    expect(t).toMatch(/§ 31 Abs\. 2 Nr\. 2 a TrinkwV/);
    expect(t).toMatch(/Ein- und Zweifamilienhäuser sind ausgenommen \(§ 31 Abs\. 1 Nr\. 3 TrinkwV\)/);
  });

  it("überarbeitete Artikel tragen das Datum der Überarbeitung (dateModified)", () => {
    for (const slug of [
      "belegeinsicht-was-mieter-verlangen-duerfen", "heizkostenabrechnung-50-70-regel-fernablesung",
      "paragraf-35a-mieter-steuern-sparen", "grundsteuer-auf-mieter-umlegen", "mieterhoehung-fristen-kappungsgrenze-formfehler",
      "nebenkostenabrechnung-erstellen-schritt-fuer-schritt", "nebenkostenabrechnung-fristen-fehler",
    ]) expect(ratgeberBySlug(slug)!.aktualisiert, slug).toBe("2026-10-09");
    // Nicht überarbeitete Artikel bekommen kein frisches Datum (Falschsignal an Leser und Google).
    expect(ratgeberBySlug("afa-richtig-ansetzen-linear-degressiv")!.aktualisiert).toBeUndefined();
  });
});

describe("Werbe-Wächter — jede versprochene Funktion hat einen Beleg im Code", () => {
  // Aussage im öffentlichen Text → Stelle im Code, die sie wahr macht. Fällt der Beleg weg, muss der Text mit.
  const BELEGE: { text: RegExp; datei: string; beleg: RegExp; was: string }[] = [
    { text: /AfA-Assistent rechnet Sofortabzug und Verteilung über zwei bis fünf Jahre/, datei: "components/kalkulator/AfaAssistent.tsx", beleg: /verteile82b\(/, was: "§ 82b-Rechner" },
    { text: /Der AfA-Assistent in MyImmo rechnet für eine Erhaltungsmaßnahme den Betrag je Jahr/, datei: "lib/steuer/afa.ts", beleg: /verteiltErsparnisProJahr/, was: "Steuerersparnis je Jahr" },
    { text: /Steuer-Wächter meldet/, datei: "lib/steuer/waechter.ts", beleg: /export function steuerWaechter/, was: "15-%-Wächter" },
    { text: /Fläche, Einheiten, Personen, Verbrauch oder Miteigentumsanteil/, datei: "lib/nkObjekt.ts", beleg: /NK_SCHLUESSEL = \["flaeche", "personen", "einheiten", "mea", "verbrauch"/, was: "NK-Schlüssel" },
    { text: /Im Mehrfamilienhaus tragen Sie den Jahresbetrag einmal am Objekt ein/, datei: "lib/nkPositionen.ts", beleg: /export async function ladeNkPositionen/, was: "Nebenkosten am Objekt" },
    { text: /§ 35a-Ausweis/, datei: "lib/pdf/nkPdf.ts", beleg: /35a/, was: "§ 35a im NK-PDF" },
    { text: /Abschreibung aus Kaufpreis, Gebäudeanteil und Baujahr/, datei: "lib/anlageV.ts", beleg: /g\.afaBasis = r2\(\(kaufpreis \* gebAnteil\) \/ 100\)/, was: "AfA-Basis (Funktionsseite)" },
    { text: /Kaufnebenkosten rechnet MyImmo derzeit nicht in die Bemessungsgrundlage ein/, datei: "lib/anlageV.ts", beleg: /g\.afaBasis = r2\(\(kaufpreis \* gebAnteil\) \/ 100\)/, was: "AfA-Basis ohne Kaufnebenkosten" },
  ];

  const alle = () => oeffentlicheTexte().map((t) => t.text).join("\n");

  for (const b of BELEGE) {
    it(`${b.was}: Text und Beleg stehen beide`, () => {
      expect(alle(), "Werbetext fehlt — dann den Eintrag hier entfernen").toMatch(b.text);
      expect(lies(b.datei)).toMatch(b.beleg);
    });
  }

  it("„geplant“ bleibt „geplant“: nicht gebaute Business-Funktionen stehen als geplant da", () => {
    const d = lies("components/landing/data.tsx");
    for (const z of ["Getrennte Mandate (geplant)", "Team-Zugänge (geplant)", "Sammel-Funktionen (geplant)"]) expect(d).toContain(z);
  });

  it("alle 17 Ratgeber sind geladen (der Wächter liest den echten Bestand)", () => {
    expect(RATGEBER.length).toBeGreaterThanOrEqual(17);
  });
});
