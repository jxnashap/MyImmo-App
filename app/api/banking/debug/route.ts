// Temporäre Diagnose-Route für die Enable-Banking-Sandbox-Anbindung.
// Owner-only (Login nötig). Gibt KEINE Secrets aus — nur App-Metadaten,
// verfügbare Länder und Bank-Namen sowie ggf. die API-Fehlermeldung.
// Wird nach erfolgreichem Sandbox-Test wieder entfernt.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPrivateKey, createSign } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://api.enablebanking.com";
const b64url = (i: Buffer | string) =>
  (typeof i === "string" ? Buffer.from(i) : i).toString("base64url");

function jwt(): string {
  const appId = process.env.ENABLE_BANKING_APP_ID!;
  const pem = (process.env.ENABLE_BANKING_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ typ: "JWT", alg: "RS256", kid: appId }));
  const pay = b64url(JSON.stringify({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat: now, exp: now + 3600 }));
  const input = `${head}.${pay}`;
  const sig = createSign("RSA-SHA256").update(input).sign(createPrivateKey(pem));
  return `${input}.${b64url(sig)}`;
}

async function call(path: string) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${jwt()}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
    const text = await res.text();
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { /* nicht-JSON */ }
    return { status: res.status, ok: res.ok, body: json ?? text.slice(0, 500) };
  } catch (e) {
    return { status: 0, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", "https://www.myimmoapp.de"));

  const pem = process.env.ENABLE_BANKING_PRIVATE_KEY ?? "";
  const env = {
    app_id_gesetzt: !!process.env.ENABLE_BANKING_APP_ID,
    app_id: process.env.ENABLE_BANKING_APP_ID ?? null,
    key_gesetzt: !!pem,
    key_beginnt_mit_BEGIN: pem.includes("BEGIN"),
    key_hat_escaped_n: pem.includes("\\n"),
    key_laenge: pem.length,
  };

  const application = await call("/application"); // App-Metadaten + freigeschaltete ASPSPs
  const aspspsDE = await call("/aspsps?country=DE");
  const aspspsFI = await call("/aspsps?country=FI");

  const namen = (r: any) =>
    r?.ok && r.body?.aspsps ? r.body.aspsps.map((a: any) => `${a.name} (${a.country})`).slice(0, 25) : r;

  return NextResponse.json({
    env,
    application,
    aspsps_DE: namen(aspspsDE),
    aspsps_FI: namen(aspspsFI),
    hinweis: "Diese Route zeigt keine Secrets. Nach dem Test wird sie entfernt.",
  }, { headers: { "Cache-Control": "no-store" } });
}
