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
import { aboKostenZeilen, parseAboZahlung, type AboZahlung } from "@/lib/billing/aboBuchung";

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

  // Bezahlte Rechnung → Kosten „Verwaltung“ in den Büchern des Vermieters
  // (Anlage V Zeile 46). Eigener Weg, eigener Ausgang — siehe bucheAboZahlung.
  const zahlung = parseAboZahlung(payload);
  if (zahlung) return bucheAboZahlung(zahlung);

  const update = parsePaddleEvent(payload);
  // Fremde/irrelevante Events (z. B. übrige transaction.*, unbekannte Preis-IDs)
  // bewusst mit 200 quittieren, sonst wiederholt Paddle die Zustellung endlos.
  if (!update) return NextResponse.json({ ignoriert: true });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ fehler: "Service-Role fehlt" }, { status: 503 });

  // Reihenfolge-Schutz: nur anwenden, wenn das Event neuer ist als der Stand.
  // Der Abfragefehler MUSS ausgewertet werden: Käme der Stand wegen eines
  // Fehlers leer zurück, gälte JEDES Event als „neuer" — ein verspätetes
  // "updated" überschriebe dann doch ein späteres "canceled". Mit 500 wiederholt
  // Paddle die Zustellung; das ist hier der richtige Ausgang.
  const { data: bestehend, error: standFehler } = await admin
    .from("abos")
    .select("letztes_event_am")
    .eq("user_id", update.user_id)
    .maybeSingle();
  if (standFehler) return NextResponse.json({ fehler: "Stand nicht lesbar" }, { status: 500 });
  const letzter = (bestehend as { letztes_event_am: string | null } | null)?.letztes_event_am;
  if (letzter && update.letztes_event_am && new Date(update.letztes_event_am) <= new Date(letzter))
    return NextResponse.json({ veraltet: true });

  const { error } = await admin
    .from("abos")
    .upsert({ ...update, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ fehler: "Speichern fehlgeschlagen" }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// Bucht eine bezahlte MyImmo-Rechnung als Kosten (lib/billing/aboBuchung.ts).
// Genau einmal je Transaktion: `abo_zahlung_buchen` legt Merker und Zeilen in
// EINER Datenbank-Transaktion an. Jeder Fehler endet mit 500 — Paddle stellt
// dann erneut zu, und die Wiederholung ist dank Merker ungefährlich.
async function bucheAboZahlung(z: AboZahlung) {
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ fehler: "Service-Role fehlt" }, { status: 503 });

  // Zuordnung: Verlängerungen über die Subscription (custom_data ist dort
  // nicht verlässlich), der Erstkauf über custom_data.user_id, das
  // erstelleCheckoutUrl serverseitig setzt. Beides ist von Paddle signiert.
  let userId: string | null = null;
  if (z.subscriptionId) {
    const { data, error } = await admin
      .from("abos")
      .select("user_id")
      .eq("provider_subscription_id", z.subscriptionId)
      .maybeSingle();
    if (error) return NextResponse.json({ fehler: "Abo nicht lesbar" }, { status: 500 });
    userId = (data as { user_id: string } | null)?.user_id ?? null;
  }
  userId ??= z.userIdHinweis;
  // Kommt die Zahlung vor dem subscription.*-Event an, kennt die Datenbank das
  // Abo noch nicht: 500, Paddle stellt später erneut zu.
  if (!userId) return NextResponse.json({ fehler: "Zahlung keinem Konto zuzuordnen" }, { status: 500 });

  const { data: objekte, error: objektFehler } = await admin
    .from("properties")
    .select("id, einheiten_anzahl, obj_status")
    .eq("user_id", userId)
    .order("created_at");
  // Fehler auswerten: Leer hieße „keine Objekte" — und die Rechnung landete
  // ohne Objekt statt verteilt.
  if (objektFehler) return NextResponse.json({ fehler: "Objekte nicht lesbar" }, { status: 500 });

  const zeilen = aboKostenZeilen(z, (objekte ?? []) as { id: string; einheiten_anzahl: number | null; obj_status: string | null }[]);
  const { data: neu, error } = await admin.rpc("abo_zahlung_buchen", {
    p_user: userId,
    p_transaktion: z.transaktionId,
    p_cent: z.cent,
    p_zeilen: zeilen,
  });
  if (error) return NextResponse.json({ fehler: "Buchung fehlgeschlagen" }, { status: 500 });
  return NextResponse.json({ ok: true, gebucht: neu === true });
}
