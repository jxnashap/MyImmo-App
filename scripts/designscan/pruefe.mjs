// node scripts/designscan/pruefe.mjs <rolle: vermieter|mieter|service|gast> <breite> <ausgabeordner> <pfad> [pfad …]
// Je Pfad: Screenshot (ganze Seite) + JSON-Befund: wo gelandet, waagerechter Überlauf, Elemente,
// die rechts aus dem Bild ragen, abgeschnittene Texte ohne Auslassungszeichen, verdächtige Zeichen,
// Konsolenfehler. Nur lesend — nie etwas absenden.
import { mkdirSync, writeFileSync } from "node:fs";
import { oeffne, BASIS, endAdresse } from "./browser.mjs";
const [rolle = "gast", b = "390", aus = ".scan/out", ...pfade] = process.argv.slice(2);
const breite = Number(b);
mkdirSync(aus, { recursive: true });
const { browser, ctx } = await oeffne({ breite, rolle });
const ergebnisse = [];
for (const pfad of pfade) {
  const p = await ctx.newPage();
  const fehler = [];
  p.on("console", (m) => { if (m.type() === "error") fehler.push(m.text().slice(0, 200)); });
  p.on("pageerror", (e) => fehler.push("pageerror: " + String(e).slice(0, 200)));
  let status = null;
  try {
    const z = await endAdresse(ctx, BASIS + pfad);
    status = z.status;
    await p.goto(z.url, { waitUntil: "load", timeout: 90000 });
  } catch (e) { fehler.push("goto: " + String(e).slice(0, 160)); }
  await p.waitForTimeout(2500);
  const befund = await p.evaluate((vw) => {
    const sel = (el) => {
      let s = el.tagName.toLowerCase();
      if (el.id) s += "#" + el.id;
      const k = (el.getAttribute("class") || "").trim().split(/\s+/).filter(Boolean).slice(0, 3);
      if (k.length) s += "." + k.join(".");
      return s;
    };
    const sichtbar = (el) => { const st = getComputedStyle(el); const r = el.getBoundingClientRect(); return st.display !== "none" && st.visibility !== "hidden" && r.width > 0 && r.height > 0; };
    const raus = [], abgeschnitten = [];
    for (const el of document.querySelectorAll("body *")) {
      if (!sichtbar(el)) continue;
      const r = el.getBoundingClientRect();
      // In einem waagerecht scrollbaren Vorfahren ist Überstand gewollt.
      let scrollVorfahr = false;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const o = getComputedStyle(a).overflowX; if (o === "auto" || o === "scroll") { scrollVorfahr = true; break; }
      }
      if (!scrollVorfahr && r.right > vw + 1 && r.width < vw * 3) raus.push({ el: sel(el), rechts: Math.round(r.right), text: (el.innerText || "").trim().slice(0, 60) });
      const st = getComputedStyle(el);
      if (el.children.length === 0 && (el.innerText || "").trim() && el.scrollWidth > el.clientWidth + 1 && st.overflowX !== "visible" && st.textOverflow !== "ellipsis" && !scrollVorfahr)
        abgeschnitten.push({ el: sel(el), text: el.innerText.trim().slice(0, 80) });
    }
    const text = document.body.innerText;
    const verdacht = [];
    for (const m of ["�", "&quot;", "&amp;", "undefined", "NaN", "[object Object]", "null €", "Invalid Date", " ,", "  "])
      if (text.includes(m)) { const i = text.indexOf(m); verdacht.push({ muster: m, stelle: text.slice(Math.max(0, i - 40), i + 40) }); }
    return {
      ende: location.pathname + location.search,
      seitenbreite: document.documentElement.scrollWidth,
      waagerechterUeberlauf: document.documentElement.scrollWidth > vw + 1,
      raus: raus.slice(0, 15), rausGesamt: raus.length,
      abgeschnitten: abgeschnitten.slice(0, 15), abgeschnittenGesamt: abgeschnitten.length,
      verdacht,
    };
  }, breite).catch((e) => ({ fehler: String(e) }));
  // Bildschirmweise statt ganze Seite: Abschnitte blenden erst beim Scrollen ein (scroll-driven
  // animations) — eine Ganzseitenaufnahme zeigte sie leer. Höchstens MAX_BILDER Aufnahmen je Seite.
  const basis = `${aus}/${(pfad.replace(/[^a-z0-9]+/gi, "_") || "start").slice(0, 80)}-${breite}`;
  const hoehe = await p.evaluate(() => document.documentElement.scrollHeight).catch(() => 0);
  const vh = p.viewportSize()?.height ?? 844;
  const MAX_BILDER = Number(process.env.MAX_BILDER ?? 10);
  const anzahl = Math.max(1, Math.min(MAX_BILDER, Math.ceil(hoehe / vh)));
  const bilder = [];
  for (let i = 0; i < anzahl; i++) {
    await p.evaluate((y) => window.scrollTo(0, y), i * vh).catch(() => {});
    await p.waitForTimeout(450);
    const d = `${basis}-s${String(i + 1).padStart(2, "0")}.png`;
    await p.screenshot({ path: d }).catch(() => {});
    bilder.push(d);
  }
  ergebnisse.push({ pfad, status, seitenhoehe: hoehe, bilder, abgedeckt: anzahl * vh >= hoehe ? "ganz" : `nur ${anzahl * vh}px von ${hoehe}px`, konsole: fehler.slice(0, 8), ...befund });
  await p.close();
}
await browser.close();
const json = JSON.stringify(ergebnisse, null, 1);
writeFileSync(`${aus}/befund-${breite}-${Date.now()}.json`, json);
console.log(json);
