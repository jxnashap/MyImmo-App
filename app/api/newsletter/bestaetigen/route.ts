import { NextResponse } from "next/server";
import { basisUrl } from "@/lib/net/basisUrl";
import { createAdminClient } from "@/lib/supabase/admin";
import { besucherIp } from "@/lib/net/bremse";
import { kontaktEintragen } from "@/lib/mail/brevo";
import { EINWILLIGUNG_VERSION } from "@/lib/newsletter";
import { neuesToken, tokenHash } from "@/lib/newsletterToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Schritt 2 des Double-Opt-ins: Klick aus der Bestätigungsmail. Erst hier wird
// der Kontakt an Brevo übergeben — vorher steht die Adresse nur als offene
// Anfrage in der eigenen Datenbank.
//
// Antwortet mit einer Weiterleitung statt mit JSON: Der Aufruf kommt aus einem
// Mailprogramm, der Besucher soll eine Seite sehen.

// Basis wird im Handler einmal aufgeloest und hier hereingereicht:
// `basisUrl()` ist seit Next 15 asynchron, diese Funktion soll es nicht sein.
function ziel(basis: string, status: string): string {
  return `${basis}/vorlagen?nl=${status}`;
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const basis = await basisUrl();
  if (!token) return NextResponse.redirect(ziel(basis, "fehler"), { status: 303 });

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.redirect(ziel(basis, "fehler"), { status: 303 });

  const { data: zeile } = await supabase
    .from("newsletter_anmeldungen")
    .select("id, email, token_ablauf, bestaetigt_am")
    .eq("token_hash", tokenHash(token))
    .maybeSingle();

  if (!zeile) return NextResponse.redirect(ziel(basis, "fehler"), { status: 303 });

  // Ein zweiter Klick auf denselben Link ist kein Fehler — Mailprogramme rufen
  // Links teils selbst auf, und Menschen klicken zweimal.
  if (zeile.bestaetigt_am) return NextResponse.redirect(ziel(basis, "ok"), { status: 303 });

  if (new Date(zeile.token_ablauf).getTime() < Date.now()) {
    return NextResponse.redirect(ziel(basis, "abgelaufen"), { status: 303 });
  }

  const jetzt = new Date().toISOString();

  // Abmelde-Schlüssel jetzt erzeugen und Brevo als Kontaktattribut mitgeben:
  // Kampagnen können ihn einsetzen, und eine Abmeldung landet dadurch auch in
  // der eigenen Einwilligungstabelle statt nur bei Brevo.
  const abmelde = neuesToken();
  const abmeldeUrl = `${basis}/api/newsletter/abmelden?token=${encodeURIComponent(abmelde)}`;
  const eingetragen = await kontaktEintragen(zeile.email, {
    EINWILLIGUNG: EINWILLIGUNG_VERSION,
    ABMELDE_URL: abmeldeUrl,
  });

  const { error } = await supabase
    .from("newsletter_anmeldungen")
    .update({
      bestaetigt_am: jetzt,
      bestaetigt_ip: await besucherIp(),
      // Nur setzen, wenn Brevo den Kontakt wirklich angenommen hat. So bleibt
      // erkennbar, welche Bestätigungen noch nachgetragen werden müssen.
      brevo_synchron_am: eingetragen ? jetzt : null,
      abmelde_token_hash: tokenHash(abmelde),
      // Token verbrauchen: Der Link taugt danach zu nichts mehr.
      token_hash: tokenHash(`verbraucht:${zeile.id}:${jetzt}`),
    })
    .eq("id", zeile.id);

  if (error) {
    console.error("Newsletter: Bestätigung fehlgeschlagen", error.message);
    return NextResponse.redirect(ziel(basis, "fehler"), { status: 303 });
  }

  return NextResponse.redirect(ziel(basis, "ok"), { status: 303 });
}
