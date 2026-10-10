#!/usr/bin/env node
// Nur lesender Crawler: folgt den Links einer Rolle per GET und meldet kaputte Seiten
// (Gesamtprüfung 07.10.2026, Paket P13 — aus dem Audit-Werkzeug `i1/crawl.mjs` übernommen).
//
// Was er meldet: HTTP ≥ 500, „nicht gefunden“ (auch per Streaming-Marker, siehe streamingMarker.mjs),
// die Fehlerseite der App, Weiterleitungen aus der Seite heraus. Was er NICHT tut: absenden, klicken,
// JavaScript ausführen. Er folgt nur `href`s auf der eigenen Domain.
//
// SPERRLISTE: Adressen aus `crawlSperrliste.mjs` ruft er nie auf — auch nicht als Startadresse.
// Im Audit ist ein Linkprüfer fünfmal `/api/demo` gefolgt und hat den Demo-Bestand zurückgesetzt.
//
// Anmeldung: Er meldet sich NICHT selbst an. Die Sitzung kommt aus `.scan/state-<rolle>.json`, die
// `node scripts/designscan/login.mjs <rolle>` einmal anlegt (ein Aufruf von /api/demo je Rolle).
//
// Benutzung:
//   node scripts/crawl.mjs --rolle=vermieter --max=300 / /properties
//   node scripts/crawl.mjs --rolle=gast / /funktionen /ratgeber
// Ergebnis: `.scan/crawl-<rolle>.json`; Exit 1, wenn eine Seite kaputt ist (≥ 500 oder Fehlerseite).

import fs from "node:fs";
import { gesperrt } from "./crawlSperrliste.mjs";
import { streamingMarker } from "./streamingMarker.mjs";

const arg = (name, standard) => {
  const t = process.argv.find((a) => a.startsWith(`--${name}=`));
  return t ? t.slice(name.length + 3) : standard;
};
const BASIS = arg("basis", "https://www.myimmoapp.de").replace(/\/$/, "");
const ROLLE = arg("rolle", "gast");
const MAX = Number(arg("max", "300"));
const JE_FORM = Number(arg("je-form", "2"));
const starts = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (starts.length === 0) starts.push("/");

const verboten = starts.filter((s) => gesperrt(s));
if (verboten.length) {
  console.error(`Startadresse gesperrt (crawlSperrliste.mjs): ${verboten.join(", ")}`);
  process.exit(2);
}

const kekse = new Map();
if (ROLLE !== "gast") {
  const datei = `.scan/state-${ROLLE}.json`;
  if (!fs.existsSync(datei)) {
    console.error(`${datei} fehlt — zuerst: node scripts/designscan/login.mjs ${ROLLE}`);
    process.exit(2);
  }
  for (const c of JSON.parse(fs.readFileSync(datei, "utf8")).cookies) if (c.domain.includes(new URL(BASIS).hostname.replace(/^www\./, ""))) kekse.set(c.name, c.value);
}
const keksKopf = () => [...kekse].map(([k, v]) => `${k}=${v}`).join("; ");
function merkeKekse(antwort) {
  for (const zeile of antwort.headers.getSetCookie?.() ?? []) {
    const [paar, ...attr] = zeile.split(";");
    const i = paar.indexOf("=");
    const k = paar.slice(0, i).trim();
    const v = paar.slice(i + 1);
    if (/max-age=0/i.test(attr.join(";")) || v === "") kekse.delete(k);
    else kekse.set(k, v);
  }
}

async function hole(pfad) {
  let url = BASIS + pfad;
  const kette = [];
  for (let i = 0; i < 8; i++) {
    const u = new URL(url);
    if (u.origin !== new URL(BASIS).origin) return { pfad, status: null, ende: url, kette, extern: true };
    // Auch eine WEITERLEITUNG darf nicht auf eine gesperrte Adresse führen.
    if (gesperrt(u.pathname + u.search)) return { pfad, status: null, ende: u.pathname + u.search, kette, gesperrt: true };
    let antwort;
    for (let versuch = 0; versuch < 3; versuch++) {
      try {
        antwort = await fetch(url, { redirect: "manual", headers: { ...(kekse.size ? { cookie: keksKopf() } : {}), "user-agent": "MyImmo-Crawler/1.0" } });
        break;
      } catch (e) {
        if (versuch === 2) return { pfad, fehler: String(e), kette };
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    merkeKekse(antwort);
    if (antwort.status >= 300 && antwort.status < 400 && antwort.headers.get("location")) {
      kette.push(antwort.status);
      url = new URL(antwort.headers.get("location"), url).toString();
      continue;
    }
    const typ = antwort.headers.get("content-type") ?? "";
    const html = typ.includes("html") ? await antwort.text() : (await antwort.arrayBuffer(), "");
    let status = antwort.status;
    if (html && status === 200) {
      const m = streamingMarker(html);
      if (m.weiter) {
        kette.push("Streaming-307");
        url = new URL(m.weiter, url).toString();
        continue;
      }
      if (m.status) status = m.status;
    }
    return { pfad, status, ende: u.pathname + u.search, kette, typ, html };
  }
  return { pfad, fehler: "zu viele Weiterleitungen", kette };
}

// Höchstens JE_FORM Adressen je Form (`/properties/:id?tab`), sonst läuft der Crawler durch jede Buchung.
const formen = new Map();
const form = (h) => {
  const u = new URL(h, BASIS);
  return u.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ":id") + "?" + [...u.searchParams.keys()].sort().join(",");
};

const gesehen = new Set();
const warteschlange = [...starts];
const quellen = new Map();
const ergebnisse = [];
let uebersprungen = 0;
while (warteschlange.length && ergebnisse.length < MAX) {
  const p = warteschlange.shift();
  if (gesehen.has(p)) continue;
  gesehen.add(p);
  const r = await hole(p);
  const e = { pfad: p, status: r.status ?? null, ende: r.ende, kette: r.kette, fehler: r.fehler, von: (quellen.get(p) ?? []).slice(0, 3) };
  if (r.gesperrt) e.gesperrt = true;
  if (r.html) {
    const text = r.html.replace(/<!-- -->/g, "");
    e.fehlerseite = /Etwas ist schiefgelaufen|Diese Seite ließ sich nicht laden|Application error/.test(text);
    e.nichtGefunden = r.status === 404 || /<title>Seite nicht gefunden/.test(text);
    for (const m of text.matchAll(/href="(\/[^"#]*)(?:#[^"]*)?"/g)) {
      const h = m[1].replace(/&amp;/g, "&");
      if (/^\/(?:_next|fonts|landing)\//.test(h) || /\.(?:png|svg|webp|jpg|woff2|ico|css|js|xml|txt)(?:\?|$)/.test(h)) continue;
      if (!quellen.has(h)) quellen.set(h, []);
      quellen.get(h).push(p);
      if (gesperrt(h)) {
        uebersprungen++;
        continue;
      }
      const f = form(h);
      const n = formen.get(f) ?? 0;
      if (!gesehen.has(h) && !warteschlange.includes(h) && n < JE_FORM) {
        warteschlange.push(h);
        formen.set(f, n + 1);
      }
    }
  }
  ergebnisse.push(e);
  process.stderr.write(`${e.status ?? (e.gesperrt ? "GESPERRT" : "ERR")} ${p}${e.ende && e.ende !== p ? ` → ${e.ende}` : ""}\n`);
}

fs.mkdirSync(".scan", { recursive: true });
fs.writeFileSync(`.scan/crawl-${ROLLE}.json`, JSON.stringify({ basis: BASIS, rolle: ROLLE, ergebnisse, offen: warteschlange.length, uebersprungen, quellen: Object.fromEntries(quellen) }, null, 1));

const kaputt = ergebnisse.filter((e) => (e.status ?? 0) >= 500 || e.fehlerseite || e.fehler);
const fehlend = ergebnisse.filter((e) => e.nichtGefunden);
console.log(`${ergebnisse.length} Seiten gelesen, ${warteschlange.length} offen, ${uebersprungen} gesperrte Links übersprungen`);
console.log(`nicht gefunden: ${fehlend.length}${fehlend.length ? " — " + fehlend.map((e) => `${e.pfad} (von ${e.von.join(", ") || "Start"})`).join("; ") : ""}`);
console.log(`kaputt: ${kaputt.length}${kaputt.length ? " — " + kaputt.map((e) => `${e.pfad} ${e.status ?? e.fehler}`).join("; ") : ""}`);
process.exit(kaputt.length ? 1 : 0);
