import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { abmeldeZiel } from "@/lib/auth/anmeldeZiel";

export async function POST(request: Request) {
  const supabase = await createClient();
  // Nur DIESE Sitzung (Audit P5, B52): ohne Scope nimmt die Bibliothek „global“ — ein Klick auf
  // „Abmelden“ im geteilten Demo-Konto beendete die Sitzungen aller Besucher.
  await supabase.auth.signOut({ scope: "local" });
  // Mieter- und Service-Portal schicken ihre Rolle mit: Die Anmeldeseite zeigt dann „Mieter“ statt
  // der Vermieter-Voreinstellung (21.10.2026). Nur bekannte Werte, siehe abmeldeZiel().
  let rolle: unknown = null;
  try {
    rolle = (await request.formData()).get("rolle");
  } catch {
    // Kein Formular-Körper (z. B. leerer POST) — dann die schlichte Anmeldeseite.
  }
  return NextResponse.redirect(new URL(abmeldeZiel(rolle), request.url), { status: 303 });
}
