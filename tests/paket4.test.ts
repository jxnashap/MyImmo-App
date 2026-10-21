// Paket 4 der Durchsicht 21.10.2026 — „Vermieter schneller“.
//
// Was hier festgehalten wird: Der Schadensfall läuft in EINER Ansicht (Weiterleiten mit Bezug,
// Abschluss und Kostenbuchung im Anliegen, Termin ohne Doppel-Eintrag), Formulare fragen zuerst
// das Nötige, ein einziges Objekt ist vorgewählt, fällige wiederkehrende Buchungen fallen auf, und
// die kleinen Sackgassen (Vergleichsmiete, Rücksprung, „Prüfen“) sind zu.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { statusBeimAntworten, weiterleitenHref } from "@/lib/anliegenListe";
import { anliegenTermine, alterKalenderTitel, ANLIEGEN_TERMIN_SPALTEN } from "@/lib/anliegenTermin";
import { vorgewaehltesObjekt } from "@/lib/objektWahl";
import { faelligeAnzahl, gebuchtJeVorlage } from "@/lib/wiederkehr";
import { baueHeuteAufgaben } from "@/lib/heute";
import { naechsteReihe, nkFrist, nkStand } from "@/lib/nkObjektStand";
import { mieterFristen } from "@/lib/fristen";
import { objektCheck } from "@/lib/objektCheck";

const lies = (p: string) => readFileSync(p, "utf8");
const ohneKommentare = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("Schadensfall: Antworten setzt „In Arbeit“", () => {
  it("nur aus „offen“ und nur mit Text", () => {
    expect(statusBeimAntworten("offen", "Ich kümmere mich")).toBe("in_arbeit");
    expect(statusBeimAntworten("offen", "   ")).toBe("offen");
    expect(statusBeimAntworten("erledigt", "Nachtrag")).toBe("erledigt");
    expect(statusBeimAntworten("in_arbeit", "x")).toBe("in_arbeit");
  });
  it("das Formular schlägt es vor, eine eigene Wahl gewinnt", () => {
    const m = lies("components/AnliegenManager.tsx");
    expect(m).toContain("if (!statusGewaehlt) setStatus(statusBeimAntworten(a.status, e.target.value))");
    expect(m).toContain("setStatus(e.target.value); setStatusGewaehlt(true);");
    expect(m).not.toContain('defaultValue={a.status}');
  });
});

describe("Schadensfall: Weiterleiten mit Bezug", () => {
  it("Anliegen und Objekt gehen mit, der Mieter-Kontakt nicht", () => {
    const h = weiterleitenHref({ id: "a-1", titel: "Heizung", text: "Anna, Altbau: kalt", propId: "p-1" });
    const u = new URL(h, "https://x");
    expect(u.pathname).toBe("/anliegen");
    expect(u.searchParams.get("tab")).toBe("service");
    expect(u.searchParams.get("anliegen")).toBe("a-1");
    expect(u.searchParams.get("prop")).toBe("p-1");
    expect(u.searchParams.has("mieter")).toBe(false);
    expect(u.hash).toBe("#auftrag-vergeben");
    expect(new URL(weiterleitenHref({ id: "a", titel: "t", text: "x".repeat(3000), propId: null }), "https://x").searchParams.get("text")!.length).toBe(1500);
  });
  it("das Formular nimmt den Bezug an, wählt aber den Mieter-Kontakt NICHT vor", () => {
    const s = lies("components/ServiceManager.tsx");
    expect(s).toContain('{initialAnliegen && <input type="hidden" name="anliegenId" value={initialAnliegen} />}');
    expect(s).toContain('id="auftrag-vergeben"');
    expect(s).toMatch(/<select name="mieterId" defaultValue="">/);
    // Nur eigene Objekte als Vorgabe.
    expect(s).toContain("initialProp && properties.some((p) => p.id === initialProp) ? initialProp : \"\"");
    // Nur ein Anliegen aus der eigenen Liste wird übergeben.
    expect(lies("app/(app)/anliegen/page.tsx")).toContain("searchParams.anliegen && liste.some((x) => x.id === searchParams.anliegen)");
    expect(lies("lib/actions/service.ts")).toContain("anliegen_id: anliegenId || null,");
  });
  it("ohne verknüpften Partner kein Weiterleiten-Knopf", () => {
    const m = ohneKommentare(lies("components/AnliegenManager.tsx"));
    expect(m).toMatch(/\{hatPartner && \(\s*<Link\s+href=\{weiterleitenHref\(/);
    expect(lies("app/(app)/anliegen/page.tsx")).toContain("hatPartner={partner.length > 0}");
  });
});

describe("Schadensfall: Abschluss und Kosten im Anliegen", () => {
  it("dieselben Bausteine wie im Reiter Service — keine zweite Regel", () => {
    const m = lies("components/AnliegenManager.tsx");
    expect(m).toContain("<AuftragAbschliessen a={x} />");
    expect(m).toContain("<KostenUebernahme a={x} />");
    const s = lies("components/ServiceManager.tsx");
    expect(s).toContain("export function KostenUebernahme(");
    expect(s).toContain("export function AuftragAbschliessen(");
    // Die Seite gibt nur die Aufträge DIESES Anliegens mit.
    expect(lies("app/(app)/anliegen/page.tsx")).toContain("auftraege={auftraege.filter((x) => x.anliegen_id === vorgang.id)}");
    expect(lies("app/(app)/anliegen/page.tsx")).toMatch(/select\("[^"]*,anliegen_id"\)/);
  });
  it("„Anliegen abschließen“ erst, wenn alles erledigt und Rechnungen gebucht sind", () => {
    const m = lies("components/AnliegenManager.tsx");
    expect(m).toContain('auftraege.every((x) => x.status === "erledigt") && auftraege.every((x) => !(Number(x.betrag) > 0) || !!x.kosten_id)');
    expect(m).toContain('<input type="hidden" name="status" value="erledigt" />');
  });
});

describe("Termin vom Mieter: im Kalender ohne eigenen Eintrag", () => {
  const a = (x: Partial<Parameters<typeof anliegenTermine>[0][number]>) => ({ id: "a1", titel: "Heizung", termin_bestaetigt: "2026-10-22T14:30", status: "in_arbeit", mieter_id: "m1", prop_id: "p1", ...x });

  it("nur bestätigte, offene Anliegen; Datum und Uhrzeit aus dem Text, ohne Zeitzone", () => {
    expect(anliegenTermine([a({})])).toEqual([{ anliegenId: "a1", datum: "2026-10-22", uhr: "14:30", label: "Termin 14:30 Uhr · Heizung", mieterId: "m1", propId: "p1" }]);
    expect(anliegenTermine([a({ status: "erledigt" })])).toEqual([]);
    expect(anliegenTermine([a({ termin_bestaetigt: null })])).toEqual([]);
    expect(anliegenTermine([a({ termin_bestaetigt: "irgendwann" })])).toEqual([]);
  });
  it("ein Eintrag des alten Knopfs (gleicher Tag, gleicher Titel) erscheint nicht doppelt", () => {
    const alt = [{ titel: alterKalenderTitel("Heizung"), datum: "2026-10-22" }];
    expect(anliegenTermine([a({})], alt)).toEqual([]);
    expect(anliegenTermine([a({})], [{ titel: "Termin: Heizung", datum: "2026-10-23" }])).toHaveLength(1);
  });
  it("sortiert nach Tag UND Uhrzeit", () => {
    const r = anliegenTermine([a({ id: "b", termin_bestaetigt: "2026-10-22T16:00" }), a({ id: "c", termin_bestaetigt: "2026-10-22T09:15" })]);
    expect(r.map((x) => x.anliegenId)).toEqual(["c", "b"]);
  });
  it("der Knopf und die Action, die bei jedem Klick einen Eintrag schrieb, sind weg", () => {
    expect(lies("lib/actions/anliegen.ts")).not.toContain("terminInKalender");
    expect(lies("components/AnliegenManager.tsx")).not.toContain("terminInKalender");
    const t = lies("app/(app)/termine/page.tsx");
    expect(t).toContain('quelle: "anliegen"');
    expect(t).toContain('if (e.quelle === "eigen" || e.quelle === "anliegen") continue;');
    expect(lies("app/(app)/page.tsx")).toContain("anliegenTermine((anlTerminRows ?? [])");
  });
});

describe("Spalten, die es gibt (21.10.2026: das Dashboard fragte `anliegen.mieter_name` ab)", () => {
  // Die Test-Datenbank prüft keine Spaltennamen — deshalb war der Fehler in allen Tests grün,
  // während das Dashboard live „Mieter-Anliegen konnten nicht geladen werden“ zeigte.
  const migrationen = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).map((f) => lies(`supabase/migrations/${f}`)).join("\n");
  const spalten = (tabelle: string) => {
    const s = new Set<string>();
    const create = new RegExp(`create table if not exists public\\.${tabelle} \\(([\\s\\S]*?)\\n\\);`).exec(migrationen);
    for (const z of (create?.[1] ?? "").split("\n")) {
      const m = /^\s+([a-z_]+)\s+[a-z]/.exec(z);
      if (m && !["constraint", "primary", "unique", "foreign", "check"].includes(m[1])) s.add(m[1]);
    }
    for (const m of migrationen.matchAll(new RegExp(`alter table (?:if exists )?public\\.${tabelle}\\s+add column (?:if not exists )?([a-z_]+)`, "g"))) s.add(m[1]);
    return s;
  };
  const anliegen = spalten("anliegen");

  it("die Prüfung kennt die Tabelle (Gegenprobe)", () => {
    expect(anliegen.has("termin_bestaetigt")).toBe(true);
    expect(anliegen.has("mieter_id")).toBe(true);
    expect(anliegen.has("mieter_name")).toBe(false);
  });

  it("jede Abfrage auf `anliegen` in Seiten und Bibliotheken nennt nur vorhandene Spalten", () => {
    const quellen = ["app/(app)/page.tsx", "app/(app)/termine/page.tsx", "app/(app)/anliegen/page.tsx", "lib/portalDaten.ts"];
    const gefunden: string[] = [];
    for (const q of quellen) {
      const t = lies(q);
      for (const m of t.matchAll(/(?:from\("anliegen"\)\s*\.select\(|vielleichtAlle\(supabase, "anliegen", )"([^"]+)"/g)) gefunden.push(m[1]);
    }
    gefunden.push(ANLIEGEN_TERMIN_SPALTEN);
    expect(gefunden.length).toBeGreaterThanOrEqual(4);
    for (const liste of gefunden) {
      if (liste.trim() === "*") continue; // „alle Spalten“ nennt keine
      for (const sp of liste.split(",").map((x) => x.trim())) expect(anliegen.has(sp), `${sp} in „${liste}“`).toBe(true);
    }
  });
});

describe("Ein einziges Objekt ist vorgewählt", () => {
  const eins = [{ id: "p1" }];
  const zwei = [{ id: "p1" }, { id: "p2" }];
  it("gewünscht schlägt einzig; fremde IDs zählen nicht", () => {
    expect(vorgewaehltesObjekt(eins)).toBe("p1");
    expect(vorgewaehltesObjekt(zwei)).toBe("");
    expect(vorgewaehltesObjekt(zwei, "p2")).toBe("p2");
    expect(vorgewaehltesObjekt(zwei, "fremd")).toBe("");
    expect(vorgewaehltesObjekt(eins, "fremd")).toBe("p1");
    expect(vorgewaehltesObjekt([], undefined)).toBe("");
  });
  it("in allen drei Formularen", () => {
    expect(lies("app/(app)/tenants/new/page.tsx")).toContain("vorgewaehltesObjekt(props ?? [], searchParams.prop)");
    expect(lies("app/(app)/kredite/new/page.tsx")).toContain("vorgewaehltesObjekt(properties, searchParams.prop)");
    expect(lies("app/(app)/cashflow/neu/page.tsx")).toContain("vorgewaehltesObjekt(");
  });
});

describe("Mieterformular: das Nötige zuerst", () => {
  const f = lies("components/TenantForm.tsx");
  it("Mietbeginn ist beim Anlegen Pflicht und steht oben", () => {
    expect(f).toContain('required={!tenant} defaultValue={v("mietbeginn")}');
    expect(f.indexOf('name="mietbeginn"')).toBeLessThan(f.indexOf("setMehrOffen(true)"));
    expect(f.indexOf('name="kaltmiete"')).toBeLessThan(f.indexOf("setMehrOffen(true)"));
  });
  it("der Rest ist ausgeblendet, nicht entfernt — und beim Bearbeiten offen", () => {
    expect(f).toContain("useState(!!tenant)");
    expect(f).toContain('<div style={mehrOffen ? undefined : { display: "none" }}>');
    for (const n of ["iban", "kaution", "stellplatz_miete", "mietart", "notiz", "mietende"]) {
      expect(f.indexOf(`name="${n}"`), n).toBeGreaterThan(f.indexOf("setMehrOffen(true)"));
    }
  });
  it("leere Mieteradresse = Objektadresse steht am Feld", () => {
    expect(f).toContain("Leer lassen, wenn er im Objekt wohnt");
  });
  it("ohne Rückweg geht es zum neuen Mieter, nicht in die Liste", () => {
    expect(lies("app/(app)/tenants/new/page.tsx")).toContain("back={searchParams.back ? back : undefined}");
    expect(lies("lib/actions/tenants.ts")).toContain('formData.get("back") || !neueId ? sicheresZiel(formData.get("back"), "/tenants") : `/tenants/${neueId}`');
  });
});

describe("Objektformular: Kaufdatum bei den Grundangaben", () => {
  const f = lies("components/PropertyForm.tsx");
  it("vor „Weitere Details“, genau einmal, ohne die entfernte Karte im Hinweis", () => {
    expect(f.match(/name="kaufdatum"/g)?.length).toBe(1);
    expect(f.indexOf('name="kaufdatum"')).toBeLessThan(f.indexOf("setDetailsOffen(true)"));
    expect(ohneKommentare(f)).not.toContain("Portfolio-Karte");
  });
});

describe("Ein Buchungsformular, mit Rücksprung", () => {
  it("die alten Formulare leiten weiter und nehmen Objekt und Rückweg mit", () => {
    for (const [p, typ] of [["app/(app)/kosten/new/page.tsx", "ausgabe"], ["app/(app)/einnahmen/new/page.tsx", "einnahme"]] as const) {
      const s = lies(p);
      expect(s).toContain(`typ: "${typ}"`);
      expect(s).toContain("redirect(`/cashflow/neu?${q.toString()}`)");
      expect(s).toContain('sicheresZiel(searchParams.back, "/cashflow")');
      expect(s).not.toContain("<form");
    }
  });
  it("`back` gilt (nur intern), ohne Angabe eine Ausgabe, Mieten zeigen aufs Mietkonto", () => {
    const n = lies("app/(app)/cashflow/neu/page.tsx");
    expect(n).toContain('const back = sicheresZiel(searchParams.back, "/cashflow");');
    expect(n).toContain('typInitial={searchParams.typ === "einnahme" ? "einnahme" : "ausgabe"}');
    expect(lies("components/BuchungForm.tsx")).toContain('<Link href="/mietkonto">Mietkonto</Link>');
    for (const p of ["app/(app)/properties/[id]/page.tsx", "components/ui/CommandPalette.tsx", "lib/jahresPruefung.ts"]) {
      expect(lies(p), p).not.toMatch(/"\/kosten\/new|"\/einnahmen\/new|`\/kosten\/new|`\/einnahmen\/new/);
    }
  });
  it("„Nachzahlung buchen“ führt zurück zur Abrechnung", () => {
    expect(lies("app/(app)/tenants/[id]/nk/page.tsx")).toContain("back: `/tenants/${params.id}/nk?jahr=${jahr}`,");
  });
});

describe("Fällige wiederkehrende Buchungen fallen auf", () => {
  const heute = new Date(Date.UTC(2026, 9, 21, 12));
  const v = (x: Partial<{ id: string; zyklus: string; start_datum: string; ende_datum: string | null; aktiv: boolean | null }>) =>
    ({ id: "v1", zyklus: "monatlich", start_datum: "2026-08-01", ende_datum: null, aktiv: true, ...x });

  it("zählt offene Termine aktiver Vorlagen; gebuchte und inaktive nicht", () => {
    const gebucht = gebuchtJeVorlage([{ wiederkehr_id: "v1", buchungsdatum: "2026-08-01" }, { wiederkehr_id: null, buchungsdatum: "2026-09-01" }]);
    // August gebucht, September und Oktober offen.
    expect(faelligeAnzahl([v({})], gebucht, heute)).toBe(2);
    expect(faelligeAnzahl([v({ aktiv: false })], gebucht, heute)).toBe(0);
    expect(faelligeAnzahl([v({ aktiv: null })], gebucht, heute)).toBe(0);
    expect(faelligeAnzahl([v({ start_datum: "2026-11-01" })], gebucht, heute)).toBe(0);
    expect(faelligeAnzahl([], gebucht, heute)).toBe(0);
  });
  it("eine Zeile auf dem Dashboard, nie dringend, mit Ziel /cashflow", () => {
    const leer = { offeneMieten: [], anliegen: [], meldungen: [], fristen: [] };
    expect(baueHeuteAufgaben(leer, "2026-10-21", Infinity)).toEqual([]);
    const r = baueHeuteAufgaben({ ...leer, wiederkehrFaellig: 3 }, "2026-10-21", Infinity);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ label: "3 wiederkehrende Buchungen fällig", href: "/cashflow", dringend: false });
    expect(baueHeuteAufgaben({ ...leer, wiederkehrFaellig: 1 }, "2026-10-21", Infinity)[0].label).toBe("1 wiederkehrende Buchung fällig");
  });
  it("/cashflow klappt den Bereich auf, sobald etwas fällig ist", () => {
    const c = lies("app/(app)/cashflow/page.tsx");
    expect(c).toContain("standardOffen={wkFaellig > 0}");
    expect(c).toContain("faelligeAnzahl(wkVorlagen, wkGebucht)");
    expect(lies("app/(app)/page.tsx")).toContain("wiederkehrFaellig: faelligeAnzahl(");
  });
});

describe("Nebenkosten am Objekt: Stand je Mieter und „Nächste Abrechnung“", () => {
  it("die NK-Frist hat dieselbe Bezeichnung und dasselbe Datum wie in lib/fristen.ts", () => {
    const heute = new Date();
    const vorjahr = heute.getFullYear() - 1;
    const f = mieterFristen({ mietbeginn: `${vorjahr - 1}-01-01`, mietende: null, kuendigung: 3, letzte_erhoehung: null })
      .find((x) => x.dokument?.art === "nk");
    expect(f).toBeTruthy();
    expect({ label: f!.label, datum: f!.datum }).toEqual(nkFrist(vorjahr));
  });
  it("Stand aus Archiv und Portal; erledigt nur über den Vermerk", () => {
    const archiv = [{ id: "n1", mieter_id: "m1", titel: "Nebenkostenabrechnung 2025", created_at: "2026-03-01T10:00:00Z" }];
    const leer = new Map();
    expect(nkStand("m1", 2025, [], [], leer).stand).toBe("offen");
    expect(nkStand("m1", 2025, archiv, [], leer).stand).toBe("entwurf");
    expect(nkStand("m1", 2025, archiv, [{ notiz_id: "n1", zugestellt_am: "2026-03-02T00:00:00Z", gelesen_am: null, zurueckgezogen_am: null }], leer).stand).toBe("bereitgestellt");
    expect(nkStand("m2", 2025, archiv, [], leer).stand).toBe("offen");
  });
  it("`reihe` nimmt nur gültige IDs, ohne Doppel", () => {
    const a = "11111111-1111-4111-8111-111111111111";
    const b = "22222222-2222-4222-8222-222222222222";
    expect(naechsteReihe(`${a},${b},${a},x,../evil`)).toEqual([a, b]);
    expect(naechsteReihe(undefined)).toEqual([]);
  });
  it("die Abrechnung des Mieters kennt Nachfolger und Rückweg", () => {
    const n = lies("app/(app)/tenants/[id]/nk/page.tsx");
    expect(n).toContain("reihe.includes(params.id) && naechster ?");
    expect(n).toContain("Nächste Abrechnung →");
    expect(n).toContain("reihe.length > 0 && objektNkHref ? objektNkHref : `/tenants/${params.id}`");
    const o = lies("app/(app)/properties/[id]/nebenkosten/page.tsx");
    expect(o).toContain("href={`/tenants/${m.id}/nk?jahr=${jahr}&reihe=${reihe}`}");
    expect(o).toContain("vorgangText(st)");
  });
});

describe("Kleinere Sackgassen", () => {
  it("Objekt-Check „Ortsübliche Miete“ führt zur Marktwert-Karte, die das Feld hat", () => {
    const p = { id: "p1", typ: "Eigentumswohnung", obj_status: "Vermietet", adresse: "x", kaufpreis: 1, kaufdatum: "2020-01-01", flaeche: 50, baujahr: 1990, vergleichsmiete_m2: null } as unknown as Parameters<typeof objektCheck>[0];
    const mieter = [{ id: "m1", prop_id: "p1", mietbeginn: "2024-01-01", mietende: null }] as unknown as Parameters<typeof objektCheck>[1];
    const r = objektCheck(p, mieter, [], "2026-10-21");
    const punkt = r.punkte.find((x) => x.schluessel === "vergleichsmiete");
    expect(punkt?.href).toBe("/properties/p1#marktwert");
    expect(lies("components/MarktwertCard.tsx")).toContain('id="marktwert"');
    expect(lies("components/MarktwertCard.tsx")).toContain('name="vergleichsmiete_m2"');
  });
  it("Jahresbericht: je Objekt „Prüfen“ mit dem Jahr", () => {
    expect(lies("app/(app)/jahresbericht/page.tsx")).toContain("href={`/properties/${r.id}/jahrespruefung?jahr=${year}`}");
  });
  it("nicht umlegbare Kosten: graues „nein“ statt rotem „nicht“", () => {
    const k = lies("components/lists/KostenListe.tsx");
    expect(k).not.toMatch(/"nicht"/);
    expect(k).toContain('u === "nein" ? "badge-neutral"');
  });
  it("Objektseite: Bearbeiten sichtbar, der Rest unter „Mehr“; CO₂ nur, wo geheizt wird", () => {
    const o = lies("app/(app)/properties/[id]/page.tsx");
    const kopf = o.slice(o.indexOf('<details className="mehr-menue">'), o.indexOf("</details>", o.indexOf('<details className="mehr-menue">')));
    for (const t of ["Verkauf prüfen", "Beleihungsordner", "Jahresprüfung", "deleteProperty"]) expect(kopf, t).toContain(t);
    expect(kopf).not.toContain("/edit");
    expect(o).toContain('const ohneHeizung = istGaragen || p.typ === "Grundstück";');
    expect(o).toMatch(/\{!ohneHeizung && \(\s*<div id="co2"/);
    expect(o).toContain('...(ohneHeizung ? [] : [{ id: "co2", label: "CO₂" }])');
  });
  it("keine Kopfzeile über dem Titel in MyImmo — BuyImmo-Schritte und das Datum bleiben", () => {
    for (const p of ["app/(app)/cashflow/page.tsx", "app/(app)/properties/page.tsx", "app/(app)/kredite/page.tsx", "app/(app)/tenants/page.tsx", "app/(app)/termine/page.tsx", "components/MietkontoBestaetigung.tsx", "components/SettingsView.tsx"]) {
      expect(lies(p), p).not.toContain("topbar-kicker");
    }
    expect(lies("app/(app)/vergleich/page.tsx")).toContain("BuyImmo · Schritt 1");
    expect(lies("app/(app)/page.tsx")).toContain('<div className="topbar-kicker">Portfolio · {monatJahr}</div>');
  });
});
