import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// OAuth-/PKCE-Callback: tauscht den von Supabase zurückgegebenen Code
// gegen eine Session (setzt die Auth-Cookies) und leitet weiter.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Nur interne Pfade als Redirect-Ziel akzeptieren ("//" wäre protokoll-relativ).
  const roh = searchParams.get("next") ?? "/";
  const next = roh.startsWith("/") && !roh.startsWith("//") ? roh : "/";
  // Rolle, die der Nutzer auf der Anmeldeseite gewählt hat (siehe googleLogin).
  const gewaehlt = searchParams.get("rolle");

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Rollen-Abgleich wie beim Passwort-Login: Passt das Konto nicht zur
      // gewählten Rolle, wird die Session sofort wieder beendet und der Grund
      // benannt — statt den Nutzer kommentarlos im falschen Portal abzusetzen.
      if (gewaehlt) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: rolleRow } = await supabase
            .from("nutzer_rollen")
            .select("rolle")
            .eq("user_id", user.id)
            .maybeSingle();
          const kontoRolle = rolleRow?.rolle ?? "vermieter";
          if (kontoRolle !== gewaehlt) {
            await supabase.auth.signOut();
            return NextResponse.redirect(
              `${origin}/login?fehler=rolle&konto=${encodeURIComponent(kontoRolle)}`,
            );
          }
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Kein Code oder Fehler -> zurück zum Login mit Hinweis
  return NextResponse.redirect(`${origin}/login?fehler=google`);
}
