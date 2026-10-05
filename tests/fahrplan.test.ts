import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { fahrplan, fortschritt, type FahrplanDaten } from "@/lib/fahrplan";
import { MAKLER_CHECKLISTE } from "@/lib/makler";
import { kaufnebenkosten, kaufnebenkostenSatz, MAKLER_STANDARD_PROZENT, NOTAR_GRUNDBUCH_SATZ } from "@/lib/kalk";
import { demoBereich, demoSperrZiel } from "@/lib/demo";

// BuyImmo-Fahrplan (05.10.2026). Drei Dinge werden festgehalten: (1) ein Haken steht nur, wo
// BuyImmo es aus den Daten weiß; (2) kein Text urteilt über die Person (§ 34i GewO — Anwalt
// offen); (3) jedes Ziel führt auf eine Seite, die es gibt — auch in der Demo.

const LEER: FahrplanDaten = { hatSelbstauskunft: false, makler: [], kaufpruefungen: 0, vertreterGueltig: false, objekte: 0 };
const status = (d: FahrplanDaten, id: string) => fahrplan(d).find((s) => s.id === id)!.status;

describe("fahrplan — Status nur aus Daten", () => {
  it("neues Konto: prüfbare Schritte offen, unprüfbare ohne Status", () => {
    const s = fahrplan(LEER);
    expect(s.map((x) => x.id)).toEqual([
      "kassensturz", "selbstauskunft", "finanzierung", "unterlagen", "besichtigen", "durchrechnen", "beantragen", "notar", "uebergabe",
    ]);
    expect(status(LEER, "selbstauskunft")?.art).toBe("offen");
    expect(status(LEER, "unterlagen")).toEqual({ art: "offen", text: `0 von ${MAKLER_CHECKLISTE.length}` });
    for (const id of ["kassensturz", "besichtigen", "beantragen", "notar", "uebergabe"]) expect(status(LEER, id), id).toBeNull();
    expect(fortschritt(s)).toEqual({ erledigt: 0, pruefbar: 4 });
  });

  it("alles erledigt: vier von vier, Vertreter und Bestand als Hinweis (zählen nicht mit)", () => {
    const d: FahrplanDaten = {
      hatSelbstauskunft: true,
      makler: MAKLER_CHECKLISTE.map((i) => ({ item_key: i.key, status: "erledigt" })),
      kaufpruefungen: 2,
      vertreterGueltig: true,
      objekte: 1,
    };
    expect(status(d, "durchrechnen")?.text).toBe("2 Objekte gespeichert");
    expect(status(d, "notar")).toEqual({ art: "info", text: "Vertreter mit gültiger Vollmacht hinterlegt" });
    expect(status(d, "uebergabe")?.text).toBe("1 Objekt im Bestand");
    expect(fortschritt(fahrplan(d))).toEqual({ erledigt: 4, pruefbar: 4 });
  });

  it("Makler-Ordner teilweise; Finanzierungsbestätigung zählt nur, wenn ERLEDIGT", () => {
    const hochgeladen: FahrplanDaten = { ...LEER, makler: [{ item_key: "finanzierungsbestaetigung", status: "hochgeladen" }] };
    expect(status(hochgeladen, "finanzierung")?.art).toBe("offen");
    const erledigt: FahrplanDaten = { ...LEER, makler: [{ item_key: "finanzierungsbestaetigung", status: "erledigt" }] };
    expect(status(erledigt, "finanzierung")?.art).toBe("erledigt");
    expect(status(erledigt, "unterlagen")).toEqual({ art: "teilweise", text: `1 von ${MAKLER_CHECKLISTE.length}` });
  });

  it("kein Text urteilt über die Person oder empfiehlt einen Kauf", () => {
    const texte = fahrplan(LEER).flatMap((s) => [s.titel, s.satz, ...s.punkte, s.ziel?.label ?? ""]);
    const seite = readFileSync("app/(app)/fahrplan/page.tsx", "utf8") + readFileSync("components/NebenkostenRechner.tsx", "utf8");
    // Der Erkenner ist nicht blind: Er findet die Formulierungen, nach denen er sucht.
    const VERBOTEN = /empfehl|solltest|kannst dir .* leisten|du kannst kaufen|lohnt sich|jetzt kaufen/i;
    expect(VERBOTEN.test("Wir empfehlen dir")).toBe(true);
    expect(texte.length).toBeGreaterThan(20);
    expect(texte.filter((t) => VERBOTEN.test(t))).toEqual([]);
    // Kommentarzeilen auslassen — sie dürfen die Grenze erklären.
    const ohneKommentare = seite.split("\n").filter((z) => !/^\s*(\/\/|\*|\{\/\*)/.test(z)).join("\n");
    expect(ohneKommentare).not.toMatch(VERBOTEN);
  });

  it("jedes Ziel ist eine echte Seite und in der Demo frei oder erklärt", () => {
    const ersatz = demoBereich("/gibt-es-nicht").titel;
    for (const s of fahrplan(LEER)) {
      if (!s.ziel) continue;
      const pfad = s.ziel.href.split("?")[0];
      expect(existsSync(`app/(app)${pfad}/page.tsx`), pfad).toBe(true);
      const sperre = demoSperrZiel(s.ziel.href, "https://www.myimmoapp.de/fahrplan");
      if (sperre) expect(demoBereich(sperre).titel, s.ziel.href).not.toBe(ersatz);
    }
  });
});

describe("kaufnebenkosten — EINE Regel für Kauf-Rechner und Fahrplan", () => {
  it("250.000 € in Bayern mit Makler: 8.750 + 5.000 + 8.925 = 22.675 €", () => {
    const nk = kaufnebenkosten(250_000, 0.035, MAKLER_STANDARD_PROZENT);
    expect(nk.grunderwerbsteuer).toBeCloseTo(8750, 6);
    expect(nk.notarGrundbuch).toBeCloseTo(5000, 6);
    expect(nk.makler).toBeCloseTo(8925, 6);
    expect(nk.summe).toBeCloseTo(22675, 6);
    expect(nk.satz).toBeCloseTo(0.0907, 6);
  });

  it("ohne Makler und mit Unsinn: nie negativ", () => {
    expect(kaufnebenkosten(250_000, 0.065, 0).summe).toBeCloseTo(21250, 6); // 16.250 + 5.000
    expect(kaufnebenkosten(-1, 0.05, 3.57).summe).toBe(0);
    expect(kaufnebenkosten(100_000, Number.NaN, -3).summe).toBeCloseTo(100_000 * NOTAR_GRUNDBUCH_SATZ, 6);
  });

  it("der Kauf-Rechner rechnet mit derselben Funktion", () => {
    expect(kaufnebenkostenSatz(0.05, 3.57)).toBeCloseTo(0.1057, 6);
    const rechner = readFileSync("components/kauf/ObjektRechner.tsx", "utf8");
    expect(rechner).toContain("kaufnebenkostenSatz(grestSatz, num(makler))");
    expect(rechner).not.toMatch(/\+\s*0\.02\b/);
  });
});
