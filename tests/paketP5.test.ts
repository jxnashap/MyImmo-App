// Paket P5 der Gesamtprüfung 07.10.2026 (docs/AUDIT-2026-10-07-gesamt.md): Demo-Sicherheit.
// B52 Abmelden global · B53 öffentlicher Auftrags-Link schreibt · B54 Schreibknöpfe außerhalb von
// Formularen · B55 Demo-Mieter ohne Sperr-Dialog · B56 Dokument ohne Datei · C53 Alt-Adressen ·
// dazu die bekannten B26 (Lese-Werkzeuge gesperrt) und C22 (Anlege-Formulare offen).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  demoDarfRoute, demoBereich, demoAktion, demoHeim, DEMO_AKTIONEN, DEMO_BEREICHE,
  DEMO_EMAIL, DEMO_MIETER_EMAIL, DEMO_SERVICE_KONTEN,
} from "@/lib/demo";
import { istDemoSperre, dbFehlerText, mitDemoHinweis, DEMO_NICHT_GESPEICHERT } from "@/lib/demoFehler";
import { schreibKnoepfe } from "./stubs/demoSchreibKnoepfe";
import { entkleide } from "./stubs/tsAnweisungen";
import { fakeSupabase, mockeNextUndSupabase, fd } from "./stubs/actionHarness";

const lies = (p: string) => readFileSync(p, "utf8");

/** Alle Dateien unter `dir` mit einer der Endungen (die @types/node-Fassung kennt kein globSync). */
function dateienUnter(dir: string, endungen: string[]): string[] {
  return readdirSync(dir).flatMap((e) => {
    const voll = join(dir, e);
    if (e === "node_modules" || e.startsWith(".")) return [];
    if (statSync(voll).isDirectory()) return dateienUnter(voll, endungen);
    return endungen.some((x) => e.endsWith(x)) ? [voll] : [];
  });
}

describe("B52 — Abmelden beendet nur DIESE Sitzung", () => {
  const dateien = [...dateienUnter("app", [".ts", ".tsx"]), ...dateienUnter("components", [".tsx"]), ...dateienUnter("lib", [".ts"])];
  const aufrufe = dateien.flatMap((f) =>
    [...entkleide(lies(f)).matchAll(/\.signOut\(([^)]*)\)/g)].map((m) => ({ f, arg: lies(f).slice(m.index! + 9, m.index! + 9 + m[1].length) })),
  );

  it("der Wächter hat überhaupt etwas gefunden", () => {
    expect(aufrufe.length).toBeGreaterThanOrEqual(8);
  });

  it("kein signOut() ohne Scope — die Bibliothek nimmt dann „global“", () => {
    const ohne = aufrufe.filter((a) => !/scope:/.test(a.arg)).map((a) => a.f);
    expect(ohne).toEqual([]);
  });

  it("global nur beim Passwort-Reset, „others“ nur in den Einstellungen", () => {
    for (const a of aufrufe) {
      if (/"global"/.test(a.arg)) expect(a.f).toBe("components/PasswortNeu.tsx");
      if (/"others"/.test(a.arg)) expect(a.f).toBe("components/SettingsView.tsx");
    }
    expect(lies("components/DemoSperre.tsx")).toMatch(/signOut\(\{ scope: "local" \}\)/);
    expect(lies("components/AutoLogout.tsx")).toMatch(/signOut\(\{ scope: "local" \}\)/);
    expect(lies("app/(app)/auth/signout/route.ts")).toMatch(/signOut\(\{ scope: "local" \}\)/);
  });
});

describe("B53 — öffentliche Links der Demo nehmen nichts an", () => {
  const mig = lies("supabase/migrations/20261008100000_demo_oeffentliche_links.sql");
  const funktion = (name: string) => {
    const i = mig.indexOf(`create or replace function public.${name}(`);
    return mig.slice(i, mig.indexOf("$function$;", i));
  };

  it("gehoert_demo kennt genau die Demo-Konten aus lib/demo.ts", () => {
    const f = funktion("gehoert_demo");
    const inDb = [...f.matchAll(/'([^']+@myimmo\.test)'/g)].map((m) => m[1]).sort();
    expect(inDb).toEqual([DEMO_EMAIL, DEMO_MIETER_EMAIL, ...DEMO_SERVICE_KONTEN].sort());
    expect(mig).toMatch(/revoke execute on function public\.gehoert_demo\(uuid\) from public, anon, authenticated/);
  });

  it("die Rückmeldung bricht für Demo-Aufträge ab, BEVOR sie schreibt", () => {
    const f = funktion("auftrag_public_rueckmeldung");
    const abbruch = f.indexOf("if public.gehoert_demo(a.vermieter_id) then");
    expect(abbruch).toBeGreaterThan(0);
    expect(abbruch).toBeLessThan(f.indexOf("insert into auftrag_rueckmeldungen"));
    expect(abbruch).toBeLessThan(f.indexOf("update auftraege set termin"));
    expect(funktion("auftrag_public_info")).toMatch(/'demo', public\.gehoert_demo\(a\.vermieter_id\)/);
  });

  it("zweite Linie: Trigger auf allen Eingangstabellen, der Demo-Reset (service_role) schreibt weiter", () => {
    for (const t of ["auftrag_rueckmeldungen", "angebote", "beleihung_rueckmeldungen", "bewerbungen", "bewerbung_dateien", "freigabe_eingang", "freigabe_termine"]) {
      expect(mig).toContain(`create or replace trigger demo_eingang_sperre before insert on public.${t}`);
    }
    const f = funktion("demo_eingang_sperre");
    expect(f).toMatch(/if v_rolle not in \('anon', 'authenticated'\) then\s*return new;/);
    expect(f).toMatch(/errcode = '42501', hint = 'demo_nur_lesen'/);
    expect(mig).not.toMatch(/\b(delete|drop)\b/i);
  });

  it("die Seite sagt es vorher und schaltet Senden ab (Ausfüllen ja, Senden nein)", () => {
    expect(lies("app/(app)/auftrag/[token]/page.tsx")).toMatch(/<AuftragRueckmeldung token=\{params\.token\} demo=\{info\.demo === true\} \/>/);
    const k = lies("components/AuftragRueckmeldung.tsx");
    expect(k).toMatch(/disabled=\{laeuft \|\| demo\}/);
    expect(k).toMatch(/if \(demo\) \{\s*setFehler\(DEMO_AUFTRAG_HINWEIS\);\s*return;/);
  });
});

describe("B54 — Schreibknöpfe außerhalb von Formularen", () => {
  const knoepfe = dateienUnter("components", [".tsx"]).flatMap((f) => schreibKnoepfe(f));

  it("der Wächter findet Knöpfe — er hat gesucht", () => {
    expect(knoepfe.length).toBeGreaterThanOrEqual(60);
    expect(knoepfe.some((k) => k.datei === "components/BeleihungsOrdner.tsx" && k.ruft.includes("generiereBeleihungDokument"))).toBe(true);
  });

  it("jeder Knopf, der eine Server-Action DIREKT im onClick startet, trägt data-demo-sperre", () => {
    const offen = knoepfe.filter((k) => k.direkt && !k.markiert).map((k) => `${k.datei}:${k.zeile} ${k.ruft.join(",")}`);
    expect(offen).toEqual([]);
  });

  it("die im Audit genannten Wege sind markiert", () => {
    const markiert = (datei: string, name: string) =>
      knoepfe.some((k) => k.datei === datei && k.ruft.includes(name) && k.markiert);
    expect(markiert("components/UebergabeProtokoll.tsx", "speichereProtokoll")).toBe(true);
    expect(markiert("components/kauf/ObjektRechner.tsx", "speichern")).toBe(true);
    expect(markiert("components/SchadenAssistent.tsx", "senden")).toBe(true);
    expect(markiert("components/DokumenteAnfrage.tsx", "anfordern")).toBe(true);
  });

  it("das Übergabeprotokoll: Ausfüllen und PDF frei, Speichern erklärt sich", () => {
    expect(lies("components/UebergabeProtokoll.tsx")).toMatch(/method="POST" className="form-actions" data-demo-erlaubt>/);
    expect(demoDarfRoute("/tenants/abc/protokoll")).toBe(true);
    expect(demoDarfRoute("/tenants/abc/protokoll/pdf")).toBe(true);
  });

  it("DemoSperre fängt markierte Knöpfe ab, BEVOR sie Links prüft", () => {
    const s = lies("components/DemoSperre.tsx");
    const knopf = s.indexOf('closest?.("[data-demo-sperre]")');
    expect(knopf).toBeGreaterThan(0);
    expect(knopf).toBeLessThan(s.indexOf('closest?.("a[href]")'));
    expect(s).toMatch(/setOffen\(demoAktion\(knopf\.getAttribute\("data-demo-sperre"\)\)\)/);
  });

  it("Texte je Aktion, unbekannt → „speichern“", () => {
    expect(demoAktion("export")).toBe(DEMO_AKTIONEN.export);
    expect(demoAktion("loeschen")).toBe(DEMO_AKTIONEN.loeschen);
    expect(demoAktion("")).toBe(DEMO_AKTIONEN.speichern);
    expect(demoAktion(null)).toBe(DEMO_AKTIONEN.speichern);
    expect(demoAktion("irgendwas")).toBe(DEMO_AKTIONEN.speichern);
  });
});

describe("B54 — Fehler der Demo-Sperre sagen, warum", () => {
  it("nur der Demo-Trigger, nicht jede 42501 (die meldet auch eine echte RLS-Policy)", () => {
    expect(istDemoSperre({ code: "42501", hint: "demo_nur_lesen" })).toBe(true);
    expect(istDemoSperre({ code: "42501", message: "In der Demo wird nichts gespeichert. Mit eigenem Zugang …" })).toBe(true);
    expect(istDemoSperre({ code: "42501", message: "new row violates row-level security policy" })).toBe(false);
    expect(istDemoSperre({ code: "23505", hint: "demo_nur_lesen" })).toBe(false);
    expect(istDemoSperre(null)).toBe(false);
    expect(dbFehlerText({ code: "42501", hint: "demo_nur_lesen" }, "x")).toBe(DEMO_NICHT_GESPEICHERT);
    expect(dbFehlerText({ code: "42501", message: "rls" }, "x")).toBe("x");
  });

  it("Toast in der Demo: Fehler bekommen die Erklärung, Erfolg nicht, kein Doppel", () => {
    expect(mitDemoHinweis("Speichern fehlgeschlagen.", "error", true)).toBe("Speichern fehlgeschlagen. In der Demo wird nichts gespeichert.");
    expect(mitDemoHinweis("Speichern fehlgeschlagen", "error", true)).toBe("Speichern fehlgeschlagen. In der Demo wird nichts gespeichert.");
    expect(mitDemoHinweis("Gespeichert.", "success", true)).toBe("Gespeichert.");
    expect(mitDemoHinweis("Speichern fehlgeschlagen.", "error", false)).toBe("Speichern fehlgeschlagen.");
    expect(mitDemoHinweis(DEMO_NICHT_GESPEICHERT, "error", true)).toBe(DEMO_NICHT_GESPEICHERT);
    expect(lies("components/Toast.tsx")).toMatch(/mitDemoHinweis\(msg, type, demo\)/);
    expect(lies("components/DemoNurLesen.tsx")).toMatch(/document\.documentElement\.dataset\[DEMO_MERKMAL\] = "1"/);
  });

  describe("Schaden melden / Dokument anfragen in der Demo (Action)", () => {
    beforeEach(() => vi.resetModules());
    afterEach(() => {
      for (const m of ["next/cache", "next/navigation", "@/lib/supabase/server", "@/lib/supabase/admin"]) vi.doUnmock(m);
    });
    const ZUGANG = { vermieter_id: "v-1", mieter_id: "m-1", prop_id: "p-1" };
    async function lade(fehler: Record<string, unknown>) {
      vi.resetModules();
      const { client } = fakeSupabase({ antworten: { mieter_zugaenge: ZUGANG }, fehlerBei: { "anliegen:insert": fehler } } as never);
      mockeNextUndSupabase(client);
      return import("@/lib/actions/anliegen");
    }
    it("Demo-Sperre → Demo-Text", async () => {
      const mod = await lade({ message: "In der Demo wird nichts gespeichert.", code: "42501", hint: "demo_nur_lesen" });
      expect(await mod.erstelleAnliegen(fd({ typ: "schaden", titel: "Heizung" }))).toEqual({ error: DEMO_NICHT_GESPEICHERT });
    });
    it("anderer Fehler → eigener Satz", async () => {
      const mod = await lade({ message: "boom", code: "XX000" });
      expect(await mod.erstelleAnliegen(fd({ typ: "schaden", titel: "Heizung" }))).toEqual({ error: "Anliegen konnte nicht gespeichert werden." });
    });
  });
});

describe("B55 — Demo-Mieter und Demo-Service: Sperr-Dialog und richtige Startseite", () => {
  it("die Portal-Hülle bindet den Sperr-Dialog ein (zweimal im Layout: App und Portal)", () => {
    const layout = lies("app/(app)/layout.tsx");
    expect(layout.match(/<DemoSperre \/>/g)?.length).toBe(2);
  });

  it("der Proxy schickt jedes Demo-Konto auf SEINE Startseite, `bereich` bleibt erhalten", () => {
    expect(demoHeim(DEMO_EMAIL)).toBe("/");
    expect(demoHeim(DEMO_MIETER_EMAIL)).toBe("/portal");
    for (const s of DEMO_SERVICE_KONTEN) expect(demoHeim(s)).toBe("/service");
    expect(demoHeim(undefined)).toBe("/");
    expect(lies("proxy.ts")).toMatch(/new URL\(demoHeim\(user\.email\), request\.url\)/);
  });

  it("Export und Löschen erklären sich (Mieter/Service UND Vermieter)", () => {
    for (const f of ["components/KontoVerwaltung.tsx", "components/SettingsView.tsx"]) {
      const s = lies(f);
      expect(s).toMatch(/data-demo-sperre="export" onClick=\{\(\) => absichern\(\(\) => window\.location\.assign\("\/api\/export\/alles"\)\)\}/);
      expect(s).toMatch(/data-demo-sperre="loeschen"[^>]*onClick=\{\(\) => (setOffen|setOpen)\(true\)\}/);
    }
    expect(demoBereich("/api/export/alles")).toBe(DEMO_BEREICHE["/api/export/alles"]);
  });
});

describe("B56 — Dokument ohne Datei", () => {
  it("das Portal zeigt Ansehen/Herunterladen nur mit Datei", () => {
    const s = lies("components/PortalAnsicht.tsx");
    const i = s.indexOf("/archiv/${d.id}/datei`}");
    expect(i).toBeGreaterThan(0);
    expect(s.slice(i - 220, i)).toMatch(/\{d\.datei_name \? \(/);
  });

  it("die Route antwortet ohne Datei mit einer lesbaren Seite (404, HTML)", () => {
    const r = lies("app/(app)/archiv/[id]/datei/route.ts");
    expect(r).toMatch(/if \(!n\?\.datei_data\) return keineDatei\(\);/);
    expect(r).toMatch(/status: 404, headers: \{ "Content-Type": "text\/html; charset=utf-8"/);
    // Route-Dateien dürfen nur HTTP-Methoden und Segment-Konfiguration exportieren.
    expect(r).not.toMatch(/export function keineDatei/);
  });
});

describe("C53 — Alt-Adressen, die auf freie Ziele weiterleiten", () => {
  it("frei, aber nur exakt", () => {
    for (const p of ["/bewerbungen", "/einnahmen", "/kosten"]) expect(demoDarfRoute(p)).toBe(true);
    for (const p of ["/einnahmen/x/edit", "/einnahmen/new", "/kosten/new", "/kosten/x/edit", "/bewerbungen/x"]) {
      expect(demoDarfRoute(p), p).toBe(false);
    }
    expect(demoDarfRoute("/kosten/x/rechnung")).toBe(true);
  });
});

describe("C22 — kein Anlege-, Bearbeiten- oder Import-Formular in der Demo", () => {
  // Alle Seiten-Verzeichnisse new/neu/edit/import unter app/(app) — auch künftige.
  const formularRouten: string[] = [];
  const lauf = (dir: string, pfad: string) => {
    for (const e of readdirSync(dir)) {
      const voll = join(dir, e);
      if (!statSync(voll).isDirectory()) continue;
      const seg = e.startsWith("(") ? "" : `/${e.replace(/^\[(.+)\]$/, "x")}`;
      const neu = pfad + seg;
      if (/^(new|neu|edit|import)$/.test(e)) formularRouten.push(neu);
      lauf(voll, neu);
    }
  };
  lauf("app/(app)", "");

  it("der Wächter hat die Formulare gefunden", () => {
    expect(formularRouten.length).toBeGreaterThanOrEqual(15);
    expect(formularRouten).toContain("/cashflow/neu");
    expect(formularRouten).toContain("/kredite/x/edit");
  });

  it("alle gesperrt, mit dem Text „Anlegen und bearbeiten“", () => {
    for (const p of formularRouten) {
      expect(demoDarfRoute(p), p).toBe(false);
      expect(demoBereich(p).titel, p).toBe("Anlegen und bearbeiten");
    }
  });

  it("Lesendes bleibt frei", () => {
    for (const p of ["/cashflow", "/kredite", "/verbrauch", "/termine", "/properties", "/properties/x", "/tenants/x", "/tenants/x/nk", "/tenants/x/dokument", "/einstellungen"]) {
      expect(demoDarfRoute(p), p).toBe(true);
    }
  });
});

describe("B26 — Lese-Werkzeuge sind in der Demo bedienbar", () => {
  const s = lies("components/DemoNurLesen.tsx");
  it("gesperrt werden nur Felder in einem ABSENDENDEN Formular", () => {
    expect(s).toMatch(/function schreibFormular\(el: Element\): boolean \{\s*const f = el\.closest\("form"\);\s*return !!f && \(f\.getAttribute\("method"\) \?\? ""\)\.toLowerCase\(\) !== "get";/);
    expect(s.match(/if \(erlaubt\(el\) \|\| !schreibFormular\(el\)\) return;/g)?.length).toBe(2);
  });
  it("Befehlspalette, Rechner und Steuerjahr stehen in keinem absendenden Formular", () => {
    for (const f of ["components/ui/CommandPalette.tsx", "components/kalkulator/AfaAssistent.tsx", "components/AnlageVExport.tsx", "components/KaufAssistent.tsx", "components/BewertungAssistent.tsx", "components/VerkaufRechner.tsx"]) {
      expect(entkleide(lies(f)), f).not.toMatch(/<form\b/);
    }
  });
});
