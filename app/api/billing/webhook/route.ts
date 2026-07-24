// Paddle-Webhook: hält die abos-Tabelle aktuell (subscription.activated/
// updated/canceled …). Ohne PADDLE_WEBHOOK_SECRET ist die Route ein No-op
// (503) — das Bezahlsystem ist gebaut, aber noch nicht aktiviert.
//
// Sicherheit: Signaturprüfung (HMAC, Paddle-Signature-Header) VOR dem Parsen;
// geschrieben wird mit der Service-Role (RLS-Bypass), da der Webhook ohne
// Nutzer-Session eintrifft. Nutzer selbst haben nur Lesezugriff auf abos.
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePaddleEvent, verifyPaddleSignature } from "@/lib/billing/paddle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ fehler: "Nicht konfiguriert" }, { status: 503 });

  const rawBody = await req.text();
  const signatur = req.headers.get("paddle-signature");
  if (!verifyPaddleSignature(rawBody, signatur, secret))
    return NextResponse.json({ fehler: "Ungültige Signatur" }, { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ fehler: "Ungültiges JSON" }, { status: 400 });
  }

  const update = parsePaddleEvent(payload);
  // Fremde/irrelevante Events (z. B. transaction.*) bewusst mit 200 quittieren,
  // sonst wiederholt Paddle die Zustellung endlos.
  if (!update) return NextResponse.json({ ignoriert: true });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ fehler: "Service-Role fehlt" }, { status: 503 });

  const { error } = await admin
    .from("abos")
    .upsert({ ...update, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ fehler: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
