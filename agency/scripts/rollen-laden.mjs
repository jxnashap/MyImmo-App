#!/usr/bin/env node
// Spielt die Rollen-Prompts aus agency/rollen/ in die Agency-Datenbank ein.
//
// Warum nicht direkt in n8n: Prompts sind die eigentliche Logik dieser
// Organisation. Sie gehören ins Repo — versioniert, überprüfbar, mit
// Historie. n8n holt sie zur Laufzeit aus der Datenbank, statt sie in
// Workflow-JSON zu duplizieren.
//
// Aufruf:
//   AGENCY_SUPABASE_URL=https://<ref>.supabase.co \
//   AGENCY_SUPABASE_SERVICE_KEY=<service-role-key> \
//   node agency/scripts/rollen-laden.mjs [--trocken]
//
// Der Service-Role-Key steht NICHT im Repo und wird nicht geloggt.

import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HIER = dirname(fileURLToPath(import.meta.url));
const ROLLEN_DIR = join(HIER, "..", "rollen");
const GEMEINSAM = "00-gemeinsam.md";
const trocken = process.argv.includes("--trocken");

const url = process.env.AGENCY_SUPABASE_URL?.replace(/\/+$/, "");
const key = process.env.AGENCY_SUPABASE_SERVICE_KEY;

if (!trocken && (!url || !key)) {
  console.error(
    "Fehlt: AGENCY_SUPABASE_URL und/oder AGENCY_SUPABASE_SERVICE_KEY.\n" +
      "Zum Prüfen ohne Datenbank: node agency/scripts/rollen-laden.mjs --trocken",
  );
  process.exit(1);
}

/** Front-Matter zwischen --- ... --- lesen. Bewusst minimal: nur `a: b`. */
function frontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return { kopf: {}, koerper: text };
  const kopf = {};
  for (const zeile of m[1].split(/\r?\n/)) {
    const t = zeile.match(/^\s*([A-Za-z_]+)\s*:\s*(.+?)\s*$/);
    if (t) kopf[t[1]] = t[2];
  }
  return { kopf, koerper: m[2] };
}

async function rpc(name, body) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status} — ${text}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const dateien = (await readdir(ROLLEN_DIR)).filter((f) => f.endsWith(".md")).sort();
const gemeinsam = await readFile(join(ROLLEN_DIR, GEMEINSAM), "utf8");
// Der HTML-Kommentar oben ist eine Notiz für Leser, nicht für das Modell.
const kopfText = gemeinsam.replace(/^<!--[\s\S]*?-->\s*/, "").trim();

let ok = 0;
let fehler = 0;

for (const datei of dateien) {
  if (datei === GEMEINSAM) continue;
  const roh = await readFile(join(ROLLEN_DIR, datei), "utf8");
  const { kopf, koerper } = frontMatter(roh);

  if (!kopf.schluessel || !kopf.name) {
    console.error(`✗ ${datei}: Front-Matter braucht mindestens 'schluessel' und 'name'`);
    fehler++;
    continue;
  }

  const prompt = `${kopfText}\n\n---\n\n${koerper.trim()}`;
  const nutzlast = {
    p_schluessel: kopf.schluessel,
    p_name: kopf.name,
    p_prompt: prompt,
    p_modell: kopf.modell ?? "claude-opus-5",
    p_effort: kopf.effort ?? "high",
    p_max_tokens: Number(kopf.max_tokens ?? 16000),
  };

  if (trocken) {
    console.log(
      `· ${kopf.schluessel.padEnd(10)} ${String(prompt.length).padStart(6)} Zeichen  ` +
        `${nutzlast.p_modell} / effort=${nutzlast.p_effort} / max_tokens=${nutzlast.p_max_tokens}`,
    );
    ok++;
    continue;
  }

  try {
    const antwort = await rpc("agency_rolle_setzen", nutzlast);
    if (antwort?.ok === false) throw new Error(antwort.fehler ?? "unbekannter Fehler");
    console.log(`✓ ${kopf.schluessel} (${prompt.length} Zeichen)`);
    ok++;
  } catch (e) {
    console.error(`✗ ${kopf.schluessel}: ${e.message}`);
    fehler++;
  }
}

console.log(`\n${ok} Rolle(n) ${trocken ? "geprüft" : "eingespielt"}, ${fehler} Fehler.`);
process.exit(fehler > 0 ? 1 : 0);
