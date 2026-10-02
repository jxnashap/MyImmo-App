import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  KATEGORIEN, NOTFALL_TEXT, baueMeldung, kategorie, notfallFuer, TITEL_MAX, BESCHREIBUNG_MAX,
} from "@/lib/schadensmeldung";

// Geführte Schadensmeldung + Notfall (02.10.2026, Schritt 5 des Mieterportal-Plans).
// Regelbasierte Rückfragen, keine KI. Bei Gefahr steht 112 und die Sofortmaßnahme ZUERST.

const k = (key: string) => kategorie(key)!;

describe("Notfall", () => {
  it("Gasgeruch ist immer ein Notfall — ohne eine einzige Frage", () => {
    expect(notfallFuer(k("gas"), {})).toBe("gas");
  });
  it("auslaufendes Wasser und verschmorte Elektrik lösen den passenden Hinweis aus — nur bei „Ja“", () => {
    expect(notfallFuer(k("wasser"), { laeuft: "Ja" })).toBe("wasser");
    expect(notfallFuer(k("wasser"), { laeuft: "Nein" })).toBeNull();
    expect(notfallFuer(k("strom"), { gefahr: "Ja" })).toBe("strom");
    expect(notfallFuer(k("heizung"), { umfang: "Ein Heizkörper" })).toBeNull();
  });
  it("jeder Hinweis nennt 112, und es steht keine erfundene Telefonnummer darin", () => {
    for (const [art, n] of Object.entries(NOTFALL_TEXT)) {
      const alles = n.schritte.join(" ");
      if (art !== "wasser") expect(alles, art).toContain("112");
      // Nur 112 als Nummer — Entstörungsnummern sind je Netzbetreiber verschieden.
      expect(alles.match(/\d{3,}/g) ?? [], art).toEqual(art === "wasser" ? [] : ["112"]);
    }
  });
  it("die Gas-Anweisung beginnt mit dem, was man NICHT tun darf", () => {
    expect(NOTFALL_TEXT.gas.schritte[0]).toMatch(/^Keine Schalter/);
  });
  it("jede Notfall-Frage hat eine Antwort, die es auslöst, und die gibt es als Option", () => {
    for (const kat of KATEGORIEN) for (const f of kat.fragen) {
      if (f.notfallBei) expect(f.optionen, `${kat.key}.${f.key}`).toContain(f.notfallBei);
    }
  });
});

describe("Meldung bauen", () => {
  it("Titel aus Art, erster Antwort und Raum; Beschreibung mit Frage und Antwort", () => {
    const m = baueMeldung(k("heizung"), { umfang: "Mehrere oder alle Heizkörper", stoerung: "Nein" }, { raum: "Wohnzimmer", seit: "Heute", text: "Seit heute früh kalt.", erreichbar: "ab 16 Uhr" });
    expect(m.titel).toBe("Heizung / Warmwasser · Mehrere oder alle Heizkörper · (Wohnzimmer)");
    expect(m.beschreibung).toBe([
      "Was ist betroffen? Mehrere oder alle Heizkörper",
      "Zeigt die Heizung/Therme eine Störung an? Nein",
      "Raum / Ort: Wohnzimmer",
      "Seit wann: Heute",
      "Erreichbar / Zugang: ab 16 Uhr",
      "",
      "Seit heute früh kalt.",
    ].join("\n"));
  });
  it("Werte aus dem Browser: nur erlaubte Optionen und nur Fragen dieser Art gehen hinein", () => {
    const m = baueMeldung(k("wasser"), { art: "<script>", laeuft: "Ja", fremd: "Hallo" }, { seit: "gestern erfunden" });
    expect(m.beschreibung).toBe("Läuft gerade Wasser aus, das du nicht stoppen kannst? Ja");
    expect(m.titel).toBe("Wasser / Sanitär · Ja");
  });
  it("„Etwas anderes“ macht keinen Titel-Zusatz; Längen bleiben in den Grenzen", () => {
    expect(baueMeldung(k("strom"), { art: "Etwas anderes" }, {}).titel).toBe("Strom / Elektrik");
    const lang = baueMeldung(k("sonstiges"), {}, { raum: "x".repeat(500), text: "y".repeat(5000) });
    expect(lang.titel.length).toBeLessThanOrEqual(TITEL_MAX);
    expect(lang.beschreibung.length).toBeLessThanOrEqual(BESCHREIBUNG_MAX);
  });
});

describe("Anbindung", () => {
  const portal = readFileSync("components/AnliegenPortal.tsx", "utf8");
  const assistent = readFileSync("components/SchadenAssistent.tsx", "utf8");
  it("„Schaden melden“ öffnet den Assistenten; das kurze Formular bietet keinen Schaden mehr an", () => {
    expect(portal).toContain("<SchadenAssistent");
    expect(portal).not.toContain('<option value="schaden">');
  });
  it("der Assistent sendet über dieselbe Action wie jedes Anliegen, als Schaden", () => {
    expect(assistent).toContain("await erstelleAnliegen(fd)");
    expect(assistent).toContain('fd.set("typ", "schaden")');
    // Vermieter/Wohnung kommen NICHT aus dem Formular.
    expect(assistent).not.toMatch(/fd\.set\("(vermieter_id|mieter_id|prop_id)"/);
  });
  it("bei einem Notfall steht der Hinweis VOR den Fragen", () => {
    expect(assistent.indexOf("<NotfallSofort")).toBeLessThan(assistent.indexOf("k.fragen.map"));
  });
});
