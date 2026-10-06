// node scripts/designscan/login.mjs <vermieter|mieter|service> — einmalige Demo-Anmeldung je Rolle → .scan/state-<rolle>.json. /api/demo bremst bei 6 Aufrufen je 300 s.
import { oeffne, BASIS, endAdresse } from "./browser.mjs";
const rolle = process.argv[2] ?? "vermieter";
const q = rolle === "vermieter" ? "" : `?rolle=${rolle}`;
const { browser, ctx } = await oeffne({ breite: 1280, hoehe: 900 });
const ziel = await endAdresse(ctx, `${BASIS}/api/demo${q}`);
console.log(rolle, "→", ziel.url, ziel.status, (await ctx.cookies()).map((c) => c.name).join(","));
await ctx.storageState({ path: `.scan/state-${rolle}.json` });
await browser.close();
