// Durchsicht 21.10.2026, Paket 5 + Betreiber-Entscheidungen: Install-Hinweis für Mieter, einheitliche
// Begriffe (Objekt · Kredit · Anliegen), verständliche Fehlertexte, „bereitstellen“ statt „zustellen“,
// Befehlspalette und Bereiche. Start-Checkliste und Tour: tests/startCheckliste.test.ts.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { VERWALTEN, ABRECHNEN } from "@/lib/nav";
import { bereichFuer, eigenerBereich } from "@/lib/bereich";
import { baueHeuteAufgaben } from "@/lib/heute";

const lies = (p: string) => readFileSync(p, "utf8");
const ohneKommentare = (s: string) => s.split("\n").filter((z) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(z)).join("\n");

function dateien(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) dateien(p, out);
    else if (/\.(tsx?|mjs)$/.test(n)) out.push(p);
  }
  return out;
}

// Die Oberfläche der Verwaltung — ohne Startseite (dort darf „Immobilie“ stehen), ohne BuyImmo
// (Kauf einer Immobilie, Darlehensarten) und ohne die Anlage-V-Dateien (nicht anfassen).
const BUYIMMO = /components\/(landing|kauf|aufbau|strategie|sanierung)\/|LandingPage|KaufAssistent|DarlehenWizard|app\/\(app\)\/(aufbau|strategie|vergleich|fahrplan|abschluss|sanierung|kauf|makler|verkauf|bewertung)\//;
const ANLAGE_V = /AnlageVExport|ElsterHilfe|app\/\(app\)\/steuer\//;
const OBERFLAECHE = [...dateien("app/(app)"), ...dateien("components")].filter((p) => !BUYIMMO.test(p) && !ANLAGE_V.test(p));

describe("Install-Hinweis für Mieter (Betreiber: ruhig unten auf der Startseite)", () => {
  const ai = lies("components/AppInstallieren.tsx");
  it("die ruhige Fassung erscheint nur, wenn sich die App hier installieren lässt", () => {
    expect(ai).toMatch(/if \(ruhig && \(weg === null \|\| weg === "installiert" \|\| weg === "nicht"\)\) return null;/);
  });
  it("auf „Meine Wohnung“ am Ende, nicht in der Vermieter-Vorschau", () => {
    const pa = ohneKommentare(lies("components/PortalAnsicht.tsx"));
    expect(pa).toMatch(/\{!vorschau && <AppInstallieren ruhig \/>\}/);
    // Nach den Haus-Infos, also unten — nicht vor „Schaden melden“.
    expect(pa.indexOf("<AppInstallieren ruhig />")).toBeGreaterThan(pa.indexOf("<HausInfosKarte"));
  });
  it("unter „Konto“ steht die Anleitung vor „Konto löschen“", () => {
    const k = ohneKommentare(lies("app/(app)/konto/page.tsx"));
    expect(k.indexOf("<AppInstallieren />")).toBeGreaterThan(-1);
    expect(k.indexOf("<AppInstallieren />")).toBeLessThan(k.indexOf("<KontoVerwaltung"));
  });
});

describe("Begriffe: Objekt · Kredit · Anliegen (Betreiber 21.10.2026)", () => {
  it("Navigation sagt Objekte, Kredite, Übersicht", () => {
    const labels = [...VERWALTEN, ...ABRECHNEN].map((n) => n.label);
    expect(labels).toContain("Objekte");
    expect(labels).toContain("Kredite");
    expect(labels).toContain("Übersicht");
    expect(labels).not.toContain("Immobilien");
    expect(labels).not.toContain("Dashboard");
  });
  it("kein Feld, keine Spalte und kein Filter heißt in der Verwaltung „Immobilie“", () => {
    const funde: string[] = [];
    for (const p of OBERFLAECHE) {
      const s = ohneKommentare(lies(p));
      if (/<label>Immobilie|<th>Immobilie<\/th>|label: "Immobilien?"|"Alle Immobilien"|>Immobilie<\/span>|"Immobilie (angelegt|gespeichert|bearbeiten|erfassen)/.test(s)) funde.push(p);
    }
    expect(funde).toEqual([]);
  });
  it("Kredite heißen in der Oberfläche Kredit — Vertragsbegriffe (Darlehensvertrag, Darlehenssumme) bleiben", () => {
    const funde: string[] = [];
    for (const p of OBERFLAECHE) {
      const s = ohneKommentare(lies(p));
      if (/\|\| "Darlehen"|\?\? "Darlehen"|Darlehen erfassen|Darlehen bearbeiten|Noch keine Darlehen|Darlehen anlegen|\/> Darlehen<\/Link>/.test(s)) funde.push(p);
    }
    expect(funde).toEqual([]);
    expect(lies("app/(app)/kredite/new/page.tsx")).toMatch(/laut Darlehensvertrag/);
  });
  it("Anliegen statt Meldungen in der Vermieter-Liste", () => {
    expect(lies("components/AnliegenManager.tsx")).toMatch(/<ArrowLeft size=\{14\} \/> Alle Anliegen/);
    expect(lies("app/(app)/anliegen/page.tsx")).not.toMatch(/Meldungen deiner Mieter/);
    expect(lies("scripts/rauchtest.mjs")).toMatch(/"Alle Anliegen"/);
  });
  it("Erfolgsmeldungen beim Objekt sagen „Objekt“", () => {
    const a = lies("lib/actions/properties.ts");
    expect(a).toMatch(/"Objekt angelegt\."/);
    expect(a).toMatch(/"Objekt gespeichert\."/);
  });
});

describe("Fehlertexte sagen, was zu tun ist", () => {
  const code = [...dateien("lib"), ...dateien("app"), ...dateien("components")].filter((p) => !p.endsWith(".mjs"));
  it("kein nacktes „Nicht angemeldet.“ / „Speichern fehlgeschlagen.“ / „Ungültige Eingabe.“ mehr", () => {
    const funde = code.filter((p) => /"Nicht angemeldet\."|"Speichern fehlgeschlagen\."|"Ungültige Eingabe\."/.test(lies(p)));
    expect(funde).toEqual([]);
  });
  it("die Fehlerseite der App bietet „Neu laden“ und nennt keine Rätsel (IBAN, Beträge > 0)", () => {
    const e = lies("app/(app)/error.tsx");
    expect(e).toMatch(/window\.location\.reload\(\)/);
    expect(e).not.toMatch(/IBAN/);
  });
  it("Hinweise ohne Adressen und Fachkürzel", () => {
    expect(lies("lib/actions/properties.ts")).not.toMatch(/auf \/cashflow prüfen/);
    expect(lies("components/MaklerOrdner.tsx")).not.toMatch(/RLS/);
    expect(lies("components/nk/NkObjektEditor.tsx")).not.toMatch(/Schlüssel MEA|>MEA\n/);
  });
});

describe("„bereitstellen“ statt „zustellen“ (Paket P4, Regel 2)", () => {
  it("die drei Portal-Knöpfe sagen bereitstellen", () => {
    for (const p of ["components/NkSpeichernButton.tsx", "components/DokumentZustellung.tsx", "components/BriefVersand.tsx"]) {
      const s = ohneKommentare(lies(p));
      expect(s, p).not.toMatch(/Ins Mieterportal zustellen|Jetzt zustellen|zustellen`\}|zustellen an<\/div>/);
      expect(s, p).toMatch(/bereitstellen|bereitgestellt/);
    }
  });
  it("die Dashboard-Aufgabe sagt „noch nicht geöffnet“ statt „Zugang nicht belegt“", () => {
    const a = baueHeuteAufgaben(
      { offeneMieten: [], anliegen: [], meldungen: [], fristen: [], nichtAbgerufen: [{ mieter: "Anna", mieterId: "m1", titel: "NK 2025", zugestellt: "2026-10-01T10:00:00Z" }] },
      "2026-10-21",
    );
    const z = a.find((x) => x.label.startsWith("Nicht abgerufen"));
    expect(z?.sub).toMatch(/noch nicht geöffnet/);
  });
});

describe("Befehlspalette und Bereiche", () => {
  const cp = lies("components/ui/CommandPalette.tsx");
  const alias = (href: string) => (new RegExp(`"${href.replace(/\//g, "\\/")}": "([^"]*)"`).exec(cp)?.[1] ?? "").split(" ");
  it("„miete“ führt ins Mietkonto, nicht zum Buchen von Hand", () => {
    expect(alias("/mietkonto")).toContain("miete");
    expect(alias("/cashflow")).not.toContain("miete");
  });
  it("alte Namen finden die neuen Bereiche", () => {
    expect(alias("/properties")).toContain("immobilie");
    expect(alias("/")).toContain("dashboard");
  });
  it("Aktionen: Mieteingänge bestätigen und Beleg hochladen", () => {
    expect(cp).toMatch(/label: "Mieteingänge bestätigen", href: "\/mietkonto"/);
    expect(cp).toMatch(/label: "Beleg hochladen", href: "\/cashflow\/belege"/);
  });
  it("der AfA-Assistent behält den Bereich, aus dem man kommt", () => {
    expect(eigenerBereich("/afa-assistent")).toBeNull();
    expect(bereichFuer("/afa-assistent", "verwaltung")).toBe("verwaltung");
  });
  it("Absender-Hinweise führen auf den Profil-Reiter", () => {
    expect(lies("components/DocGenerator.tsx")).toMatch(/href="\/einstellungen\?tab=profil"/);
    expect(lies("app/(app)/tenants/[id]/nk/page.tsx")).toMatch(/href="\/einstellungen\?tab=profil"/);
  });
});

describe("Mieterliste und Monatsnamen", () => {
  const t = ohneKommentare(lies("app/(app)/tenants/page.tsx"));
  it("Kacheln erst mit Mietern, Leerzustand über <Leer>", () => {
    expect(t).toMatch(/\{alle\.length > 0 && \(\s*<div className="staffel grid-4 mb-20">/);
    expect(t).toMatch(/<Leer icon=\{User\} art="filter"/);
    expect(t).toMatch(/aktion=\{\{ href: "\/tenants\/new", label: "Mieter anlegen" \}\}/);
  });
  it("Cashflow nennt den Monat beim Namen, nicht „2026-10“, und sagt nicht „Soll-Miete“", () => {
    const c = lies("app/(app)/cashflow/page.tsx");
    expect(c).not.toMatch(/Für \{aktuellerMonat\} ergibt sich keine Soll-Miete/);
    expect(c).toMatch(/ist keine Miete fällig/);
  });
});
