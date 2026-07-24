// Paddle-Webhook: hält die abos-Tabelle aktuell (subscription.activated/
// updated/canceled …). Ohne PADDLE_WEBHOOK_SECRET ist die Route ein No-op
// (503) — das Bezahlsystem ist gebaut, aber noch nicht aktiviert.
//
// Sicherheit (inkl. Security-Review-Härtung 24.07.2026):
// - Größenlimit VOR dem Lesen (echte Paddle-Events sind winzig; verhindert
//   HMAC-Rechnerei über Müll-Anfragen an die öffentliche Route).
// - Signaturprüfung (HMAC, Paddle-Signature-Header) VOR dem Parsen.
// - Tarif kommt aus den bezahlten Preis-IDs, nicht aus custom_data (paddle.ts).
// - Reihenfolge-Schutz: Events, die älter sind als der zuletzt angewendete
//   Stand (occurred_at), werden verworfen — sonst könnte ein verspätetes
//   "updated" ein späteres "canceled" überschreiben.
// - Geschrieben wird mit der Service-Role (RLS-Bypass), da der Webhook ohne
//   Nutzer-Session eintrifft. Nutzer selbst haben nur Lesezugriff auf abos.
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePaddleEvent, verifyPaddleSignature } from "@/lib/billing/paddle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;

export async function POST(req: NextRequest) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ fehler: "Nicht konfiguriert" }, { status: 503 });

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES)
    return NextResponse.json({ fehler: "Zu groß" }, { status: 413 });

  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY_BYTES)
    return NextResponse.json({ fehler: "Zu groß" }, { status: 413 });

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
  // Fremde/irrelevante Events (z. B. transaction.*, unbekannte Preis-IDs)
  // bewusst mit 200 quittieren, sonst wiederholt Paddle die Zustellung endlos.
  if (!update) return NextResponse.json({ ignoriert: true });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ fehler: "Service-Role fehlt" }, { status: 503 });

  // Reihenfolge-Schutz: nur anwenden, wenn das Event neuer ist als der Stand.
  const { data: bestehend } = await admin
    .from("abos")
    .select("letztes_event_am")
    .eq("user_id", update.user_id)
    .maybeSingle();
  const letzter = (bestehend as { letztes_event_am: string | null } | null)?.letztes_event_am;
  if (letzter && update.letztes_event_am && new Date(update.letztes_event_am) <= new Date(letzter))
    return NextResponse.json({ veraltet: true });

  const { error } = await admin
    .from("abos")
    .upsert({ ...update, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ fehler: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
