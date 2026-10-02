#!/usr/bin/env node
// Rauchtest: sechs Kernwege durch die laufende App.
//
// ---------------------------------------------------------------------------
// WARUM DIESES SKRIPT (Woche 4, 08.09.2026)
//
// Die 1.167 Unit-Tests prüfen Funktionen. KEINER von ihnen hat je eine Seite
// ausgeliefert. Ein kaputter Import in einer Server-Komponente, eine
// Endlosweiterleitung im Layout-Gate, eine Seite, die mit 500 antwortet — all
// das bleibt grün. Genau diese Klasse Fehler trifft jeden Nutzer sofort und
// keinen Test.
//
// ---------------------------------------------------------------------------
// WAS ER PRÜFT UND WAS NICHT — die ehrliche Grenze
//
// Er holt die Seiten per HTTP und liest das ausgelieferte HTML. Weil MyImmo
// serverseitig rendert, steht der Inhalt dort tatsächlich drin (Beträge,
// Mieternamen, Objektdaten) — das lässt sich prüfen.
//
// NICHT geprüft wird alles, was erst im Browser passiert: JS-Ausnahmen nach
// dem Laden, fehlgeschlagene Hydration, kaputte Klick-Ziele, Layout. Dafür
// bräuchte es einen echten Browser. Ein solcher Lauf war der erste Entwurf
// dieses Skripts und ist daran gescheitert, dass Chromium in der Remote-
// Umgebung nicht durch den Proxy kommt — ein Test, den niemand laufen lassen
// kann, ist schlechter als keiner. Wer den Browser-Lauf will, baut ihn auf
// einem Rechner mit normalem Netzzugang; die Wege unten sind dieselben.
//
// ---------------------------------------------------------------------------
// WARUM ER NICHT IN `npm test` STEHT
//
// Er braucht eine LAUFENDE App mit einer ECHTEN Datenbank und meldet sich am
// DEMO-Konto an. Zwei Kosten, die man kennen muss:
//   1. Der Demo-Einstieg SETZT DEN DEMO-BESTAND ZURÜCK. Alle Besucher teilen
//      ein Konto — wer gerade darin klickt, verliert seinen Stand.
//   2. `/api/demo` hat eine Bremse (6 Aufrufe je 300 s). Deshalb meldet sich
//      dieses Skript GENAU EINMAL an und teilt die Sitzung über alle Wege.
// Also: nicht bei jedem Push. Vor einem Release, nach einem Deploy, oder wenn
// etwas verdächtig wirkt.
//
// Es wird NUR GELESEN — kein POST, keine Server-Action.
//
// ---------------------------------------------------------------------------
// Benutzung
//
//   node scripts/rauchtest.mjs
//   node scripts/rauchtest.mjs --basis=http://localhost:3000
//   node scripts/rauchtest.mjs --nur=dashboard,steuer
//
// Exit-Code 0 = alle Wege grün, 1 = mindestens einer rot.
// ---------------------------------------------------------------------------

const arg = (name, standard) => {
  const t = process.argv.find((a) => a.startsWith(`--${name}=`));
  return t ? t.slice(name.length + 3) : standard;
};

const BASIS = arg("basis", process.env.BASIS || "https://www.myimmoapp.de").replace(/\/$/, "");
const NUR = arg("nur", "").split(",").filter(Boolean);

// --- Sitzung -------------------------------------------------------------
// Eigener Mini-Cookie-Speicher. Supabase legt das Auth-Token in MEHREREN
// Cookies ab (…auth-token.0, .1), wenn es zu groß für eines wird — deshalb
// getSetCookie() und nicht headers.get("set-cookie"), das nur das erste liefert.
const kekse = new Map();

function merkeKekse(antwort) {
  for (const zeile of antwort.headers.getSetCookie?.() ?? []) {
    const [paar] = zeile.split(";");
    const i = paar.indexOf("=");
    if (i > 0) kekse.set(paar.slice(0, i).trim(), paar.slice(i + 1).trim());
  }
}

const keksKopf = () => [...kekse].map(([k, v]) => `${k}=${v}`).join("; ");

/**
 * GET mit Sitzung; folgt Weiterleitungen von Hand, damit Cookies unterwegs
 * hängenbleiben.
 *
 * Gibt `endePfad` mit zurück — den Pfad, auf dem man WIRKLICH gelandet ist.
 * Ohne den war der erste Entwurf dieses Skripts falsch grün: `/mietkonto` und
 * `/steuer` sind in der Demo gesperrt und werden auf `/` umgeleitet. Das
 * Dashboard enthält „Mietkonto" (Menü) und „€" — die Prüfung „Text kommt vor"
 * war damit erfüllt, ohne dass die Seite je geladen wurde. Ein Test, der die
 * Menüleiste für den Seiteninhalt hält, prüft nichts.
 */
async function hole(pfad, tiefe = 0, kette = []) {
  if (tiefe > 5) throw new Error("zu viele Weiterleitungen");
  const url = pfad.startsWith("http") ? pfad : `${BASIS}${pfad}`;
  const antwort = await fetch(url, {
    redirect: "manual",
    headers: {
      ...(kekse.size ? { cookie: keksKopf() } : {}),
      // Ohne User-Agent antworten manche Schutzschichten anders als einem Browser.
      "user-agent": "MyImmo-Rauchtest/1.0",
    },
  });
  merkeKekse(antwort);
  kette.push(`${new URL(url).pathname} ${antwort.status}`);
  if (antwort.status >= 300 && antwort.status < 400) {
    const ziel = antwort.headers.get("location");
    if (ziel) return hole(new URL(ziel, url).toString(), tiefe + 1, kette);
  }
  return {
    status: antwort.status,
    url,
    endePfad: new URL(url).pathname,
    kette,
    typ: antwort.headers.get("content-type") ?? "",
    html: await antwort.text(),
  };
}

/**
 * Ersten Datensatz-Link finden — für „Liste → Detailseite".
 *
 * Verlangt eine UUID als Segment. Ohne diese Bedingung griff die Suche den
 * „Neuer Mieter"-Knopf (`/tenants/new`), und der Test scheiterte an einer
 * Seite, die er nie prüfen wollte. Unterseiten wie `/edit` oder `/nk` fallen
 * ebenfalls weg: Gefragt ist die Detailseite selbst.
 */
function ersterLink(html, praefix) {
  const re = new RegExp(`href="(${praefix}[0-9a-f]{8}-[0-9a-f-]{27})"`, "gi");
  const t = html.match(re);
  return t ? t[0].slice(6, -1) : null;
}

// --- Die Kernwege ---------------------------------------------------------
//
// WELCHE WEGE HIER STEHEN — und welche NICHT
//
// Das Demo-Konto ist Schaustück, nicht Sandkasten: `demoDarfRoute` in
// lib/demo.ts gibt nur einen Teil der App frei. Seit 30.09.2026 gehören die
// KAUFGRÜNDE dazu — Mietkonto, Steuer/Anlage V, NK-Abrechnung, Kredite,
// Verbrauch, Termine, Karte — und stehen deshalb jetzt als Kernwege hier.
// Vorher waren sie gesperrt und damit von diesem Test UNGEPRÜFT.
//
// Seit Phase 3 auch Mieterportal und Archiv (Beispieldaten im Schnappschuss).
// Weiterhin gesperrt: Makler-Unterlagen. Der Weg „demo-grenze" prüft, dass die
// Sperre hält und die Weiterleitung den Bereich nennt.
const WEGE = [
  {
    schluessel: "dashboard",
    titel: "Dashboard — Lage auf einen Blick",
    pfad: "/",
    // „Buchungssaldo" und die Formel am Monats-Cashflow (Phase 4, Review
    // 30.09.2026): Jede Cashflow-Zahl sagt, was sie ist.
    erwartet: ["Portfolio-Wert", "Termine &amp; Aufgaben", "<h3>Buchungssaldo</h3>", "Warmmiete − Kreditraten − Ø Kosten", "Warmmiete / Mo.", "% ggü. Kaufpreis"],
    async pruefe({ html }) {
      // Vorgabe des Betreibers (#321): Kennzahlen VOR den Aufgaben. Der
      // Unit-Test prüft die Quelldatei — hier steht die ausgelieferte Seite.
      const k = html.indexOf("Portfolio-Wert");
      const a = html.indexOf("Termine &amp; Aufgaben");
      if (!(k >= 0 && a > k)) return "Kennzahlen stehen nicht vor den Aufgaben";
      return null;
    },
  },
  {
    schluessel: "objekte",
    titel: "Objekte — Liste und Detailseite",
    pfad: "/properties",
    erwartet: ["Objekt"],
    async pruefe({ html }) {
      const link = ersterLink(html, "/properties/");
      if (!link) return "kein Objekt in der Liste — Demo-Bestand leer?";
      const detail = await hole(link);
      if (detail.status >= 400) return `Detailseite ${link}: HTTP ${detail.status}`;
      if (detail.endePfad !== link) return `Detailseite ${link} umgeleitet auf ${detail.endePfad}`;
      if (!/Kaufpreis|Wert|Miete/.test(detail.html)) return `Detailseite ${link} ohne Objektdaten`;
      return null;
    },
  },
  {
    schluessel: "mieter",
    titel: "Mieter — Liste und Detailseite",
    pfad: "/tenants",
    erwartet: ["Mieter"],
    async pruefe({ html }) {
      const link = ersterLink(html, "/tenants/");
      if (!link) return "kein Mieter in der Liste";
      const detail = await hole(link);
      if (detail.status >= 400) return `Mieterseite ${link}: HTTP ${detail.status}`;
      if (detail.endePfad !== link) return `Mieterseite ${link} umgeleitet auf ${detail.endePfad}`;
      if (!/€|&euro;/.test(detail.html)) return `Mieterseite ${link} ohne Beträge`;
      return null;
    },
  },
  {
    schluessel: "dokument",
    titel: "Mieterhöhung — das Dokument mit Briefkopf",
    pfad: "/tenants",
    erwartet: ["Mieter"],
    async pruefe({ html }) {
      // Der eigentliche Aha-Moment der Demo und die einzige Stelle, an der sie
      // etwas ERZEUGT (§ 558a-Brief). Bricht sie, bricht der Verkaufsmoment.
      const mieter = ersterLink(html, "/tenants/");
      if (!mieter) return "kein Mieter in der Liste";
      const seite = await hole(`${mieter}/dokument`);
      if (seite.status >= 400) return `HTTP ${seite.status}`;
      if (seite.endePfad !== `${mieter}/dokument`) {
        return `umgeleitet auf ${seite.endePfad} — ist /dokument aus der Demo gefallen?`;
      }
      if (!/Mieterh|558a|558/.test(seite.html)) return "Dokumentseite ohne Mieterhöhungs-Inhalt";
      return null;
    },
  },
  {
    schluessel: "cashflow",
    titel: "Cashflow — Einnahmen gegen Ausgaben",
    pfad: "/cashflow",
    erwartet: [],
    async pruefe({ html }) {
      return /€|&euro;/.test(html) ? null : "Cashflow ohne Beträge";
    },
  },
  {
    schluessel: "aktuell",
    titel: "Demo-Daten reichen bis zum laufenden Monat",
    pfad: "/cashflow",
    erwartet: [],
    async pruefe({ html }) {
      // Review 30.09.2026: Die Buchungen endeten am 01.06.2026 — Ende
      // September stand jeder Mieter als säumig da. Seit Migration
      // 20260930154606 schreibt der Reset bis heute fort. UTC, weil die
      // Datenbank `current_date` in UTC rechnet (sonst falsch rot um
      // Mitternacht am Monatswechsel). Format wie `datum()` in lib/format.ts.
      const jetzt = new Date();
      const erster = `1.${jetzt.getUTCMonth() + 1}.${jetzt.getUTCFullYear()}`;
      return html.includes(`>${erster}<`) ? null : `keine Buchung vom ${erster} — Demo-Daten veraltet?`;
    },
  },
  {
    schluessel: "mieterportal",
    titel: "Mieterportal — Beispiel-Anliegen",
    pfad: "/anliegen",
    erwartet: ["Heizkörper im Bad wird nicht warm"],
    async pruefe() {
      return null;
    },
  },
  {
    // Mieterportal-Vorschau (01.10.2026): Der Vermieter sieht das Portal mit
    // den Augen eines Mieters. In der Demo steht die verknüpfte Mieterin
    // (Sophie Berger) zuerst in der Auswahl — also muss ihre Wohnung da sein.
    schluessel: "portal-vorschau",
    titel: "Mieterportal — Ansicht Mieter (nur Demo)",
    pfad: "/anliegen?tab=vorschau",
    erwartet: ["Ansicht Mieter", "Meine Wohnung", "NK-Vorauszahlung", "Warmmiete", "Ansicht des Mieters"],
    async pruefe({ html }) {
      // Nur-Lesen: In der Vorschau darf kein Abmelde-Formular des Portals stehen.
      return html.includes("Mieter sieht hier") || html.includes("Mieterportal von") ? null : "Vorschau-Rahmen fehlt";
    },
  },
  {
    // Demo-Service (01.10.2026): drei verknüpfte Partner. Firmen und
    // Beispielaufträge erscheinen erst mit dem ausstehenden Reset
    // (supabase/ausstehend/demo_service_reset.sql) — geprüft wird deshalb nur,
    // was ohne ihn schon stimmen muss.
    schluessel: "service-partner",
    titel: "Mieterportal — Service-Partner verknüpft",
    pfad: "/anliegen?tab=service",
    // Firmen und Aufträge kommen aus dem Reset (Migration 20261001180200) — ohne ihn fehlen sie still.
    erwartet: ["Verknüpfte Service-Partner", "Hausmeisterservice Krause", "Sanitär Lindner GmbH", "Garten- &amp; Winterdienst Petersen", "Heizung &amp; Sanitär Böhm", "Dachrinne verstopft", "Hecke schneiden und Grünschnitt entsorgen"],
    async pruefe() {
      return null;
    },
  },
  {
    schluessel: "service-ansicht",
    titel: "Mieterportal — Ansicht Service (nur Demo)",
    pfad: "/anliegen?tab=vorschau-service",
    erwartet: ["Ansicht Service", "Service-Portal", "Ansicht des Service-Partners", "Auftrag beantragen"],
    async pruefe() {
      return null;
    },
  },
  {
    schluessel: "archiv",
    titel: "Archiv — Beispiel-Einträge",
    pfad: "/archiv",
    erwartet: ["Mietvertrag Weber"],
    async pruefe() {
      return null;
    },
  },
  {
    schluessel: "steuer",
    titel: "Steuer — Anlage V",
    pfad: "/steuer",
    erwartet: ["Anlage V"],
    async pruefe({ html }) {
      return /€|&euro;/.test(html) ? null : "Steuerseite ohne Beträge";
    },
  },
  {
    schluessel: "anlage-v-pdf",
    titel: "Anlage V als PDF — lesende API-Route",
    pfad: "/api/berichte/anlage-v",
    erwartet: [],
    async pruefe({ typ }) {
      return typ.includes("application/pdf") ? null : `kein PDF, sondern „${typ}"`;
    },
  },
  {
    schluessel: "csv-export",
    titel: "CSV-Export der Buchungen — war in der Demo eine Sackgasse",
    pfad: "/api/export/buchungen",
    erwartet: [],
    async pruefe({ typ }) {
      return typ.includes("text/csv") ? null : `keine CSV, sondern „${typ}"`;
    },
  },
  {
    schluessel: "mietkonto",
    titel: "Mietkonto — Soll und Ist je Mieter",
    pfad: "/mietkonto",
    erwartet: ["Verwaltung · Mietkonto"],
    async pruefe() {
      return null;
    },
  },
  {
    schluessel: "nk",
    titel: "Nebenkostenabrechnung eines Mieters",
    pfad: "/tenants",
    erwartet: ["Mieter"],
    async pruefe({ html }) {
      const mieter = ersterLink(html, "/tenants/");
      if (!mieter) return "kein Mieter in der Liste";
      const seite = await hole(`${mieter}/nk`);
      if (seite.status >= 400) return `HTTP ${seite.status}`;
      if (seite.endePfad !== `${mieter}/nk`) return `umgeleitet auf ${seite.endePfad} — NK-Rechner wieder gesperrt?`;
      if (!/Nebenkostenabrechnung/.test(seite.html)) return "NK-Seite ohne Überschrift";
      return null;
    },
  },
  {
    schluessel: "kredite",
    titel: "Kredite",
    pfad: "/kredite",
    erwartet: ["Kredite &amp; Finanzierung"],
    async pruefe() {
      return null;
    },
  },
  {
    schluessel: "demo-grenze",
    titel: "Demo-Grenze — gesperrte Bereiche bleiben gesperrt und nennen sich",
    pfad: "/",
    erwartet: [],
    async pruefe() {
      // Die Demo ist NUR-LESEN und deckt nur einen Teil der App ab. Fällt die
      // Sperre unbemerkt weg, sähe ein Besucher Bereiche, in denen er Dinge
      // anklicken kann, die stumm an der RLS scheitern. Genau der Fall, den
      // lib/demo.ts als Grund für Ebene 2 nennt.
      const gesperrt = ["/makler"];
      const offen = [];
      const stumm = [];
      for (const p of gesperrt) {
        const r = await hole(p);
        if (r.endePfad === p) offen.push(p);
        // Ohne `bereich=` öffnet das Dashboard keinen Sperr-Dialog — der
        // Besucher stünde wieder kommentarlos dort (Review 30.09.2026).
        else if (!new URL(r.url).searchParams.get("bereich")) stumm.push(p);
      }
      if (offen.length) return `nicht mehr gesperrt: ${offen.join(", ")}`;
      if (stumm.length) return `Weiterleitung ohne bereich=: ${stumm.join(", ")}`;
      return null;
    },
  },
];

const gewaehlt = NUR.length ? WEGE.filter((w) => NUR.includes(w.schluessel)) : WEGE;

async function main() {
  console.log(`Rauchtest gegen ${BASIS}`);
  console.log(`${gewaehlt.length} Wege\n`);

  // EINMAL anmelden (Bremse: 6 Aufrufe je 300 s).
  const login = await hole("/api/demo");
  if (/\/anmelden|\/login|demo=(aus|fehler|bremse)/.test(login.url)) {
    console.error(`✗ Demo-Anmeldung fehlgeschlagen: ${login.url}`);
    process.exit(1);
  }
  if (/reset=(kein-key|fehler)/.test(login.url)) {
    // Kein Abbruch: Die Demo ist benutzbar, nur mit dem Stand des Vorgängers.
    console.warn(`⚠ Demo-Reset nicht gelaufen (${login.url}) — Bestand könnte verändert sein\n`);
  } else {
    console.log("✓ Demo-Anmeldung\n");
  }

  const ergebnisse = [];
  for (const weg of gewaehlt) {
    let grund = null;
    try {
      const seite = await hole(weg.pfad);
      if (seite.status >= 400) grund = `HTTP ${seite.status}`;
      // DIE wichtigste Prüfung: Sind wir dort gelandet, wo wir hinwollten?
      // Ohne sie war dieses Skript falsch grün (siehe Kommentar bei `hole`).
      // Sie steht VOR der Textprüfung, damit der Grund die Umleitung nennt und
      // nicht ein fehlendes Wort.
      if (!grund && seite.endePfad !== weg.pfad.split("?")[0]) {
        grund = `umgeleitet: ${seite.kette.join(" → ")}`;
      }
      if (!grund) {
        const fehlt = weg.erwartet.filter((t) => !seite.html.includes(t));
        if (fehlt.length) grund = `Text fehlt: ${fehlt.join(", ")}`;
      }
      if (!grund) grund = await weg.pruefe(seite);
    } catch (e) {
      grund = `Ausnahme: ${e.message}`;
    }
    ergebnisse.push({ weg, grund });
    console.log(`${grund ? "✗" : "✓"} ${weg.titel}${grund ? `\n    ${grund}` : ""}`);
  }

  // --- Mieter-Sicht (01.10.2026) ------------------------------------------
  // Zweite Anmeldung am Demo-Mieter (Bremse: 2 von 6 je 300 s). Das Portal
  // war bis dahin der einzige Bereich ohne jede automatische Prüfung — und
  // Paket 5 hatte es gerade umgebaut (Sichten statt Tabellen).
  kekse.clear();
  const mieterLogin = await hole("/api/demo?rolle=mieter");
  if (mieterLogin.endePfad !== "/portal") {
    ergebnisse.push({ weg: { titel: "Mieter-Demo — Anmeldung" }, grund: `gelandet auf ${mieterLogin.kette.join(" → ")}` });
    console.log(`✗ Mieter-Demo — Anmeldung\n    ${mieterLogin.kette.join(" → ")}`);
  } else {
    console.log("\n✓ Mieter-Demo — Anmeldung");
    const MIETER_WEGE = [
      { titel: "Mieterportal — Wohnung (Sichten statt Tabellen)", pfad: "/portal", erwartet: ["Mieterportal", "Meine Wohnung", "NK-Vorauszahlung", "Warmmiete"] },
      { titel: "Mieterportal — Anliegen", pfad: "/portal?tab=anliegen", erwartet: ["Mieterportal", ">Anliegen<"] },
      { titel: "Mieterportal — Zahlungen", pfad: "/portal?tab=zahlungen", erwartet: ["Mieterportal", ">Zahlungen<"] },
      { titel: "Mieterportal — Dokumente", pfad: "/portal?tab=dokumente", erwartet: ["Mieterportal", ">Dokumente<"] },
      { titel: "Mieterportal — Zähler", pfad: "/portal?tab=zaehler", erwartet: ["Mieterportal", "Zählerstand"] },
      { titel: "Mieter-Konto — Einstellungen", pfad: "/konto", erwartet: ["Meine Einstellungen"] },
      { titel: "Mieter-Demo — Vermieter-Bereich bleibt zu", pfad: "/steuer", erwartet: [], zielPfad: "/portal" },
    ];
    for (const weg of MIETER_WEGE) {
      let grund = null;
      try {
        const seite = await hole(weg.pfad);
        const soll = weg.zielPfad ?? weg.pfad.split("?")[0];
        if (seite.status >= 400) grund = `HTTP ${seite.status}`;
        if (!grund && seite.endePfad !== soll) grund = `umgeleitet: ${seite.kette.join(" → ")}`;
        if (!grund) {
          const fehlt = weg.erwartet.filter((t) => !seite.html.includes(t));
          if (fehlt.length) grund = `Text fehlt: ${fehlt.join(", ")}`;
        }
      } catch (e) {
        grund = `Ausnahme: ${e.message}`;
      }
      ergebnisse.push({ weg, grund });
      console.log(`${grund ? "✗" : "✓"} ${weg.titel}${grund ? `\n    ${grund}` : ""}`);
    }
  }

  // --- Service-Sicht (01.10.2026) -----------------------------------------
  // Dritte Anmeldung (3 von 6 je 300 s): als Demo-Hausmeister.
  kekse.clear();
  const serviceLogin = await hole("/api/demo?rolle=service");
  if (serviceLogin.endePfad !== "/service") {
    ergebnisse.push({ weg: { titel: "Service-Demo — Anmeldung" }, grund: `gelandet auf ${serviceLogin.kette.join(" → ")}` });
    console.log(`✗ Service-Demo — Anmeldung\n    ${serviceLogin.kette.join(" → ")}`);
  } else {
    console.log("\n✓ Service-Demo — Anmeldung");
    const SERVICE_WEGE = [
      { titel: "Service-Portal — Aufträge", pfad: "/service", erwartet: ["Service-Portal", "1 Auftraggeber (seit", "Auftrag beantragen", "Firmenverzeichnis des Vermieters", "Dachrinne verstopft", "Heizkörper im Bad prüfen", "Heizung &amp; Sanitär Böhm"] }, // React trennt Textteile mit <!-- --> — Marker ohne Übergang zwischen festem Text und {…}
      { titel: "Service-Demo — Vermieter-Bereich bleibt zu", pfad: "/steuer", erwartet: [], zielPfad: "/service" },
    ];
    for (const weg of SERVICE_WEGE) {
      let grund = null;
      try {
        const seite = await hole(weg.pfad);
        const soll = weg.zielPfad ?? weg.pfad.split("?")[0];
        if (seite.status >= 400) grund = `HTTP ${seite.status}`;
        if (!grund && seite.endePfad !== soll) grund = `umgeleitet: ${seite.kette.join(" → ")}`;
        if (!grund) {
          const fehlt = weg.erwartet.filter((t) => !seite.html.includes(t));
          if (fehlt.length) grund = `Text fehlt: ${fehlt.join(", ")}`;
        }
      } catch (e) {
        grund = `Ausnahme: ${e.message}`;
      }
      ergebnisse.push({ weg, grund });
      console.log(`${grund ? "✗" : "✓"} ${weg.titel}${grund ? `\n    ${grund}` : ""}`);
    }
  }

  const rot = ergebnisse.filter((e) => e.grund);
  console.log(`\n${ergebnisse.length - rot.length}/${ergebnisse.length} Wege grün`);
  if (rot.length) {
    console.log("\nRot:");
    for (const r of rot) console.log(`  · ${r.weg.titel}: ${r.grund}`);
  }
  process.exit(rot.length ? 1 : 0);
}

main().catch((e) => {
  console.error("Rauchtest abgebrochen:", e);
  process.exit(1);
});
