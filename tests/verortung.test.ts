// Verortung (01.10.2026): nur 7 von 23 echten Objekten standen auf der Karte.
// Gemessen: Nominatim antwortet unter Last mit 429, die App hielt das für
// „nicht gefunden" und schickte dieselbe Anfrage bei jedem Aufruf erneut — laut
// Nutzungsregeln ein Sperrgrund. Ein Zusatz wie „(EG)" ließ die Suche leer
// laufen (live gegen Nominatim mit einer öffentlichen Adresse belegt).
import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  bereinigeAdresse, zerlegeAdresse, geocodeAdresse, sollVerorten, geoAenderung, koordinaten,
  GEO_ZURUECKSETZEN, GEDROSSELT_PAUSE_MS, GEOCODE_PAUSE_MS,
} from "@/lib/geocode";

const lies = (p: string) => readFileSync(p, "utf8");

function antwort(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("bereinigeAdresse", () => {
  it("entfernt Klammern und Lagezusätze, lässt Straße/PLZ/Ort stehen", () => {
    expect(bereinigeAdresse("Marienplatz 8, 80331 München (EG)")).toBe("Marienplatz 8, 80331 München");
    expect(bereinigeAdresse("Hauptstr. 5, Whg. 3, 23611 Bad Schwartau")).toBe("Hauptstr. 5, 23611 Bad Schwartau");
    expect(bereinigeAdresse("Ringstraße 2, 2. OG links, 10115 Berlin")).toBe("Ringstraße 2, 10115 Berlin");
    expect(bereinigeAdresse("  Am  Markt 1 ,\n 12345  Ort ")).toBe("Am Markt 1, 12345 Ort");
  });
  it("hält Ortsnamen, die nur so ANFANGEN wie ein Zusatz", () => {
    // Stockelsdorf liegt neben Bad Schwartau — „stock" ist ein Zusatz, „Stockelsdorf" nicht.
    for (const a of ["Dorfstr. 1, Stockelsdorf", "Lindenweg 2, Egelsbach", "Mittelweg 3, 20148 Hamburg", "Linkstraße 5, 10785 Berlin"]) {
      expect(bereinigeAdresse(a)).toBe(a);
    }
  });
});

describe("zerlegeAdresse", () => {
  it("trennt Straße, PLZ und Ort — auch mit Zusätzen und ohne Komma", () => {
    expect(zerlegeAdresse("Friedrichstr. 43, 10117 Berlin")).toEqual({ strasse: "Friedrichstr. 43", plz: "10117", ort: "Berlin" });
    expect(zerlegeAdresse("Marienplatz 8 80331 München (EG)")).toEqual({ strasse: "Marienplatz 8", plz: "80331", ort: "München" });
    expect(zerlegeAdresse("Musterweg 1")).toBeNull();
  });
});

describe("geocodeAdresse", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("429 ist „gedrosselt“, nicht „nicht gefunden“ — und es folgt KEINE zweite Anfrage", async () => {
    const f = vi.fn(async () => antwort(429, null));
    vi.stubGlobal("fetch", f);
    expect(await geocodeAdresse("Unter den Linden 77, 10117 Berlin", async () => {})).toEqual({ art: "gedrosselt" });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("Netzfehler und 5xx sind ebenfalls „gedrosselt“", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("weg"); }));
    expect(await geocodeAdresse("Unter den Linden 77, 10117 Berlin", async () => {})).toEqual({ art: "gedrosselt" });
    vi.stubGlobal("fetch", vi.fn(async () => antwort(503, null)));
    expect(await geocodeAdresse("Unter den Linden 77, 10117 Berlin", async () => {})).toEqual({ art: "gedrosselt" });
  });
  it("Freitext leer → strukturierte Suche, mit der Pflichtpause dazwischen; bereinigte Adresse geht hinaus", async () => {
    const urls: string[] = [];
    const f = vi.fn(async (u: string) => {
      urls.push(u);
      return urls.length === 1 ? antwort(200, []) : antwort(200, [{ lat: "48.137", lon: "11.575" }]);
    });
    vi.stubGlobal("fetch", f);
    const pausen: number[] = [];
    const erg = await geocodeAdresse("Marienplatz 8, Whg. 2, 80331 München (EG)", async (ms) => { pausen.push(ms); });
    expect(erg).toEqual({ art: "treffer", lat: 48.137, lng: 11.575 });
    expect(pausen).toEqual([GEOCODE_PAUSE_MS]);
    const q1 = new URL(urls[0]).searchParams;
    expect(q1.get("q")).toBe("Marienplatz 8, 80331 München");
    const q2 = new URL(urls[1]).searchParams;
    expect([q2.get("street"), q2.get("postalcode"), q2.get("city")]).toEqual(["Marienplatz 8", "80331", "München"]);
  });
  it("beide leer → „leer“; ein eigener User-Agent geht immer mit", async () => {
    const f = vi.fn(async (_u: string, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)["User-Agent"]).toMatch(/^MyImmo\/1\.0 \(https:\/\/www\.myimmoapp\.de\)$/);
      return antwort(200, []);
    });
    vi.stubGlobal("fetch", f);
    expect(await geocodeAdresse("Gibtsnichtweg 1, 99999 Nirgendwo", async () => {})).toEqual({ art: "leer" });
    expect(f).toHaveBeenCalledTimes(2);
  });
});

describe("sollVerorten — wann darf überhaupt gefragt werden", () => {
  const jetzt = Date.parse("2026-10-01T12:00:00Z");
  const basis = { adresse: "Unter den Linden 77, 10117 Berlin", lat: null, lng: null };
  it("offene Adresse: ja", () => expect(sollVerorten(basis, jetzt)).toBe(true));
  it("schon verortet (auch nur Altspalten): nein", () => {
    expect(sollVerorten({ ...basis, lat: 52.5, lng: 13.4 }, jetzt)).toBe(false);
    expect(sollVerorten({ ...basis, latitude: 52.5, longitude: 13.4 }, jetzt)).toBe(false);
  });
  it("keine Adresse: nein", () => expect(sollVerorten({ ...basis, adresse: "  " }, jetzt)).toBe(false));
  it("„nicht gefunden“: nie wieder dieselbe Anfrage (erst nach Adressänderung)", () => {
    expect(sollVerorten({ ...basis, geo_status: "nicht_gefunden", geo_versucht_am: "2020-01-01T00:00:00Z" }, jetzt)).toBe(false);
  });
  it("„gedrosselt“: erst nach der Pause", () => {
    const vor = (ms: number) => new Date(jetzt - ms).toISOString();
    expect(sollVerorten({ ...basis, geo_status: "gedrosselt", geo_versucht_am: vor(GEDROSSELT_PAUSE_MS - 60_000) }, jetzt)).toBe(false);
    expect(sollVerorten({ ...basis, geo_status: "gedrosselt", geo_versucht_am: vor(GEDROSSELT_PAUSE_MS + 60_000) }, jetzt)).toBe(true);
  });
  it("Koordinaten: lat/lng zuerst, latitude/longitude als Altbestand", () => {
    expect(koordinaten({ adresse: null, lat: 1, lng: 2, latitude: 9, longitude: 9 })).toEqual({ lat: 1, lng: 2 });
    expect(koordinaten({ adresse: null, lat: null, lng: null, latitude: 9, longitude: 8 })).toEqual({ lat: 9, lng: 8 });
  });
});

describe("geoAenderung und Zurücksetzen", () => {
  it("jedes Ergebnis wird gemerkt — auch „nicht gefunden“ und „gedrosselt“", () => {
    const t = "2026-10-01T12:00:00.000Z";
    expect(geoAenderung({ art: "treffer", lat: 1, lng: 2 }, t)).toEqual({ lat: 1, lng: 2, latitude: 1, longitude: 2, geo_status: "ok", geo_versucht_am: t });
    expect(geoAenderung({ art: "leer" }, t)).toEqual({ geo_status: "nicht_gefunden", geo_versucht_am: t });
    expect(geoAenderung({ art: "gedrosselt" }, t)).toEqual({ geo_status: "gedrosselt", geo_versucht_am: t });
  });
  it("Adressänderung beim Speichern vergisst Koordinaten UND Status", () => {
    expect(GEO_ZURUECKSETZEN).toEqual({ lat: null, lng: null, latitude: null, longitude: null, geo_status: null, geo_versucht_am: null });
    expect(lies("lib/actions/properties.ts")).toContain("!== parsed.adresse ? GEO_ZURUECKSETZEN : {};");
  });
});

describe("Einbindung", () => {
  it("Bewertung und Cron laufen über dieselbe Verortung; der Cron nur, wenn BORIS an ist", () => {
    const b = lies("lib/actions/bewertung.ts");
    expect(b).toContain('from "@/lib/geocode"');
    expect(b).toContain("sollVerorten(prop, Date.now())");
    expect(b).toContain("...geoSpalten,");
    const c = lies("app/api/cron/wert-refresh/route.ts");
    expect(c).toContain("if (borisAktiv && geoBudget > 0 && sollVerorten(p, Date.now())) {");
    expect(c).toContain(".update(geoAenderung(erg, new Date().toISOString()))");
  });
  it("Datenschutzerklärung nennt Nominatim und Jina AI (Audit B9), CARTO nicht mehr", () => {
    const d = lies("app/(pub)/datenschutz/page.tsx");
    for (const t of ["OpenStreetMap Foundation", "Jina AI GmbH", "27. Dezember 2031"]) {
      expect(d, t).toContain(t);
    }
    // Die Karte ist entfernt — dann darf CARTO auch nicht mehr als Empfänger dastehen.
    expect(d).not.toContain("CARTO");
  });
});
