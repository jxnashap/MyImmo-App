// Gemeinsamer Browser für den Design-Scan. Chromium vertraut dem Proxy-Zertifikat nicht;
// deshalb holt Playwright jede Anfrage über Node (das NODE_EXTRA_CA_CERTS kennt) und reicht
// sie an den Browser durch. TLS-Prüfung bleibt an — nur der Netzweg ist ein anderer.
import { chromium } from "playwright";
export const BASIS = "https://www.myimmoapp.de";
export async function oeffne({ breite = 390, hoehe = 844, rolle = "gast" } = {}) {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", proxy: { server: process.env.HTTPS_PROXY } });
  const state = rolle === "gast" ? undefined : `.scan/state-${rolle}.json`;
  const ctx = await browser.newContext({ viewport: { width: breite, height: hoehe }, deviceScaleFactor: 1, isMobile: breite < 800, hasTouch: breite < 800, storageState: state, locale: "de-DE", timezoneId: "Europe/Berlin" });
  await ctx.route("**/*", async (route) => {
    try { const r = await route.fetch(); await route.fulfill({ response: r }); }
    catch { try { await route.abort(); } catch {} }
  });
  return { browser, ctx };
}

/** Weiterleitungen in Node auflösen (der Browser würde sie am Routing vorbei laden). Liefert die
 *  Endadresse; Cookies aus den Zwischenschritten landen im Kontext. */
export async function endAdresse(ctx, url) {
  let u = url;
  for (let i = 0; i < 6; i++) {
    const r = await ctx.request.get(u, { maxRedirects: 0, failOnStatusCode: false, timeout: 90000 });
    const loc = r.headers()["location"];
    if (r.status() >= 300 && r.status() < 400 && loc) { u = new URL(loc, u).toString(); continue; }
    return { url: u, status: r.status() };
  }
  return { url: u, status: null };
}
