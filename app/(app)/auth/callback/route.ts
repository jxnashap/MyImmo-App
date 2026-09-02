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
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Rollen-Abgleich wie beim Passwort-Login: Passt das Konto nicht zur
      // gewählten Rolle, wird die Session beendet und der Grund benannt —
      // statt den Nutzer kommentarlos im falschen Portal abzusetzen.
      //
      // ABER: Eine fehlende Zeile in `nutzer_rollen` heißt NICHT „Vermieter".
      // Bei OAuth gibt es keine `raw_user_meta_data`, der Trigger
      // `handle_new_user_rolle` legt also gar keine Rolle an. Ein Mieter, der
      // „Mieter" wählt und sich per Google NEU registriert, bekäme sonst die
      // Falschaussage „Dieses Google-Konto gehört zu einem Vermieter-Konto"
      // über ein Konto, das gerade erst entstanden ist — und käme nie hinein.
      //
      // Unterscheidungsmerkmal: Ein etabliertes Vermieter-Konto hat eine Zeile
      // in `konto_freischaltung`. Fehlt beides (Rolle UND Freischaltung), ist
      // es ein frischer Zugang — der darf durch und landet über das Layout auf
      // /willkommen, wo er seinen Einladungscode einlöst. Der setzt dann die
      // richtige Rolle (siehe einladungscode_einloesen).
      if (gewaehlt) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const [{ data: rolleRow }, { data: freigeschaltet }] = await Promise.all([
            supabase.from("nutzer_rollen").select("rolle").eq("user_id", user.id).maybeSingle(),
            supabase.from("konto_freischaltung").select("user_id").eq("user_id", user.id).maybeSingle(),
          ]);
          const kontoRolle = rolleRow?.rolle ?? null;
          const istNeu = kontoRolle === null && !freigeschaltet;
          const effektiv = kontoRolle ?? "vermieter";

          if (!istNeu && effektiv !== gewaehlt) {
            await supabase.auth.signOut();
            return NextResponse.redirect(
              `${origin}/login?fehler=rolle&konto=${encodeURIComponent(effektiv)}`,
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
