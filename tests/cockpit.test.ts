import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import {
  bewerteBetrieb,
  ampelBilanz,
  BESUCHER_MESSUNG_AKTIV,
  type Betriebslage,
} from "@/lib/cockpit/betrieb";
import { OFFENE_DOKU_PUNKTE } from "@/lib/cockpit/doku";
import { pruefAmpel } from "@/lib/cockpit/github";
import { budgetAnteil } from "@/lib/cockpit/agency";
import { istBetreiber } from "@/lib/cockpit/zugang";

// Betreiber-Cockpit: die Bewertungslogik und die Wächter darüber.
//
// Der Rest der Seite (Laden, Rendern) ist Server-Code gegen fremde APIs — der
// steht im Rauchtest, nicht hier. Geprüft wird, was eine falsche Aussage auf
// die Seite bringen könnte: die Ampel-Zuordnung, der Zugang, die Doku-Liste
// und die eine von Hand gepflegte Konstante.

const ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ENV };
});

const AUS: Betriebslage = {
  billingAktiv: false,
  preiseSichtbar: false,
  registrierungOffen: false,
  brevoBereit: false,
  betaCode: false,
  verschluesselung: false,
  cronSecret: false,
  serviceRoleKey: false,
  anthropicKey: false,
  bedrockVollstaendig: false,
  besucherMessung: false,
  agencyVerbunden: false,
  githubVerbunden: false,
  ownerGesetzt: false,
};
const AN: Betriebslage = Object.fromEntries(
  Object.keys(AUS).map((k) => [k, true]),
) as Betriebslage;

const punkt = (l: Betriebslage, id: string) => {
  const p = bewerteBetrieb(l).find((x) => x.id === id);
  if (!p) throw new Error(`Prüfpunkt "${id}" fehlt`);
  return p;
};

describe("istBetreiber", () => {
  beforeEach(() => {
    delete process.env.OWNER_USER_ID;
  });

  it("ohne OWNER_USER_ID darf NIEMAND hinein — auch nicht der erste Angemeldete", () => {
    expect(istBetreiber("irgendeine-id")).toBe(false);
    expect(istBetreiber(null)).toBe(false);
  });

  it("nur die genaue ID aus der Env", () => {
    process.env.OWNER_USER_ID = "abc-123";
    expect(istBetreiber("abc-123")).toBe(true);
    expect(istBetreiber("abc-124")).toBe(false);
    expect(istBetreiber("")).toBe(false);
    expect(istBetreiber(undefined)).toBe(false);
  });

  it("Leerzeichen in der Env brechen den Vergleich nicht", () => {
    process.env.OWNER_USER_ID = "  abc-123  ";
    expect(istBetreiber("abc-123")).toBe(true);
  });

  it("eine leere Env zählt als nicht gesetzt", () => {
    process.env.OWNER_USER_ID = "   ";
    expect(istBetreiber("abc-123")).toBe(false);
  });
});

describe("bewerteBetrieb", () => {
  it("liefert zu jedem Punkt einen erklärenden Satz — keine leeren Zeilen", () => {
    for (const p of [...bewerteBetrieb(AUS), ...bewerteBetrieb(AN)]) {
      expect(p.detail.length).toBeGreaterThan(20);
      expect(p.titel.length).toBeGreaterThan(3);
      expect(p.herkunft).toBe("gemessen");
    }
  });

  it("alles aus: nichts steht auf ok", () => {
    expect(bewerteBetrieb(AUS).every((p) => p.ampel !== "ok")).toBe(true);
  });

  it("alles an: nichts bleibt offen", () => {
    expect(bewerteBetrieb(AN).every((p) => p.ampel === "ok")).toBe(true);
  });

  it("KI: Bedrock schlägt Anthropic, Anthropic allein ist nur eine Warnung", () => {
    expect(punkt({ ...AUS, bedrockVollstaendig: true, anthropicKey: true }, "ki").ampel).toBe("ok");
    expect(punkt({ ...AUS, anthropicKey: true }, "ki").ampel).toBe("warnung");
    expect(punkt(AUS, "ki").ampel).toBe("offen");
  });

  it("Cron braucht BEIDE Geheimnisse", () => {
    expect(punkt({ ...AUS, cronSecret: true }, "cron").ampel).toBe("offen");
    expect(punkt({ ...AUS, serviceRoleKey: true }, "cron").ampel).toBe("offen");
    expect(punkt({ ...AUS, cronSecret: true, serviceRoleKey: true }, "cron").ampel).toBe("ok");
  });

  it("nennt beim Cron, WELCHES Geheimnis fehlt", () => {
    const d = punkt({ ...AUS, cronSecret: true }, "cron").detail;
    expect(d).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(d).not.toContain("CRON_SECRET,");
  });

  it("trennt, wer etwas erledigen kann", () => {
    const p = bewerteBetrieb(AUS);
    expect(p.find((x) => x.id === "preise")?.wer).toBe("code");
    expect(p.find((x) => x.id === "betacode")?.wer).toBe("betreiber");
  });

  it("vergibt jede id nur einmal", () => {
    const ids = bewerteBetrieb(AUS).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("ampelBilanz", () => {
  it("zählt jede Stufe, auch die leeren", () => {
    const b = ampelBilanz(bewerteBetrieb(AN));
    expect(b.ok).toBeGreaterThan(5);
    expect(b.offen).toBe(0);
    expect(b.kritisch).toBe(0);
  });
});

describe("pruefAmpel", () => {
  it("rot schlägt laufend schlägt grün", () => {
    expect(pruefAmpel([])).toBe("unbekannt");
    expect(pruefAmpel([{ ergebnis: "success", laeuft: false }])).toBe("ok");
    expect(pruefAmpel([{ ergebnis: null, laeuft: true }])).toBe("warnung");
    expect(
      pruefAmpel([
        { ergebnis: "success", laeuft: false },
        { ergebnis: "failure", laeuft: false },
      ]),
    ).toBe("kritisch");
    // Ein roter Lauf bleibt rot, auch wenn daneben noch einer läuft.
    expect(
      pruefAmpel([
        { ergebnis: "failure", laeuft: false },
        { ergebnis: null, laeuft: true },
      ]),
    ).toBe("kritisch");
  });

  it("übersprungen und neutral gelten als grün, Unbekanntes nicht", () => {
    expect(pruefAmpel([{ ergebnis: "skipped", laeuft: false }])).toBe("ok");
    expect(pruefAmpel([{ ergebnis: "action_required", laeuft: false }])).toBe("unbekannt");
  });
});

describe("budgetAnteil", () => {
  it("Deckel 0 ist VOLL, nicht leer — gesperrt darf nicht unberührt aussehen", () => {
    expect(budgetAnteil({ deckel_usd: 0, ausgaben_monat_usd: 0 })).toBe(1);
  });

  it("rechnet den Anteil und deckelt bei 1", () => {
    expect(budgetAnteil({ deckel_usd: 25, ausgaben_monat_usd: 5 })).toBeCloseTo(0.2);
    expect(budgetAnteil({ deckel_usd: 25, ausgaben_monat_usd: 40 })).toBe(1);
    expect(budgetAnteil({ deckel_usd: 25, ausgaben_monat_usd: -3 })).toBe(0);
  });
});

describe("Doku-Liste (von Hand gepflegt)", () => {
  it("jeder Eintrag trägt Stand-Datum, Quelle und eine Erklärung", () => {
    expect(OFFENE_DOKU_PUNKTE.length).toBeGreaterThan(0);
    for (const p of OFFENE_DOKU_PUNKTE) {
      expect(p.herkunft).toBe("doku");
      expect(p.stand).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(p.stand!))).toBe(false);
      expect(p.quelle && p.quelle.length > 5).toBe(true);
      expect(p.detail.length).toBeGreaterThan(30);
      expect(p.wer).toBe("betreiber");
    }
  });

  it("enthält nur Offenes — ein erledigter Punkt wird gelöscht, nicht abgehakt", () => {
    expect(OFFENE_DOKU_PUNKTE.every((p) => p.ampel !== "ok")).toBe(true);
  });

  it("vergibt jede id nur einmal", () => {
    const ids = OFFENE_DOKU_PUNKTE.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("Wächter: Besuchermessung", () => {
  // Die Konstante ist eine Aussage über das eigene System. Sie darf nicht
  // „nicht gemessen“ behaupten, während ein Analytics-Paket installiert ist.
  const ANALYTICS_PAKETE = [
    "@vercel/analytics",
    "plausible-tracker",
    "posthog-js",
    "@posthog/node",
    "react-ga4",
    "@sentry/nextjs",
  ];

  it("stimmt mit der package.json überein", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const alle = { ...pkg.dependencies, ...pkg.devDependencies };
    const gefunden = ANALYTICS_PAKETE.filter((p) => p in alle);
    if (gefunden.length > 0) {
      expect(
        BESUCHER_MESSUNG_AKTIV,
        `${gefunden.join(", ")} ist installiert — BESUCHER_MESSUNG_AKTIV in lib/cockpit/betrieb.ts auf true setzen UND /datenschutz Ziffer 2 anpassen.`,
      ).toBe(true);
    } else {
      expect(BESUCHER_MESSUNG_AKTIV).toBe(false);
    }
  });
});
