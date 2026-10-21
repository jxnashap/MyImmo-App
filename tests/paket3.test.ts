// Paket 3 der Durchsicht 21.10.2026 — „Mieterportal verständlich“.
//
// Was hier festgehalten wird: Ein Mieter findet „Schaden melden“ auf der Startseite, liest nach dem
// Absenden, wie es weitergeht, sieht auf zwei Reitern DIESELBE Miete, liest keine Paragrafen und
// keine Buchhalterwörter, und der Verlauf schreibt Termine so, wie Menschen sie lesen.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { gesendetText, mitNeu, neuesAnliegen } from "@/lib/anliegenListe";
import { baueMeldung, kategorie, kurzTitel, textPflicht, KURZTITEL_MAX } from "@/lib/schadensmeldung";
import { ereignisText, terminLesbar, vorgangStand, KUEMMERT_SICH, type Ereignis } from "@/lib/vorgang";
import { GELESEN_HINWEIS } from "@/lib/mieterAufgaben";
import { einladungsMail } from "@/lib/mieterZugang";
import { ladePortalDaten } from "@/lib/portalDaten";
import { heuteBerlin } from "@/lib/zeitraum";
import { ymPlus } from "@/lib/mietkonto";

const lies = (p: string) => readFileSync(p, "utf8");
const ansicht = lies("components/PortalAnsicht.tsx");

// Kommentare ausblenden — sonst prüft ein Textmuster die Begründung statt des Codes.
const ohneKommentare = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("Startseite: melden zuerst, Notfall ruhig", () => {
  const wohnung = ohneKommentare(ansicht.slice(ansicht.indexOf("wohnung: ("), ansicht.indexOf("anliegen: (")));

  it("„Schaden melden“ und „Frage stellen“ stehen im ersten Reiter und öffnen das passende Formular", () => {
    expect(wohnung).toContain('mitNeu(hrefFuer("anliegen"), "schaden")');
    expect(wohnung).toContain('mitNeu(hrefFuer("anliegen"), "frage")');
    // VOR „Zu erledigen“ — sonst stehen sie wieder unter allem anderen.
    expect(wohnung.indexOf('"schaden"')).toBeLessThan(wohnung.indexOf("<MieterAufgabenListe"));
  });

  it("der rote Kasten steht nur noch im Anliegen-Reiter; auf der Startseite eine Zeile mit der 112", () => {
    expect(wohnung).not.toContain("<NotfallKasten");
    expect(wohnung).toContain("<NotfallZeile");
    expect(ansicht.match(/<NotfallKasten notdienste=\{notdienste\} \/>/g)?.length).toBe(1);
    const zeile = lies("components/NotfallHinweis.tsx");
    const nf = zeile.slice(zeile.indexOf("export function NotfallZeile"), zeile.indexOf("export function NotfallSofort"));
    expect(nf).toContain('href="tel:112"');
    // Regel: In Notfall-Texten nie eine andere Telefonnummer als 112.
    expect(nf.match(/tel:(\d+)/g)).toEqual(["tel:112"]);
    expect(nf).not.toContain("var(--red)");
  });

  it("die Adresse trägt `neu` nur mit bekannten Werten", () => {
    expect(mitNeu("/portal?tab=anliegen", "schaden")).toBe("/portal?tab=anliegen&neu=schaden");
    expect(mitNeu("/x", "frage")).toBe("/x?neu=frage");
    expect(neuesAnliegen("schaden")).toBe("schaden");
    expect(neuesAnliegen("frage")).toBe("frage");
    expect(neuesAnliegen("dokument")).toBeNull();
    expect(neuesAnliegen(undefined)).toBeNull();
    expect(lies("app/(app)/portal/page.tsx")).toContain("neu={neuesAnliegen(searchParams.neu)}");
    const ap = lies("components/AnliegenPortal.tsx");
    expect(ap).toContain('useState(neu === "schaden" && !nurLesen)');
    expect(ap).toContain('useState(neu === "frage" && !nurLesen)');
  });
});

describe("Nach dem Absenden", () => {
  it("ein Satz für alle drei Wege; die Mail wird nur versprochen, wenn sie kommt", () => {
    expect(gesendetText(true)).toContain("E-Mail");
    expect(gesendetText(false)).not.toContain("E-Mail");
    for (const t of [gesendetText(true), gesendetText(false)]) expect(t).toContain("dein Vermieter bekommt Bescheid");
    const ap = lies("components/AnliegenPortal.tsx");
    expect(ap).toContain("{gesendetText(mailHinweis)}");
    // Das Frage-Formular schloss sich vorher wortlos.
    const senden = ap.slice(ap.indexOf("const senden"), ap.indexOf("const dateienVon"));
    expect(senden).toContain("setGemeldet(true)");
    expect(lies("components/DokumenteAnfrage.tsx")).toContain("gesendetText(mailHinweis)");
  });

  it("`mailHinweis` folgt dem Versand UND der Abbestellung — dieselbe Abfrage wie sendeHinweis", () => {
    const seite = lies("app/(app)/portal/page.tsx");
    expect(seite).toContain("brevoBereit() && user?.user_metadata?.benachrichtigungen_aus !== true");
    expect(lies("lib/benachrichtigung.ts")).toContain("user.user_metadata?.benachrichtigungen_aus === true");
  });

  it("die Dokument-Anfrage fängt Netzfehler ab und doppelt den Verlauf nicht mehr", () => {
    const d = lies("components/DokumenteAnfrage.tsx");
    expect(d).toMatch(/try \{\s*const r = await erstelleAnliegen\(fd\);/);
    expect(d).not.toContain("<VorgangVerlauf");
    expect(d).toContain("mitVorgang(anliegenHref, a.id)");
  });

  it("die Frage hat keine Auswahl „Art“ und kein Schaden-Beispiel mehr", () => {
    const ap = lies("components/AnliegenPortal.tsx");
    expect(ap).toContain('<input type="hidden" name="typ" value="frage" />');
    expect(ap).not.toContain('<select name="typ"');
    expect(ap).not.toContain("Heizung im Bad wird nicht warm");
  });
});

describe("„Etwas anderes“: ohne Text keine Meldung", () => {
  const sonst = kategorie("sonstiges")!;
  const gas = kategorie("gas")!;

  it("Pflicht nur ohne Rückfragen und ohne Notfall", () => {
    expect(textPflicht(sonst)).toBe(true);
    expect(textPflicht(gas)).toBe(false);
    expect(textPflicht(kategorie("heizung")!)).toBe(false);
  });

  it("der eigene Text wird zum Titel — vorher kam nur „Etwas anderes“ an", () => {
    const m = baueMeldung(sonst, {}, { text: "Briefkasten klemmt\nseit gestern", raum: "Flur" });
    expect(m.titel).toBe("Briefkasten klemmt · (Flur)");
    expect(m.beschreibung).toContain("seit gestern");
    // Ohne Text bleibt der alte Titel (die Oberfläche sperrt dann den Knopf).
    expect(baueMeldung(sonst, {}, {}).titel).toBe("Etwas anderes");
    // Andere Kategorien unverändert.
    expect(baueMeldung(kategorie("heizung")!, {}, { text: "egal" }).titel.startsWith("Heizung")).toBe(true);
  });

  it("kurzTitel: erste Zeile, höchstens 60 Zeichen, am Wortende", () => {
    const lang = "Die Klingel an der Haustür funktioniert seit dem Gewitter nicht mehr richtig und brummt";
    const k = kurzTitel(lang);
    expect(k.length).toBeLessThanOrEqual(KURZTITEL_MAX);
    expect(k.endsWith("…")).toBe(true);
    expect(lang.startsWith(k.slice(0, -1))).toBe(true);
    expect(k.slice(0, -1).endsWith(" ")).toBe(false);
    expect(kurzTitel("  kurz  \nzweite")).toBe("kurz");
  });

  it("der Assistent sperrt das Senden ohne Text", () => {
    const a = lies("components/SchadenAssistent.tsx");
    expect(a).toContain("disabled={pending || anhaenge.bereitet || textFehlt}");
    expect(a).toContain("if (!k || !meldung || textFehlt) return;");
  });
});

describe("Verlauf: Termine lesbar, interne Abstimmungen neutral", () => {
  const ev = (x: Partial<Ereignis>): Ereignis => ({
    id: "e", anliegen_id: "a", autor_rolle: "system", art: "termin", text: null, status_neu: null,
    zustaendig: null, created_at: "2026-10-01T10:00:00Z", ...x,
  } as Ereignis);

  it("„2026-10-22 14:30“ → „Do., 22.10.2026, 14:30 Uhr“, auch mit T, Sekunden und mehreren Zeiten", () => {
    expect(terminLesbar("Termin bestätigt: 2026-10-22 14:30")).toBe("Termin bestätigt: Do., 22.10.2026, 14:30 Uhr");
    expect(terminLesbar("Terminvorschläge: 2026-10-22T14:30 · 2026-10-25 09:05:00"))
      .toBe("Terminvorschläge: Do., 22.10.2026, 14:30 Uhr · So., 25.10.2026, 09:05 Uhr");
    expect(terminLesbar("ohne Zeit")).toBe("ohne Zeit");
  });

  it("der Wochentag hängt nicht an der Zeitzone des Rechners", () => {
    // 01.03.2026 ist ein Sonntag; westlich von UTC rutschte ein `new Date("2026-03-01")` in den Samstag.
    expect(terminLesbar("2026-03-01 00:30")).toBe("So., 01.03.2026, 00:30 Uhr");
  });

  it("ereignisText formatiert Termine; beim Mieter wird „nicht freigegeben“ zu „kümmert sich“", () => {
    expect(ereignisText(ev({ text: "Termin bestätigt: 2026-10-22 14:30" }))).toContain("Do., 22.10.2026");
    const intern = ev({ art: "auftrag", text: "Der Auftrag wurde nicht freigegeben.", status_neu: "nicht_freigegeben" });
    expect(ereignisText(intern, "mieter")).toBe(KUEMMERT_SICH);
    expect(ereignisText(intern, "vermieter")).toBe("Der Auftrag wurde nicht freigegeben.");
    expect(ereignisText(ev({ art: "auftrag", text: "Wartet", status_neu: "freigabe" }), "mieter")).toBe(KUEMMERT_SICH);
    // Eine echte Nachricht bleibt, wie sie ist — auch wenn darin ein Datum steht.
    expect(ereignisText(ev({ art: "nachricht", text: "Am 2026-10-22 14:30 passt" }), "mieter")).toBe("Am 2026-10-22 14:30 passt");
  });

  it("der Stand für den Mieter verschweigt Freigabe-Abstimmungen, der Vermieter sieht sie", () => {
    const freigabe = [ev({ art: "auftrag", status_neu: "freigabe", zustaendig: "hausmeister" })];
    expect(vorgangStand(freigabe, "in_arbeit").auftrag).toBe("wartet auf Freigabe des Vermieters");
    expect(vorgangStand(freigabe, "in_arbeit").auftragFuerMieter).toBeNull();
    expect(vorgangStand([ev({ art: "auftrag", status_neu: "angenommen", zustaendig: "handwerker" })], "in_arbeit").auftragFuerMieter).toBe("angenommen");
    const v = lies("components/VorgangVerlauf.tsx");
    expect(v).toContain('sicht === "mieter" ? stand.auftragFuerMieter : stand.auftrag');
    expect(v).toContain("ereignisText(e, sicht)");
  });
});

describe("Zahlungen und Dokumente in Mieter-Sprache", () => {
  it("keine Paragrafen in der Mieter-Oberfläche (Portal, Dokument-Anfrage, Mietkonto)", () => {
    for (const p of ["components/PortalAnsicht.tsx", "components/DokumenteAnfrage.tsx", "components/MieterKontoTabelle.tsx"]) {
      expect(ohneKommentare(lies(p)), p).not.toMatch(/§/);
    }
  });

  it("„Miete“ statt „Soll“, „Nebenkosten (Vorauszahlung)“ statt „NK-Vorauszahlung“, „bereitgestellt“ statt „zugestellt“", () => {
    const k = ohneKommentare(lies("components/MieterKontoTabelle.tsx"));
    expect(k).toContain(">Miete</th>");
    expect(k).not.toContain(">Soll</th>");
    const a = ohneKommentare(ansicht);
    expect(a).toContain("Nebenkosten (Vorauszahlung)");
    expect(a).not.toContain("NK-Vorauszahlung");
    expect(a).not.toContain("Belegeinsicht");
    expect(a).not.toMatch(/Dokumente zugestellt/);
  });

  it("die Einzelzahlungen sind eingeklappt — sie stehen schon im Mietkonto", () => {
    expect(ansicht).toContain("Einzelne Zahlungen ({zahlungen.length})");
    expect(ansicht).toMatch(/<details className="section">\s*<summary className="section-header"/);
    expect(ansicht).not.toContain("Zahlungsübersicht");
  });

  it("die Stellplatzmiete steht da, wenn sie in der Warmmiete steckt", () => {
    expect(ansicht).toContain('"Warmmiete inkl. Stellplatz"');
    expect(ansicht).toContain("`${euro(m.stellplatz_miete)} im Monat`");
  });

  it("„gelesen und bestätigt“ sagt sichtbar, dass es keine Zustimmung ist — Knopf und Aufgabe", () => {
    expect(GELESEN_HINWEIS).toContain("stimmst dem Inhalt damit nicht zu");
    expect(lies("components/ZustellungBestaetigen.tsx")).toContain("{GELESEN_HINWEIS}");
    expect(lies("lib/mieterAufgaben.ts").match(/\$\{GELESEN_HINWEIS\}/g)?.length).toBe(2);
    expect(ansicht).toContain("Dein Vermieter sieht, wann du ein Dokument zum ersten Mal geöffnet hast.");
  });
});

describe("Wohnung und Mietkonto zeigen DIESELBE Miete (Staffel, § 560)", () => {
  // Attrappe wie in tests/portalVorschau.test.ts, mit Antworten je Tabelle.
  function fakeDb(antworten: Record<string, unknown>) {
    const from = (tabelle: string) => {
      const k: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "order", "limit", "is"]) k[m] = () => k;
      const antwort = () => ({ data: antworten[tabelle] ?? null, error: null });
      k.range = () => {
        const d = antworten[tabelle];
        return Promise.resolve({ data: Array.isArray(d) ? d : d == null ? [] : [d], error: null });
      };
      k.maybeSingle = async () => antwort();
      k.then = (f: (w: unknown) => unknown) => Promise.resolve(antwort()).then(f);
      return k;
    };
    return { from };
  }

  it("die Kacheln nehmen den Zeitraum, der heute gilt; frühere Monate behalten den alten Betrag", async () => {
    const heuteYm = heuteBerlin().slice(0, 7);
    const ab = ymPlus(heuteYm, -1);
    const db = fakeDb({
      mieter: { id: "m1", prop_id: "o1", vorname: "A", nachname: "B", mietbeginn: "2024-01-01", kaltmiete: 900, nk_vorauszahlung: 170, stellplatz_miete: null },
      properties: { id: "o1", bezeichnung: "Altbau", adresse: null },
      mieter_zugaenge: null,
      einnahmen: [],
      miet_zeitraeume: [{ mieter_id: "m1", von: `${ab}-01`, bis: null, kaltmiete: 950, nk_vorauszahlung: 180, stellplatz_miete: null }],
    });
    const d = await ladePortalDaten(db, { art: "vermieter", vermieterId: "v1", mieterId: "m1" });
    expect(d.wohnungen[0].m.kaltmiete).toBe(950);
    expect(d.wohnungen[0].m.nk_vorauszahlung).toBe(180);
    const konto = d.konto.m1;
    expect(konto.find((k) => k.jahrMonat === heuteYm)?.soll).toBe(1130);
    // Vor der Erhöhung: der alte Vertragswert — ersetzt wird erst NACH dem Mietkonto.
    expect(konto.find((k) => k.jahrMonat === ymPlus(heuteYm, -3))?.soll).toBe(1070);
  });
});

describe("Einladungsmail nennt die gebundene Adresse", () => {
  it("in Text und HTML, maskiert", () => {
    const m = einladungsMail({ vermieter: "Max", link: "https://x", code: "MI-1", gueltigBis: "2026-11-16T10:00:00Z", email: "a<b>@c.de" });
    expect(m.text).toContain("(a<b>@c.de)");
    expect(m.html).toContain("(a&lt;b&gt;@c.de)");
    expect(m.html).not.toContain("a<b>@c.de");
    expect(lies("lib/actions/einladung.ts")).toContain("email: adresse.email,");
  });
});
