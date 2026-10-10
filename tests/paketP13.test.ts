import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, sep } from "node:path";
import { SPERRLISTE, gesperrt } from "../scripts/crawlSperrliste.mjs";
import { streamingMarker } from "../scripts/streamingMarker.mjs";

// Paket P13 der Gesamtprüfung (07.10.2026): Werkzeug — Sperrliste für Crawler, Streaming-Marker,
// Design-Scan ohne halbe Bildschirme, und jede Seite hat einen Einstieg.

const lies = (p: string) => readFileSync(p, "utf8");
const dateien = (d: string): string[] =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = join(d, e.name);
    return e.isDirectory() ? dateien(p) : [p];
  });
/** Adresse einer page.tsx/route.ts: Routengruppen weg, `[x]` bleibt stehen. */
const adresse = (f: string) =>
  "/" + dirname(f).split(sep).slice(1).filter((s) => !/^\(.*\)$/.test(s)).join("/");
/** Beispieladresse: dynamische Segmente durch einen Platzhalter ersetzt. */
const beispiel = (a: string) => a.replace(/\[[^\]]+\]/g, "x");

const ROUTEN = dateien("app").filter((f) => f.endsWith(`${sep}route.ts`));
const SEITEN = dateien("app").filter((f) => f.endsWith(`${sep}page.tsx`));
const GET_ROUTEN = ROUTEN.filter((f) => /export\s+(?:async\s+)?function\s+GET\b|export\s+const\s+GET\b/.test(lies(f)));

// Jede GET-Route, die ein Crawler aufrufen DARF, steht hier mit Grund. Eine neue GET-Route gehört
// entweder hierher oder in scripts/crawlSperrliste.mjs — der Test unten verlangt das eine oder das andere.
const NUR_LESEND: Record<string, string> = {
  "/einstellungen/vertreter/[id]": "liefert den Vollmacht-Scan des eigenen Kontos",
  "/kosten/[id]/rechnung": "signierter Link auf den eigenen Beleg",
  "/makler/datei/[key]": "eigene Makler-Unterlage",
  "/properties/[id]/beleihung/datei/[key]": "eigene Beleihungs-Unterlage",
  "/properties/[id]/beleihung/deckblatt": "erzeugt ein PDF, speichert nichts",
  "/properties/[id]/nebenkosten/pdf": "erzeugt ein PDF, speichert nichts",
  "/tenants/[id]/nk/pdf": "erzeugt ein PDF, speichert nichts",
  "/termine/ical": "Kalenderdatei",
  "/api/anliegen-datei/[id]": "Foto eines Anliegens",
  "/api/auftrag-foto/[id]": "Foto am Auftrag",
  "/api/berichte/anlage-v": "PDF",
  "/api/berichte/jahresbericht": "PDF",
  "/api/export/alles": "Vollexport (verlangt frische Anmeldung, schreibt nichts)",
  "/api/export/buchungen": "CSV",
  "/api/export/datev": "CSV",
  "/api/freigabe-eingang/[id]": "eingegangene Datei ansehen (Übernehmen ist ein eigener Schritt)",
  "/api/zaehler-foto/[id]": "Foto einer Zählermeldung",
};

/** Merkmale eines Schreibvorgangs direkt in der Route — dann darf sie nicht „nur lesend“ heißen. */
const SCHREIBT = /\.(?:insert|update|upsert|delete)\(|\.rpc\(|signOut\(|cookies\.set\(|cookieStore\.set\(|verifyOtp\(|exchangeCodeForSession\(/;

describe("Sperrliste für Crawler (Fundament 11)", () => {
  it("sperrt, was beim bloßen Aufruf etwas verändert", () => {
    for (const p of [
      "/api/demo",
      "/api/demo?rolle=mieter",
      "https://www.myimmoapp.de/api/demo",
      "/api/cron/wert-refresh",
      "/api/encrypt-bankdaten",
      "/api/newsletter/bestaetigen?t=x",
      "/auth/passwort?token_hash=x&type=recovery",
      "/auth/callback?code=x",
      "/archiv/abc/datei",
      "/beleihung/tok/datei/grundbuch",
      "/makler-link/tok/datei/ausweis",
      "/api/nk-ocr",
    ])
      expect(gesperrt(p), p).toBe(true);
  });
  it("lässt lesende Seiten durch — auch die mit ähnlichem Anfang", () => {
    for (const p of ["/", "/properties", "/archiv", "/beleihung/tok", "/makler-link/tok", "/api/demonstration", "/authentisch", "/kauf-hilfe", "/termine/ical"])
      expect(gesperrt(p), p).toBe(false);
  });
  it("jede GET-Route ist eingeordnet: gesperrt ODER nur lesend — nie beides, nie keins", () => {
    expect(GET_ROUTEN.length).toBeGreaterThanOrEqual(25); // belegt, dass gesucht wurde
    const offen: string[] = [];
    for (const f of GET_ROUTEN) {
      const a = adresse(f);
      const zu = gesperrt(beispiel(a));
      const frei = a in NUR_LESEND;
      if (zu === frei) offen.push(`${a} (${zu ? "gesperrt UND nur lesend" : "nicht eingeordnet"})`);
    }
    expect(offen).toEqual([]);
  });
  it("eine Route, die selbst schreibt, darf nicht „nur lesend“ heißen", () => {
    const falsch = GET_ROUTEN.filter((f) => adresse(f) in NUR_LESEND && SCHREIBT.test(lies(f))).map(adresse);
    expect(falsch).toEqual([]);
    // Gegenprobe: Der Erkenner erkennt die bekannten Schreiber.
    for (const a of ["/api/demo", "/archiv/[id]/datei", "/auth/passwort"]) {
      const f = GET_ROUTEN.find((x) => adresse(x) === a);
      expect(f && SCHREIBT.test(lies(f)), a).toBe(true);
    }
  });
  it("keine tote Sperre: jeder Eintrag trifft eine vorhandene Adresse", () => {
    const alle = [...ROUTEN, ...SEITEN].map((f) => beispiel(adresse(f)));
    const tot = (SPERRLISTE as { muster: RegExp }[]).filter((s) => !alle.some((a) => s.muster.test(a))).map((s) => String(s.muster));
    expect(tot).toEqual([]);
  });
  it("Crawler und Design-Scan halten sich daran — Start, Links und Weiterleitungen", () => {
    const c = lies("scripts/crawl.mjs");
    expect(c).toContain('from "./crawlSperrliste.mjs"');
    expect(c).toMatch(/starts\.filter\(\(s\) => gesperrt\(s\)\)/);
    expect(c).toMatch(/if \(gesperrt\(h\)\)/);
    expect(c).toMatch(/if \(gesperrt\(u\.pathname \+ u\.search\)\)/);
    const d = lies("scripts/designscan/pruefe.mjs");
    expect(d).toMatch(/pfade\.filter\(\(x\) => gesperrt\(x\)\)/);
  });
});

// Wörtlich aus echten Live-Antworten (Audit I1, 07.10.2026, `.scan/audit/i1/bodies/`) — nicht formuliert.
const ECHT_404 = `<script nonce="x">self.__next_f.push([1,"15:E{\\"digest\\":\\"NEXT_HTTP_ERROR_FALLBACK;404\\"}\\n"])</script><meta name="robots" content="noindex"/>`;
const ECHT_REDIRECT_TEMPLATE = `<div hidden id="S:0"><!--$--><!--$--><!--$!--><template data-dgst="NEXT_REDIRECT;replace;/properties/d560ceb5-9dc2-4869-a0c8-41833c061a2c/nebenkosten;307;"></template><div>`;
const ECHT_REDIRECT_FLIGHT = `d\\",\\"unauthorized\\":\\"$undefined\\"}]]}]\\n17:E{\\"digest\\":\\"NEXT_REDIRECT;replace;/properties/d560ceb5-9dc2-4869-a0c8-41833c061a2c/nebenkosten;307;\\"}\\n1c:[[\\"$\\",`;

describe("Streaming-Marker (C52)", () => {
  it("notFound() kommt als HTTP 200 — der Marker macht daraus 404", () => {
    expect(streamingMarker(ECHT_404)).toEqual({ status: 404, weiter: null });
  });
  it("redirect() kommt als HTTP 200 — der Marker nennt das Ziel (Vorlage und Flight-Daten)", () => {
    const ziel = "/properties/d560ceb5-9dc2-4869-a0c8-41833c061a2c/nebenkosten";
    expect(streamingMarker(ECHT_REDIRECT_TEMPLATE)).toEqual({ status: null, weiter: ziel });
    expect(streamingMarker(ECHT_REDIRECT_FLIGHT)).toEqual({ status: null, weiter: ziel });
  });
  it("eine gewöhnliche Seite hat keinen Marker; &amp; im Ziel wird gelesen", () => {
    expect(streamingMarker('<html><body><h1>Objekte</h1><a href="/properties">x</a></body></html>')).toEqual({ status: null, weiter: null });
    expect(streamingMarker("")).toEqual({ status: null, weiter: null });
    expect(streamingMarker('data-dgst="NEXT_REDIRECT;push;/login?next=/a&amp;b=1;307;"').weiter).toBe("/login?next=/a&b=1");
  });
  it("der Rauchtest wertet ihn aus und prüft eine fremde ID auf „nicht gefunden“", () => {
    const r = lies("scripts/rauchtest.mjs");
    expect(r).toContain('import { streamingMarker } from "./streamingMarker.mjs"');
    expect(r).toMatch(/const marker = streamingMarker\(html\);[\s\S]{0,200}if \(marker\.weiter\)[\s\S]{0,200}return hole\(/);
    expect(r).toMatch(/if \(marker\.status\)[\s\S]{0,200}status: marker\.status/);
    expect(r).toMatch(/schluessel: "nicht-gefunden"[\s\S]{0,400}erwartetStatus: 404/);
    expect(r).toMatch(/if \(weg\.erwartetStatus\) \{\s*if \(seite\.status !== weg\.erwartetStatus\)/);
    expect(lies("scripts/crawl.mjs")).toMatch(/streamingMarker\(html\)/);
  });
});

describe("Design-Scan ohne halbe Bildschirme", () => {
  it("scrollt sofort — die App setzt `scroll-behavior: smooth`", () => {
    const d = lies("scripts/designscan/pruefe.mjs");
    expect(d).toContain('behavior: "instant"');
    expect(d).not.toMatch(/window\.scrollTo\(0,/);
    expect(lies("app/globals.css")).toMatch(/html \{ scroll-behavior: smooth; \}/); // der Grund, falls er je wegfällt
  });
});

describe("Inventar: jede Seite hat einen Einstieg", () => {
  // Nur ALTE Adressen, die auf ihren Nachfolger umleiten. Neue Ausnahmen braucht es nicht: Eine Seite,
  // die nirgends verlinkt ist, findet niemand (so war /verbrauch/[id]/edit monatelang tot, C49).
  const AUSNAHMEN: Record<string, string> = {
    "/properties/[id]/umlage": "alte Adresse des Verteilers, leitet auf /nebenkosten um",
    "/verbrauch/[id]/edit": "alte Bearbeiten-Seite, leitet auf /verbrauch um (Bearbeiten im Dialog)",
  };
  // Listen, die Adressen nur VERWALTEN (Demo-Freigabe, öffentliche Seiten, Proxy, Sitemap), sind kein Einstieg.
  const KEIN_EINSTIEG = new Set(["lib/demo.ts", "lib/oeffentlich.ts", "proxy.ts", "app/sitemap.ts"]);
  const quellen = [...dateien("app"), ...dateien("components"), ...dateien("lib"), "proxy.ts"].filter(
    (f) => /\.(?:tsx?|mjs)$/.test(f) && !KEIN_EINSTIEG.has(f),
  );
  const texte = new Map(quellen.map((f) => [f, lies(f)]));
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  /** `/tenants/[id]/nk` findet `/tenants/${m.id}/nk`, `"/tenants/" + id + "/nk"` nicht — Adressen bitte als Vorlage schreiben. */
  const muster = (a: string) =>
    new RegExp(
      a
        .split("/")
        .filter(Boolean)
        .map((seg) => "/" + (/^\[.*\]$/.test(seg) ? "(?:\\$\\{[^}]+\\}|[^/\"'`\\s?#]+)" : esc(seg)))
        .join("") + "(?=[\"'`?#/]|\\$\\{|$)",
    );
  const einstiege = (f: string) => {
    const m = muster(adresse(f));
    return [...texte].filter(([d, t]) => d !== f && m.test(t)).map(([d]) => d);
  };

  it("keine verwaiste Seite", () => {
    expect(SEITEN.length).toBeGreaterThanOrEqual(70);
    const ohne = SEITEN.filter((f) => adresse(f) !== "/" && !(adresse(f) in AUSNAHMEN) && einstiege(f).length === 0).map(adresse);
    expect(ohne).toEqual([]);
  });
  it("der Erkenner sieht Vorlagen-Adressen (Gegenprobe)", () => {
    const nk = SEITEN.find((f) => adresse(f) === "/tenants/[id]/nk")!;
    expect(einstiege(nk).length).toBeGreaterThan(0);
    const kosten = SEITEN.find((f) => adresse(f) === "/kosten/[id]/edit")!;
    expect(einstiege(kosten)).toContain(join("app", "(app)", "page.tsx"));
  });
  it("Ausnahmen sind echte Weiterleitungen und noch nötig", () => {
    for (const a of Object.keys(AUSNAHMEN)) {
      const f = SEITEN.find((x) => adresse(x) === a);
      expect(f, a).toBeTruthy();
      expect(lies(f!), a).toMatch(/\bredirect\(/);
      expect(einstiege(f!), `${a} hat inzwischen einen Einstieg — Ausnahme entfernen`).toEqual([]);
    }
  });
});
