import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  BEREICHE,
  BEREICH_REIHENFOLGE,
  GEMEINSAME_PFADE,
  bereichFuer,
  eigenerBereich,
  pfadGehoertZu,
} from "@/lib/bereich";
import { AUFBAUEN, RECHNEN } from "@/lib/nav";
import { demoDarfRoute } from "@/lib/demo";

// MyImmo ↔ BuyImmo (05.10.2026): Welcher Bereich offen ist, folgt allein aus der Adresse;
// gemeinsame Seiten behalten den letzten. Hier gegen die reinen Funktionen UND gegen die
// gerenderte Seitenleiste — ein Test, der nur nachsieht, OB `bereichFuer` im Quelltext
// steht, schützt kein Verhalten.

describe("Bereich folgt der Adresse", () => {
  it("jedes Navigationsziel gehört dem Bereich, in dessen Gruppen es steht — auch mit Unterseite", () => {
    let geprueft = 0;
    for (const b of BEREICH_REIHENFOLGE) {
      for (const g of BEREICHE[b].gruppen) {
        for (const z of g.ziele) {
          if (GEMEINSAME_PFADE.some((h) => pfadGehoertZu(z.href, h))) continue;
          expect(eigenerBereich(z.href), z.href).toBe(b);
          if (z.href !== "/") expect(eigenerBereich(`${z.href}/unterseite`), z.href).toBe(b);
          geprueft++;
        }
      }
    }
    // Der Wächter muss belegen, dass er gesucht hat.
    expect(geprueft).toBeGreaterThan(12);
  });

  it("die Startseite jedes Bereichs gehört zu ihm und steht in seiner Navigation", () => {
    for (const b of BEREICH_REIHENFOLGE) {
      const { start, gruppen } = BEREICHE[b];
      expect(eigenerBereich(start)).toBe(b);
      expect(gruppen.flatMap((g) => g.ziele.map((z) => z.href))).toContain(start);
    }
  });

  it("Präfix-Falle: /kaufen gehört nicht zu /kauf, und / trifft nur sich selbst", () => {
    expect(pfadGehoertZu("/kaufen", "/kauf")).toBe(false);
    expect(pfadGehoertZu("/kauf/schritt", "/kauf")).toBe(true);
    expect(eigenerBereich("/kaufen")).toBe("verwaltung");
    expect(pfadGehoertZu("/tenants", "/")).toBe(false);
    expect(eigenerBereich("/")).toBe("verwaltung");
  });

  it("gemeinsame Seiten behalten den letzten Bereich, alle anderen bestimmen ihn selbst", () => {
    for (const p of ["/einstellungen", "/hilfe", "/properties", "/properties/abc-123"]) {
      expect(bereichFuer(p, "aufbau"), p).toBe("aufbau");
      expect(bereichFuer(p, "verwaltung"), p).toBe("verwaltung");
    }
    expect(bereichFuer("/kauf", "verwaltung")).toBe("aufbau");
    expect(bereichFuer("/mietkonto", "aufbau")).toBe("verwaltung");
    // Seiten außerhalb der Navigation (z. B. /termine) sind Verwaltung, nicht „gemeinsam“.
    expect(bereichFuer("/termine", "aufbau")).toBe("verwaltung");
  });

  it("die früheren „Planen“-Adressen sind unverändert und liegen jetzt in BuyImmo", () => {
    const aufbau = [...AUFBAUEN, ...RECHNEN].map((n) => n.href);
    for (const p of ["/kauf", "/verkauf", "/bewertung", "/afa-assistent"]) {
      expect(aufbau, p).toContain(p);
      expect(eigenerBereich(p), p).toBe("aufbau");
    }
  });

  it("die Kommandozentrale ist in der Demo frei", () => {
    expect(demoDarfRoute("/aufbau")).toBe(true);
  });
});

// ── Gerenderte Seitenleiste ─────────────────────────────────────────────────
// Nur das Nötigste ersetzt: die Adresse (usePathname) und next/link als schlichtes <a>.
let pfad = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => pfad,
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {}, refresh: () => {} }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _p, ...rest }: { href: string; children?: ReactNode; prefetch?: boolean }) =>
    createElement("a", { href, ...rest }, children),
}));

/** Nur der Umschalter-Knopf — „Buy“ steht auch in der Handy-Kopfleiste, die zählt hier nicht. */
function knopf(html: string): string {
  const m = html.match(/<button[^>]*class="bereich-knopf"[\s\S]*?<\/button>/);
  if (!m) throw new Error("Umschalter-Knopf nicht gefunden");
  return m[0];
}

async function seitenleiste(adresse: string): Promise<string> {
  pfad = adresse;
  const { default: Sidebar } = await import("@/components/Sidebar");
  return renderToStaticMarkup(createElement(Sidebar, { userEmail: "test@example.org" }));
}

describe("Seitenleiste zeigt den Bereich der Adresse", () => {
  beforeEach(() => {
    pfad = "/";
  });

  it("/kauf → BuyImmo: Wortmarke Buy, Kaufpunkte da, Verwaltungspunkte weg", async () => {
    const html = await seitenleiste("/kauf");
    expect(knopf(html)).toContain("Buy<span>Immo</span>");
    expect(html).toContain('class="mobile-logo">Buy<span>Immo</span>');
    expect(html).toContain('href="/aufbau"');
    expect(html).toContain('href="/makler"');
    expect(html).not.toContain('href="/mietkonto"');
    expect(html).not.toContain('href="/tenants"');
    expect(html).toContain("Bestandsaufbau");
  });

  it("/ → MyImmo: Verwaltungspunkte da, Kaufpunkte weg", async () => {
    const html = await seitenleiste("/");
    expect(knopf(html)).toContain("My<span>Immo</span>");
    expect(html).toContain('href="/mietkonto"');
    expect(html).not.toContain('href="/kauf"');
    expect(html).not.toContain("Buy<span>Immo</span>");
  });

  it("erster Aufruf einer gemeinsamen Seite → MyImmo (es gibt noch keinen letzten Bereich)", async () => {
    const html = await seitenleiste("/einstellungen");
    expect(html).toContain('href="/mietkonto"');
    expect(html).not.toContain('href="/aufbau"');
  });

  it("der Umschalter ist ein Knopf mit Hinweis, kein stummer Link aufs Dashboard", async () => {
    const html = await seitenleiste("/");
    expect(html).toMatch(/<button[^>]*class="bereich-knopf"[^>]*aria-expanded="false"/);
    expect(html).toContain("Bereich wechseln");
  });
});
