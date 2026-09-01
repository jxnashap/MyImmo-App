import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { besucherIp, darfWeiter } from "@/lib/net/bremse";
import { basisUrl } from "@/lib/net/basisUrl";
import { brevoBereit, sendeMail } from "@/lib/mail/brevo";
import {
  EINWILLIGUNGSTEXT,
  TOKEN_STUNDEN,
  bestaetigungsMail,
  istEmail,
  normalisiereEmail,
} from "@/lib/newsletter";
import { neuesToken, tokenHash } from "@/lib/newsletterToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Schritt 1 des Double-Opt-ins: Adresse vormerken und Bestätigungsmail senden.
// In den Verteiler kommt sie erst nach dem Klick in dieser Mail
// (/api/newsletter/bestaetigen).

export async function POST(req: Request) {
  let email = "";
  let quelle = "";
  try {
    const body = (await req.json()) as { email?: unknown; quelle?: unknown };
    email = typeof body.email === "string" ? body.email : "";
    quelle = typeof body.quelle === "string" ? body.quelle.slice(0, 60) : "";
  } catch {
    return NextResponse.json({ fehler: "Ungültige Anfrage." }, { status: 400 });
  }

  if (!istEmail(email)) {
    return NextResponse.json({ fehler: "Bitte eine gültige E-Mail-Adresse angeben." }, { status: 400 });
  }
  email = normalisiereEmail(email);

  // Zwei Bremsen: gegen das Zumüllen fremder Postfächer (je IP) und gegen
  // wiederholte Mails an dieselbe Adresse (je Adresse).
  if (!(await darfWeiter("newsletter_ip", 5, 900))) {
    return NextResponse.json({ fehler: "Zu viele Versuche. Bitte später erneut." }, { status: 429 });
  }
  if (!(await darfWeiter("newsletter_adresse", 3, 3600, email))) {
    return NextResponse.json({ fehler: "Zu viele Versuche. Bitte später erneut." }, { status: 429 });
  }

  const supabase = createAdminClient();
  if (!supabase || !brevoBereit()) {
    // Ohne Datenbank- oder Mail-Konfiguration ehrlich abbrechen, statt einen
    // Erfolg vorzutäuschen, auf den nie eine Mail folgt.
    return NextResponse.json(
      { fehler: "Der Versand ist gerade nicht verfügbar. Bitte später erneut versuchen." },
      { status: 503 },
    );
  }

  const token = neuesToken();
  const ablauf = new Date(Date.now() + TOKEN_STUNDEN * 3600 * 1000).toISOString();

  // Bereits bestätigte Adressen bekommen keine neue Bestätigungsmail — sonst
  // ließe sich über das Formular jedem Abonnenten wiederholt Post schicken.
  const { data: vorhanden } = await supabase
    .from("newsletter_anmeldungen")
    .select("id, bestaetigt_am")
    .eq("email", email)
    .maybeSingle();

  if (vorhanden?.bestaetigt_am) {
    return NextResponse.json({ ok: true, schon: true });
  }

  const { error } = await supabase.from("newsletter_anmeldungen").upsert(
    {
      email,
      token_hash: tokenHash(token),
      token_ablauf: ablauf,
      quelle: quelle || null,
      einwilligungstext: EINWILLIGUNGSTEXT,
      angefordert_am: new Date().toISOString(),
      angefordert_ip: await besucherIp(),
      // Eine frühere Abmeldung wird durch die neue Anmeldung aufgehoben.
      abgemeldet_am: null,
    },
    { onConflict: "email" },
  );
  if (error) {
    console.error("Newsletter: Speichern fehlgeschlagen", error.message);
    return NextResponse.json({ fehler: "Speichern fehlgeschlagen." }, { status: 500 });
  }

  const url = `${await basisUrl()}/api/newsletter/bestaetigen?token=${encodeURIComponent(token)}`;
  const mail = bestaetigungsMail(url);
  const gesendet = await sendeMail({ an: email, betreff: mail.betreff, html: mail.html, text: mail.text });
  if (!gesendet) {
    return NextResponse.json(
      { fehler: "Die Bestätigungsmail konnte nicht zugestellt werden. Bitte später erneut versuchen." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
