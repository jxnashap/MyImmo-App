#!/usr/bin/env node
// Prüft die n8n-Workflows in agency/n8n/, bevor sie importiert werden.
// Ein kaputtes Workflow-JSON fällt in n8n erst beim Ausführen auf — dann hat
// der Vorgang schon Geld gekostet. Aufruf: node agency/scripts/workflows-pruefen.mjs
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "n8n");
let fehler = 0;

for (const datei of readdirSync(DIR).filter((f) => f.endsWith(".json")).sort()) {
  let wf;
  try {
    wf = JSON.parse(readFileSync(join(DIR, datei), "utf8"));
  } catch (e) {
    console.error(`✗ ${datei}: kein gültiges JSON — ${e.message}`);
    fehler++;
    continue;
  }

  const namen = wf.nodes.map((n) => n.name);
  const doppelt = namen.filter((n, i) => namen.indexOf(n) !== i);
  if (doppelt.length) {
    console.error(`✗ ${datei}: doppelte Knotennamen — ${[...new Set(doppelt)].join(", ")}`);
    fehler++;
  }

  for (const [von, c] of Object.entries(wf.connections)) {
    if (!namen.includes(von)) {
      console.error(`✗ ${datei}: Verbindung von unbekanntem Knoten "${von}"`);
      fehler++;
    }
    for (const ausgang of c.main ?? []) {
      for (const ziel of ausgang) {
        if (!namen.includes(ziel.node)) {
          console.error(`✗ ${datei}: Verbindung auf unbekannten Knoten "${ziel.node}"`);
          fehler++;
        }
      }
    }
  }

  const ziele = new Set(
    Object.values(wf.connections).flatMap((c) => (c.main ?? []).flat().map((z) => z.node)),
  );
  const trigger = wf.nodes.filter((n) => /webhook|Trigger/i.test(n.type)).map((n) => n.name);
  for (const n of namen) {
    if (!ziele.has(n) && !trigger.includes(n)) {
      console.error(`✗ ${datei}: Knoten "${n}" ist von keinem Trigger aus erreichbar`);
      fehler++;
    }
  }

  for (const n of wf.nodes) {
    if (n.type === "n8n-nodes-base.code") {
      try {
        new Function(n.parameters.jsCode);
      } catch (e) {
        console.error(`✗ ${datei} · ${n.name}: JavaScript-Fehler — ${e.message}`);
        fehler++;
      }
    }
  }

  // n8n wertet einen Parameter nur dann als Ausdruck, wenn er mit "=" beginnt.
  // Fehlt das Gleichheitszeichen, steht {{ ... }} still als Text im Feld.
  const ohneGleich = JSON.stringify(wf).match(/"[^"=][^"]*\{\{[^"]*"/g);
  if (ohneGleich) {
    console.error(`✗ ${datei}: Ausdruck ohne führendes "=" — ${ohneGleich[0].slice(0, 90)}`);
    fehler++;
  }

  if (fehler === 0 || !doppelt.length) {
    console.log(`✓ ${datei}: ${wf.nodes.length} Knoten`);
  }
}

console.log(fehler ? `\n${fehler} Fehler.` : "\nAlle Workflows in Ordnung.");
process.exit(fehler ? 1 : 0);
