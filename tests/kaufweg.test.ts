import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KAUFWEG, naechsterSchritt, schrittStand, vorigerSchritt, wegSchritt } from "@/lib/kaufweg";
import { fahrplan, type FahrplanDaten } from "@/lib/fahrplan";
import { UEBERBLICK, WEG, WERKZEUGE } from "@/lib/nav";
import { BEREICHE } from "@/lib/bereich";
import { demoBereich, demoDarfRoute } from "@/lib/demo";
import { MAKLER_CHECKLISTE } from "@/lib/makler";

// Umbau BuyImmo (06.10.2026, Jonas): „Step by Step gegliedert, dass es so in der Reihenfolge links auch
// in den Reitern ist“. Festgehalten: EINE Liste der Schritte (lib/kaufweg.ts) für Seitenleiste, Kopf,
// Cockpit und Fahrplan; jede Fahrplan-Station gehört zu genau einem Schritt; die Reihenfolge ist
// vergleichen → besichtigen → finanzieren → Unterlagen → Notar; kein Text rät.

vi.mock("next/navigation", () => ({
  usePathname: () => pfad,
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, refresh: () => {} }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _p, ...rest }: { href: string; children?: ReactNode; prefetch?: boolean }) =>
    createElement("a", { href, ...rest }, children),
}));
let pfad = "/aufbau";

const LEER: FahrplanDaten = { hatSelbstauskunft: false, makler: [], kaufpruefungen: 0, vertreterGueltig: false, objekte: 0 };

describe("Kaufweg — die eine Liste", () => {
  it("fünf Schritte in Jonas’ Reihenfolge, nummeriert 1 bis 5", () => {
    expect(KAUFWEG.map((s) => s.id)).toEqual(["vergleichen", "besichtigen", "finanzieren", "unterlagen", "abschluss"]);
    expect(KAUFWEG.map((s) => s.nr)).toEqual([1, 2, 3, 4, 5]);
    expect(KAUFWEG.map((s) => s.href)).toEqual(["/vergleich", "/sanierung", "/kauf", "/makler", "/abschluss"]);
  });

  it("jeder Schritt ist eine echte Seite — in der Demo offen oder im Dialog erklärt", () => {
    const ersatz = demoBereich("/gibt-es-nicht").titel;
    for (const s of KAUFWEG) {
      expect(existsSync(`app/(app)${s.href}/page.tsx`), s.href).toBe(true);
      expect(existsSync(`app/(app)${s.href}/loading.tsx`), `${s.href} loading`).toBe(true);
      // Der Makler-Ordner ist in der Demo bewusst gesperrt (keine Beispieldaten) — dann mit eigenem Dialog.
      expect(demoDarfRoute(s.href) || demoBereich(s.href).titel !== ersatz, s.href).toBe(true);
    }
    for (const h of ["/vergleich", "/sanierung", "/kauf", "/abschluss", "/strategie", "/aufbau"]) expect(demoDarfRoute(h), h).toBe(true);
  });

  it("jede Fahrplan-Station gehört zu genau einem Schritt — und der Fahrplan folgt derselben Reihenfolge", () => {
    const stationen = fahrplan(LEER).map((s) => s.id);
    const zugeordnet = KAUFWEG.flatMap((s) => s.stationen);
    expect([...zugeordnet].sort()).toEqual([...stationen].sort());
    expect(new Set(zugeordnet).size).toBe(zugeordnet.length);
    // In Reihenfolge der Schritte gelesen, ergibt sich genau die Reihenfolge des Fahrplans.
    expect(zugeordnet).toEqual(stationen);
  });

  it("weiter und zurück", () => {
    expect(naechsterSchritt("vergleichen")?.id).toBe("besichtigen");
    expect(naechsterSchritt("abschluss")).toBeNull();
    expect(vorigerSchritt("vergleichen")).toBeNull();
    expect(vorigerSchritt("finanzieren")?.id).toBe("besichtigen");
    expect(wegSchritt("unterlagen").nr).toBe(4);
  });

  it("Stand eines Schritts nur aus Daten: erledigt, angefangen, offen — oder gar keiner", () => {
    const leer = fahrplan(LEER);
    expect(schrittStand(wegSchritt("vergleichen"), leer)).toBe("offen");
    expect(schrittStand(wegSchritt("besichtigen"), leer)).toBeNull(); // BuyImmo weiß es nicht
    expect(schrittStand(wegSchritt("abschluss"), leer)).toBeNull();
    const halb = fahrplan({ ...LEER, hatSelbstauskunft: true });
    expect(schrittStand(wegSchritt("finanzieren"), halb)).toBe("teilweise");
    const voll = fahrplan({
      ...LEER,
      hatSelbstauskunft: true,
      kaufpruefungen: 3,
      makler: MAKLER_CHECKLISTE.map((i) => ({ item_key: i.key, status: "erledigt" })),
    });
    expect(schrittStand(wegSchritt("vergleichen"), voll)).toBe("erledigt");
    expect(schrittStand(wegSchritt("finanzieren"), voll)).toBe("erledigt");
    expect(schrittStand(wegSchritt("unterlagen"), voll)).toBe("erledigt");
  });

  it("reine Hinweise (Vertreter hinterlegt, Objekte im Bestand) machen einen Schritt nicht „offen“", () => {
    const mitInfo = fahrplan({ ...LEER, vertreterGueltig: true, objekte: 2 });
    expect(mitInfo.find((s) => s.id === "uebergabe")?.status?.art).toBe("info");
    expect(schrittStand(wegSchritt("abschluss"), mitInfo)).toBeNull();
  });

  it("kein Text rät oder urteilt über die Person", () => {
    const VERBOTEN = /empfehl|solltest|kannst dir .* leisten|du kannst kaufen|lohnt sich|jetzt kaufen/i;
    expect(VERBOTEN.test("Wir empfehlen dir")).toBe(true);
    const texte = KAUFWEG.flatMap((s) => [s.titel, s.satz, ...s.achten]);
    expect(texte.length).toBeGreaterThan(20);
    expect(texte.filter((t) => VERBOTEN.test(t))).toEqual([]);
  });
});

describe("Seitenleiste in BuyImmo", () => {
  beforeEach(() => {
    pfad = "/aufbau";
  });

  it("Cockpit und Strategie oben, dann der Weg mit Nummern, dann die Werkzeuge", () => {
    expect(UEBERBLICK.map((n) => n.href)).toEqual(["/aufbau", "/strategie"]);
    expect(UEBERBLICK[0].label).toBe("Cockpit");
    expect(WEG.map((n) => n.href)).toEqual(KAUFWEG.map((s) => s.href));
    expect(WEG.map((n) => n.schritt)).toEqual([1, 2, 3, 4, 5]);
    expect(WERKZEUGE.every((n) => n.schritt == null)).toBe(true);
    expect(BEREICHE.aufbau.gruppen.map((g) => g.titel)).toEqual(["Überblick", "Dein Weg zum Kauf", "Werkzeuge"]);
  });

  it("gerendert: Nummern statt Symbole, in der richtigen Reihenfolge", async () => {
    const { default: Sidebar } = await import("@/components/Sidebar");
    const html = renderToStaticMarkup(createElement(Sidebar, { userEmail: "test@example.org" }));
    const nummern = [...html.matchAll(/class="icon nav-schritt"[^>]*>(\d)</g)].map((m) => Number(m[1]));
    expect(nummern).toEqual([1, 2, 3, 4, 5]);
    // Reihenfolge der Ziele im HTML: Cockpit, Strategie, 1 … 5.
    const ziele = ["/aufbau", "/strategie", "/vergleich", "/sanierung", "/kauf", "/makler", "/abschluss", "/fahrplan"];
    const pos = ziele.map((h) => html.indexOf(`href="${h}"`));
    expect(pos.every((p) => p >= 0)).toBe(true);
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
  });
});

describe("Schritt-Kopf", () => {
  it("zeigt den Schritt, markiert ihn und führt zum nächsten", async () => {
    const { default: WegKopf } = await import("@/components/aufbau/WegKopf");
    const html = renderToStaticMarkup(createElement(WegKopf, { schritt: "besichtigen" }));
    expect(html).toContain("Schritt 2 von 5:");
    expect(html).toMatch(/aria-current="step"><b>2<\/b>/);
    expect(html).toContain('href="/kauf"');
    expect(html).toContain("Weiter: 3 · Finanzierung");
    expect(html).toContain("Worauf du in diesem Schritt achten musst");
    for (const a of wegSchritt("besichtigen").achten) expect(html).toContain(a.slice(0, 30));
  });

  it("letzter Schritt führt zurück ins Cockpit", async () => {
    const { default: WegKopf } = await import("@/components/aufbau/WegKopf");
    const html = renderToStaticMarkup(createElement(WegKopf, { schritt: "abschluss" }));
    expect(html).toContain("Zum Cockpit");
    expect(html).not.toContain("Weiter:");
  });

  it("steht auf jeder Schritt-Seite", () => {
    const seiten: Record<string, string> = {
      vergleichen: "app/(app)/vergleich/page.tsx",
      besichtigen: "app/(app)/sanierung/page.tsx",
      finanzieren: "app/(app)/kauf/page.tsx",
      unterlagen: "app/(app)/makler/page.tsx",
      abschluss: "app/(app)/abschluss/page.tsx",
    };
    for (const [id, datei] of Object.entries(seiten)) expect(readFileSync(datei, "utf8"), datei).toContain(`<WegKopf schritt="${id}" />`);
  });
});
