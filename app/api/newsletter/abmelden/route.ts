import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { kontaktAbmelden } from "@/lib/mail/brevo";
import { tokenHash } from "@/lib/newsletterToken";
import { basisUrl } from "../route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Abmeldung über den Schlüssel aus dem Kontaktattribut ABMELDE_URL.
//
// Bewusst ohne Rückfrage und ohne Anmeldung: Wer abbestellen will, soll das mit
// einem Klick können. Eine Bestätigungsseite dazwischen wäre eine Hürde, die
// niemandem nützt — und rechtlich ist der Widerruf so einfach zu ermöglichen
// wie die Einwilligung selbst.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const ziel = (s: string) => `${basisUrl()}/vorlagen?nl=${s}`;
  if (!token) return NextResponse.redirect(ziel("fehler"), { status: 303 });

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.redirect(ziel("fehler"), { status: 303 });

  const { data: zeile } = await supabase
    .from("newsletter_anmeldungen")
    .select("id, email, abgemeldet_am")
    .eq("abmelde_token_hash", tokenHash(token))
    .maybeSingle();

  if (!zeile) return NextResponse.redirect(ziel("fehler"), { status: 303 });
  // Zweiter Klick: derselbe Erfolg, keine Fehlermeldung.
  if (zeile.abgemeldet_am) return NextResponse.redirect(ziel("abgemeldet"), { status: 303 });

  // Erst bei Brevo austragen, dann lokal vermerken. Andersherum stünde die
  // Adresse als abgemeldet in der eigenen Tabelle und bekäme trotzdem Post.
  await kontaktAbmelden(zeile.email);

  const { error } = await supabase
    .from("newsletter_anmeldungen")
    .update({ abgemeldet_am: new Date().toISOString() })
    .eq("id", zeile.id);
  if (error) {
    console.error("Newsletter: Abmeldung fehlgeschlagen", error.message);
    return NextResponse.redirect(ziel("fehler"), { status: 303 });
  }

  return NextResponse.redirect(ziel("abgemeldet"), { status: 303 });
}
