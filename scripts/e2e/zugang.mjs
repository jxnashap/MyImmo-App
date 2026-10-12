#!/usr/bin/env node
// E2E am laufenden Server (Prüfstand 11.10.2026, CI-Stufe „E2E“): Zugangsgrenzen OHNE Anmeldung.
//
//   node scripts/e2e/zugang.mjs --basis=http://127.0.0.1:3100
//
// Prüft, dass geschützte Seiten zum Login leiten und geschützte API-Routen ohne Sitzung NICHTS
// herausgeben bzw. annehmen. Ruft nur Adressen auf, die die Sperrliste erlaubt (kein /api/demo,
// kein Cron, keine KI-Kosten — die KI-Routen lehnen vorher an der Anmeldung ab). Exit 1 bei Abweichung.
import { gesperrt } from "../crawlSperrliste.mjs";

const arg = (n, s) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${s}`).split("=").slice(1).join("=");
const BASIS = arg("basis", "http://127.0.0.1:3100").replace(/\/$/, "");

/** [Methode, Pfad, erwartet] — erwartet: "login" (Weiterleitung zum Login) oder eine Liste erlaubter Status. */
const FAELLE = [
  ["GET", "/properties", "login"],
  ["GET", "/mietkonto", "login"],
  ["GET", "/einstellungen", "login"],
  ["GET", "/steuer", "login"],
  ["GET", "/portal", "login"],
  ["GET", "/api/export/buchungen", [401, 403]],
  ["GET", "/api/export/datev?jahr=2025", [401, 403]],
  ["GET", "/api/export/alles", [401, 403]],
  ["GET", "/api/berichte/jahresbericht?jahr=2025", "login"],
  ["POST", "/api/import", [401, 403]],
  ["POST", "/api/nk-ocr", [401, 403]],
  ["POST", "/api/import-url", [401, 403]],
];

let fehler = 0;
for (const [methode, pfad, erwartet] of FAELLE) {
  if (methode === "GET" && gesperrt(pfad)) { console.log(`übersprungen (Sperrliste) ${pfad}`); continue; }
  const r = await fetch(BASIS + pfad, {
    method: methode,
    redirect: "manual",
    headers: methode === "POST" ? { "content-type": "application/json", origin: BASIS } : {},
    body: methode === "POST" ? "{}" : undefined,
  });
  const ort = r.headers.get("location") ?? "";
  const ok = erwartet === "login"
    ? r.status >= 300 && r.status < 400 && /\/login/.test(ort)
    : erwartet.includes(r.status);
  if (!ok) fehler++;
  console.log(`${ok ? "ok    " : "FEHLER"} ${methode} ${pfad} → ${r.status}${ort ? ` ${ort}` : ""}`);
}
console.log(fehler ? `${fehler} Abweichung(en)` : "alle Zugangsgrenzen halten");
process.exit(fehler ? 1 : 0);
