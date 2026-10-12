import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { wiederholeFaellige } from "@/lib/aussenAuftrag";
import { sendeHinweis, type BenachrichtigungsArt } from "@/lib/benachrichtigung";
import { brevoBereit } from "@/lib/mail/brevo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Wiederholt fällige Schritte nach außen (Ablauf F, Prüfstand 11.10.2026): Hinweis-Mails, deren Versand
// fehlschlug, höchstens dreimal, einen Tag lang (lib/aussenAuftrag.ts). Stündlich über vercel.json.
// Ohne CRON_SECRET ist die Route AUS (nicht offen); ohne Mailversand wird nichts beansprucht.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET nicht gesetzt" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!brevoBereit()) return NextResponse.json({ ok: true, uebersprungen: "Mailversand nicht eingerichtet" });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Service-Role fehlt" }, { status: 503 });
  try {
    const r = await wiederholeFaellige(admin, (z) => () => sendeHinweis(admin, z.user_id, String(z.nutzlast.art) as BenachrichtigungsArt));
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    console.error("[cron aussen-auftraege]", e instanceof Error ? e.message : "unbekannt");
    return NextResponse.json({ error: "Schritte nicht lesbar" }, { status: 503 });
  }
}
