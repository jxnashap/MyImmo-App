import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { aufteilen, istKopf } from "@/components/ExpandableList";
import { abweichungZurSchaetzung } from "@/components/IndexwertKarte";
import { linkerRand, kurzTick, ACHSENTITEL_BAND, ZEICHEN_PX } from "@/lib/zeitraum";
import { VERWALTEN } from "@/lib/nav";
import { ladeNkPositionen } from "@/lib/nkPositionen";
import { fakeSupabase } from "./stubs/actionHarness";

// Paket P12 der Gesamtprüfung (07.10.2026): Darstellung und Bedienung.
// Wo es geht, prüft der Test VERHALTEN (Zählung, Kontrast, Quelle der NK-Positionen);
// CSS und JSX-Attribute lassen sich ohne Browser nur am Quelltext festhalten.

const lies = (p: string) => readFileSync(p, "utf8");
const css = lies("app/globals.css");

/** Inhalt eines @media-Blocks, der mit `kopf` beginnt (Klammern gezählt). */
function mediaBlock(kopf: string, ab = 0): string {
  const i = css.indexOf(kopf, ab);
  if (i < 0) return "";
  let tiefe = 0;
  for (let j = css.indexOf("{", i); j < css.length; j++) {
    if (css[j] === "{") tiefe++;
    else if (css[j] === "}" && --tiefe === 0) return css.slice(i, j + 1);
  }
  return "";
}

// ---------- WCAG-Kontrast (2.x, relative Luminanz) ----------
const kanal = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const lum = ([r, g, b]: number[]) => 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
const kontrast = (a: number[], b: number[]) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
/** Farbe mit Deckkraft über einen Grund gemischt (wie die getönte Badge-Fläche über Weiß). */
const mische = (vorne: number[], alpha: number, grund: number[]) => vorne.map((v, i) => Math.round(v * alpha + grund[i] * (1 - alpha)));
const WEISS = [255, 255, 255];
/** Wert eines Tokens innerhalb eines Blocks, der mit `selektor {` beginnt. */
function token(selektor: string, name: string): string {
  const i = css.indexOf(selektor);
  const ende = css.indexOf("}", i);
  const m = css.slice(i, ende).match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`${name} in ${selektor} nicht gefunden`);
  return m[1];
}

describe("B57/B34/B59 — Navigation am Handy", () => {
  it("Einstellungs-Reiter kleben unter der Kopfleiste, nicht dahinter (B57)", () => {
    expect(css).toMatch(/--mobile-bar-h:\s*58px/);
    expect(css).toMatch(/\.settings-tabs\s*\{\s*top:\s*var\(--mobile-bar-h\)/);
  });
  it("App-Menü: Hintergrund inert, Escape schließt, Fokus zurück, eigener Schließen-Knopf (B34)", () => {
    const s = lies("components/Sidebar.tsx");
    expect(s).toMatch(/setAttribute\("inert"/);
    expect(s).toContain(".main-wrap");
    expect(s).toMatch(/key === "Escape"/);
    expect(s).toMatch(/hamburger\.current\?\.focus\(\)/);
    expect(s).toContain('className="sidebar-zu"');
    expect(s).toContain('aria-label="Menü schließen"');
  });
  it("Startseiten-Menü ist ein modaler Dialog: Hintergrund inert, Fokus im Menü und zurück (B59)", () => {
    const q = lies("components/landing/QlxHeader.tsx");
    expect(q).toMatch(/setAttribute\("inert"/);
    expect(q).toContain('role="dialog"');
    expect(q).toContain('aria-modal="true"');
    expect(q).toMatch(/burger\.current\?\.focus\(\)/);
  });
  it("Termine stehen im Menü und in der Befehlspalette (C47)", () => {
    expect(VERWALTEN.some((n) => n.href === "/termine")).toBe(true);
    expect(lies("components/ui/CommandPalette.tsx")).toMatch(/"\/termine":\s*"kalender/);
  });
});

describe("Zoomen mit zwei Fingern bleibt möglich (WCAG 1.4.4)", () => {
  const dateien = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? dateien(p) : /\.(tsx|ts)$/.test(f) ? [p] : [];
    });
  it("kein `touch-action: pan-y` ohne `pinch-zoom` — weder im JSX noch im CSS", () => {
    const funde: string[] = [];
    for (const f of [...dateien("components"), ...dateien("app")]) {
      for (const m of lies(f).matchAll(/touchAction:\s*"([^"]*)"/g)) if (/pan-[xy]/.test(m[1]) && !m[1].includes("pinch-zoom")) funde.push(`${f}: ${m[1]}`);
    }
    for (const m of css.matchAll(/touch-action:\s*([^;}]+)/g)) if (/pan-[xy]/.test(m[1]) && !m[1].includes("pinch-zoom")) funde.push(`globals.css: ${m[1]}`);
    expect(funde).toEqual([]);
    expect(lies("components/WischReiter.tsx")).toContain('touchAction: "pan-y pinch-zoom"');
  });
  it("die Wisch-Geste gibt bei zwei Fingern ab (sonst schöbe der Zoom die Seite seitwärts)", () => {
    expect(lies("components/WischReiter.tsx")).toMatch(/touches\.length !== 1[\s\S]{0,400}gleiten\(null, 0\)/);
  });
  it("kein Layout sperrt das Zoomen über den Viewport", () => {
    for (const f of ["app/(app)/layout.tsx", "app/(pub)/layout.tsx"]) {
      const s = lies(f);
      expect(s, f).not.toMatch(/maximumScale|userScalable|user-scalable/);
    }
  });
});

describe("C48–C51 — Wege und Reste", () => {
  it("Mieter- und Service-Konto haben einen Hilfe-Weg (C48)", () => {
    expect(lies("app/(app)/konto/page.tsx")).toContain("HILFE_MAILTO");
    for (const f of ["components/PortalAnsicht.tsx", "components/ServicePortalAnsicht.tsx"]) expect(lies(f), f).toMatch(/className="portal-hilfe"[\s\S]{0,120}HILFE_MAILTO/);
  });
  it("die tote Verbrauch-Bearbeiten-Seite leitet auf die Liste (C49)", () => {
    expect(lies("app/(app)/verbrauch/[id]/edit/page.tsx")).toMatch(/redirect\("\/verbrauch"\)/);
  });
  it("die unbenutzten Notiz-Actions sind entfernt (C50)", () => {
    const b = lies("lib/actions/buchungen.ts");
    for (const n of ["createNotiz", "updateNotiz", "deleteNotizDatei"]) expect(b, n).not.toMatch(new RegExp(`export async function ${n}\\b`));
    expect(b).toMatch(/export async function deleteNotiz\b/);
  });

  // C51: Kosten am Objekt zählen nur im Mehrfamilienhaus — sonst wechselte die Abrechnung einer ETW
  // still die Quelle, wenn jemand die Objekt-NK-Seite per Adresse aufrief und dort etwas eintrug.
  const nkDb = () =>
    fakeSupabase({
      antworten: {
        mieter_positionen: [{ id: "p1", bezeichnung: "Grundsteuer", gesamt: 300, jahr: 2025 }],
        nk_objekt_kosten: [{ id: "k1", bezeichnung: "Müll", betrag: 600, schluessel: "flaeche", umlagefaehig: true, werte: {}, sort: 0 }],
        nk_objekt_jahr: { flaeche_gesamt: 100, einheiten: 2, mea_gesamt: null, mieter: {} },
        mieter: [{ id: "m1", vorname: "A", nachname: "B", einheit: "1", flaeche: 50, mietbeginn: "2020-01-01", mietende: null }],
      },
    }).client;
  it("ETW: Positionen bleiben beim Mieter, auch wenn am Objekt Kosten stehen (C51)", async () => {
    const r = await ladeNkPositionen(nkDb() as never, { id: "m1", prop_id: "o1" }, 2025, { flaeche: 50, einheiten_anzahl: 1, typ: "Eigentumswohnung" });
    expect(r.quelle).toBe("mieter");
    expect(r.positionen.map((p) => p.bezeichnung)).toEqual(["Grundsteuer"]);
  });
  it("Mehrfamilienhaus: die Kosten am Objekt gelten (Gegenprobe)", async () => {
    const r = await ladeNkPositionen(nkDb() as never, { id: "m1", prop_id: "o1" }, 2025, { flaeche: 100, einheiten_anzahl: 2, typ: "Mehrfamilienhaus" });
    expect(r.quelle).toBe("objekt");
  });
  it("die Objekt-NK-Seite erklärt sich bei einer ETW, statt ein Formular zu zeigen", () => {
    expect(lies("app/(app)/properties/[id]/nebenkosten/page.tsx")).toMatch(/nkAmObjekt[\s\S]{0,2000}nur bei mehreren Mietparteien/);
  });
});

describe("Anführungszeichen: „…“ schließt mit “, nie mit \" (B35-Nachlese)", () => {
  const dateien = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? dateien(p) : /\.(tsx|ts)$/.test(f) ? [p] : [];
    });
  it("kein „${…}\" in App, Komponenten und lib", () => {
    const funde: string[] = [];
    for (const f of [...dateien("app"), ...dateien("components"), ...dateien("lib")]) {
      for (const m of lies(f).matchAll(/„\$\{[^}]*\}"/g)) funde.push(`${f}: ${m[0]}`);
    }
    expect(funde).toEqual([]);
  });
});

describe("B58/C1–C5 — Inhalte und Listen", () => {
  it("Verbrauch: Filter ohne Treffer ist kein „noch nichts angelegt“ (B58)", () => {
    expect(lies("components/lists/VerbrauchListe.tsx")).toMatch(/rows\.length === 0 && gefiltert[\s\S]{0,200}art="filter"/);
    expect(lies("app/(app)/verbrauch/page.tsx")).toContain("gefiltert={(verb ?? []).length > 0}");
  });

  it("Diagramm: der Rand links wächst mit der längsten Beschriftung, der Achsentitel liegt davor (C1)", () => {
    const ticks = [-40000, 0, 40000, 80000];
    const laengste = Math.max(...ticks.map((t) => kurzTick(t).length));
    const rand = linkerRand(ticks);
    // Rechte Kante des Titelbands + Abstand + Beschriftung muss in den Rand passen.
    expect(ACHSENTITEL_BAND + 6 + laengste * ZEICHEN_PX).toBeLessThanOrEqual(rand);
    expect(linkerRand([-1_250_000, 2_500_000])).toBeGreaterThan(linkerRand([0, 10]));
    expect(linkerRand([0, 10])).toBe(56);
    expect(lies("components/BetragChart.tsx")).toContain("linkerRand(scale.ticks)");
  });

  it("Indexwert: Abweichung bezogen auf die Schätzung (C2)", () => {
    // (465.000 − 492.449) / 492.449 = −5,57 % → −5,6; vorher geteilt durch 465.000 → 5,9.
    expect(abweichungZurSchaetzung(465_000, 492_449)).toBe(-5.6);
    expect(abweichungZurSchaetzung(520_000, 500_000)).toBe(4);
    expect(abweichungZurSchaetzung(null, 500_000)).toBeNull();
    expect(abweichungZurSchaetzung(500_000, 0)).toBeNull();
  });

  it("Kontoauszug: Einzahl/Mehrzahl und Karten statt 640-px-Tabelle am Handy (C3)", () => {
    const k = lies("components/KontoauszugAbgleich.tsx");
    expect(k).toContain('ergebnis.ohneZuordnung.length === 1 ? "Eingang" : "Eingänge"');
    expect(k).toContain('ergebnis.ausgaenge === 1 ? "Ausgang" : "Ausgänge"');
    expect(k).toContain('className="ka-tabelle"');
    expect(k).not.toContain("minWidth: 640");
    for (const l of ["Eingang", "Zahler / Zweck", "Mieter", "Mietmonat", "Grund"]) expect(k, l).toContain(`data-label="${l}"`);
    const block = mediaBlock("@media (max-width: 640px) {\n  .ka-tabelle");
    expect(block).toMatch(/\.ka-tabelle thead \{ display: none; \}/);
    expect(block).toMatch(/\.ka-tabelle \{ min-width: 0; \}/);
  });

  it("Demo-Leiste verspricht kein Schloss (C4)", () => {
    expect(lies("components/DemoLeiste.tsx").replace(/\{\/\*[\s\S]*?\*\/\}/g, "")).not.toMatch(/Schloss/);
  });

  it("„N weitere“ zählt Einträge, nicht Überschriften (C5)", () => {
    const kopf = (k: string) => createElement("div", { key: k, "data-kopf": true }, k);
    const eintrag = (k: string) => createElement("div", { key: k }, k);
    // 3 Überschriften, 20 Einträge, Grenze 12.
    const items = [
      kopf("Überfällig"),
      ...Array.from({ length: 4 }, (_, i) => eintrag(`a${i}`)),
      kopf("Oktober"),
      ...Array.from({ length: 8 }, (_, i) => eintrag(`b${i}`)),
      kopf("November"),
      ...Array.from({ length: 8 }, (_, i) => eintrag(`c${i}`)),
    ];
    const { ende, verborgen } = aufteilen(items, 12);
    const sichtbar = items.slice(0, ende);
    expect(sichtbar.filter((x) => !istKopf(x))).toHaveLength(12);
    expect(verborgen).toBe(8);
    // Endet die Grenze direkt nach einer Überschrift, bleibt sie mit verborgen.
    const knapp = aufteilen([eintrag("x"), kopf("K"), eintrag("y")], 1);
    expect(knapp.ende).toBe(1);
    expect(knapp.verborgen).toBe(1);
    // Ohne Überschriften wie vorher.
    expect(aufteilen([eintrag("1"), eintrag("2"), eintrag("3")], 2)).toEqual({ ende: 2, verborgen: 1 });
    const t = lies("app/(app)/termine/page.tsx");
    expect((t.match(/className="tz-gruppe" data-kopf/g) ?? []).length).toBe(3);
  });
});

describe("C11–C13 — Text", () => {
  it("„ausschließlich“ mit ß (C11)", () => {
    expect(lies("app/(app)/auftrag/[token]/page.tsx")).not.toContain("ausschliesslich");
  });
  it("Titel des Anliegens trennt an Silben, nicht mitten im Wort (C12)", () => {
    const a = lies("components/AnliegenPortal.tsx");
    expect(a).toMatch(/<h2 style=\{\{[^}]*hyphens: "auto"[^}]*\}\}>\{a\.titel\}<\/h2>/);
    expect(a).not.toMatch(/<h2 style=\{\{[^}]*overflowWrap: "anywhere"[^}]*\}\}>\{a\.titel\}/);
  });
  it("„Zählerstände“ steht nicht zweimal übereinander (C13)", () => {
    expect(lies("components/ZaehlerPortal.tsx")).not.toContain("<h3>Zählerstände</h3>");
  });
});

describe("B60 — Tippziele am Touch-Gerät", () => {
  const touch = mediaBlock("@media (pointer: coarse) {\n  .btn { min-height: 44px; }");
  it("Knöpfe und Felder mindestens 44 px, Checkboxen 22 px", () => {
    expect(touch).toContain(".btn { min-height: 44px; }");
    expect(touch).toMatch(/\.input, \.form-group input[^{]*\{ min-height: 44px; \}/);
    expect(touch).toMatch(/input\[type="checkbox"\], input\[type="radio"\] \{ width: 22px; height: 22px; \}/);
    expect(touch).toMatch(/\.sprungmarken a \{ padding: 10px/);
    expect(touch).toMatch(/\.tipp-flaeche \{[^}]*min-height: 44px/);
  });
  it("kleine Symbole behalten ihr Aussehen, die Tippfläche wächst unsichtbar", () => {
    expect(css).toMatch(/\.delete-btn::after \{ content: ""; position: absolute; inset: -10px; \}/);
    expect(css).toMatch(/\.theme-knopf::after \{ content: ""; position: absolute; inset: -8px -4px; \}/);
    expect(css).toMatch(/\.theme-knopf \{[^}]*position: relative/);
  });
  it("die Regeln gelten nur mit grobem Zeiger — mit Maus bleibt alles, wie es war", () => {
    expect(css.indexOf(".btn { min-height: 44px; }")).toBeGreaterThan(css.indexOf("@media (pointer: coarse) {\n  .btn { min-height: 44px; }"));
    expect(css).not.toMatch(/^\.btn \{[^}]*min-height/m);
  });
  it("Login, /anmelden und Start-Hinweis tragen die Tippfläche", () => {
    expect(lies("app/(app)/login/page.tsx").match(/tipp-flaeche/g)?.length).toBeGreaterThanOrEqual(2);
    expect(lies("app/(app)/anmelden/page.tsx").match(/tipp-flaeche/g)?.length).toBe(4);
    expect(lies("components/BackLink.tsx")).toContain('className="zurueck-link"');
  });
});

describe("C6/C8/C9/C14 — Farbe, Link, Raster, Theme", () => {
  it("Überschuss in Text-Gold, nicht im Füll-Gold (C6)", () => {
    const a = lies("components/AnlageVExport.tsx");
    expect(a).not.toMatch(/ueberschuss >= 0 \? "var\(--gold-fill\)"/);
    expect(a.match(/ueberschuss >= 0 \? "var\(--gold\)"/g)?.length).toBe(2);
  });
  it("Links im Kleingedruckten sind als Link erkennbar (C8)", () => {
    expect(css).toMatch(/\.sanierung-klein a \{ color: var\(--gold\); text-decoration: underline; \}/);
  });
  it("Strategie-Felder strecken sich nicht nach der Nachbarbeschriftung (C9)", () => {
    expect(css).toMatch(/\.strategie-felder \.form-group \{[^}]*align-content: start/);
  });
  it("Theme-Symbol per CSS, kein Zustand, der erst nach der Hydration stimmt (C14)", () => {
    const t = lies("components/ThemeToggle.tsx");
    expect(t).not.toMatch(/useState|useEffect/);
    expect(t).toContain('type="button"');
    expect(css).toMatch(/:root\[data-theme="dark"\] \.tt-dunkel \{ display: inline; \}/);
    expect(css).toMatch(/:root\[data-theme="dark"\] \.tt-hell \{ display: none; \}/);
    expect(css).toMatch(/:root:not\(\[data-theme\]\) \.tt-dunkel \{ display: inline; \}/);
  });
});

describe("C57–C59 — Schriftgröße und Kontrast", () => {
  it("Markenunterzeile nicht unter 11 px (C57)", () => {
    expect(css).toMatch(/\.qlx-brand-sub \{\s*font-size: 11px/);
    expect(lies("components/BrandMark.tsx")).toMatch(/fontSize: 11, letterSpacing/);
    expect(lies("components/NichtGefunden.tsx")).not.toMatch(/fontSize: (9|10)\b/);
  });
  it("Startseite „Ein Link statt Aktenordner“: graue Schrift ≥ 4,5:1 auf dem hellen Grund (C58)", () => {
    expect(css).toMatch(/\.lp-ordner-liste li \{[^}]*color: var\(--l-muted, var\(--muted\)\)/);
    expect(css).toMatch(/\.lp-ordner-fuss \{[^}]*color: var\(--l-muted, var\(--muted\)\)/);
    const muted = rgb(token(".qlx {", "--l-muted"));
    expect(kontrast(muted, rgb("#F2EEE5"))).toBeGreaterThanOrEqual(4.5);
    expect(kontrast(muted, WEISS)).toBeGreaterThanOrEqual(4.5);
  });
  it("Briefvorschau: blasse Schrift auf dem weißen Blatt ≥ 4,5:1 (C59)", () => {
    expect(kontrast(rgb(token(".brief-sheet {", "--faint")), WEISS)).toBeGreaterThanOrEqual(4.5);
  });
  it("Badges im hellen Modus ≥ 4,5:1 auf ihrer getönten Fläche (C59)", () => {
    const gruen = rgb(token(":root {", "--green"));
    const rot = rgb(token(":root {", "--red"));
    // Fläche = --green-dim (0,10) bzw. --red-dim (0,07) über Weiß.
    expect(kontrast(rgb(token(":root {", "--badge-gruen")), mische(gruen, 0.1, WEISS))).toBeGreaterThanOrEqual(4.5);
    expect(kontrast(rgb(token(":root {", "--badge-rot")), mische(rot, 0.07, WEISS))).toBeGreaterThanOrEqual(4.5);
    expect(css).toContain(".badge-green { background: var(--green-dim); color: var(--badge-gruen, var(--green));");
    expect(css).toContain(".badge-red { background: var(--red-dim); color: var(--badge-rot, var(--red));");
    // Dunkel und die eingefrorene Startseite behalten ihre Farben.
    expect(css.match(/--badge-gruen: var\(--green\)/g)?.length).toBe(3);
  });
});

describe("C54–C56, C60 — Login und Fehlerseiten", () => {
  const login = lies("app/(app)/login/page.tsx");
  it("„Passwort vergessen?“ prüft die Adresse vor dem Versand (C54)", () => {
    const r = login.slice(login.indexOf("async function resetPassword"));
    // Die Abbruchbedingung selbst, nicht nur das Wort: `if (!istEmail(email)) { … return; }` vor dem Versand.
    const pruefung = r.search(/\n\s*if \(!istEmail\(email\)\) \{\s*setError\("Bitte eine gültige E-Mail-Adresse eingeben\."\);\s*return;\s*\}/);
    expect(pruefung).toBeGreaterThan(0);
    expect(pruefung).toBeLessThan(r.indexOf("resetPasswordForEmail"));
    expect(login).toMatch(/m\.includes\("validate email"\)/);
  });
  it("eine alte Meldung verschwindet, sobald korrigiert wird (C55)", () => {
    for (const setter of ["setPassword(e.target.value)", "setPassword2(e.target.value)", "setEmail(e.target.value)"]) {
      expect(login, setter).toMatch(new RegExp(setter.replace(/[()]/g, "\\$&") + ";[\\s\\S]{0,200}if \\(error\\) setError\\(null\\)"));
    }
  });
  it("Felder sagen dem Passwortmanager, was sie sind (C60)", () => {
    expect(login).toContain('autoComplete="email"');
    expect(login).toContain('autoComplete={mode === "signup" ? "new-password" : "current-password"}');
    expect(login).toContain('autoComplete="new-password"');
  });
  it("öffentliche Strecke und äußerster Rahmen haben eine deutsche Fehlerseite (C56)", () => {
    expect(existsSync("app/(pub)/error.tsx")).toBe(true);
    expect(existsSync("app/global-error.tsx")).toBe(true);
    for (const f of ["app/(pub)/error.tsx", "app/global-error.tsx", "components/FehlerSeite.tsx"]) expect(lies(f).startsWith('"use client";'), f).toBe(true);
    const g = lies("app/global-error.tsx");
    expect(g).toContain('<html lang="de">');
    expect(g).toContain("<FehlerSeite");
    const f = lies("components/FehlerSeite.tsx");
    expect(f).toContain("window.location.reload()");
    expect(f).toContain("Diese Seite ließ sich nicht laden");
  });
});
