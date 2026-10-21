import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { heimVon } from "@/lib/auth/anmeldeZiel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// OAuth-/PKCE-Callback: tauscht den von Supabase zurückgegebenen Code
// gegen eine Session (setzt die Auth-Cookies) und leitet weiter.
//
// Zwei Wege kommen hier an:
// · Google-Anmeldung (`?rolle=…&next=…`).
// · Bestätigungslink der Registrierung (`?bestaetigt=1&next=…`, seit 21.10.2026 —
//   lib/auth/anmeldeZiel.ts → bestaetigungsZiel). Supabase hat die Adresse beim
//   Klick bereits bestätigt, BEVOR es hierher weiterleitet. Scheitert nur der
//   Tausch (Link in einem anderen Browser geöffnet als dem, der registriert hat),
//   ist das kein Fehler: Die Anmeldeseite sagt „bestätigt, jetzt anmelden“.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Nur interne Pfade als Redirect-Ziel akzeptieren ("//" wäre protokoll-relativ).
  const roh = searchParams.get("next") ?? "/";
  const next = roh.startsWith("/") && !roh.startsWith("//") ? roh : "/";
  // Rolle, die der Nutzer auf der Anmeldeseite gewählt hat (siehe googleLogin).
  const gewaehlt = searchParams.get("rolle");
  const ausBestaetigung = searchParams.get("bestaetigt") === "1";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Die Rolle des KONTOS entscheidet, wohin es geht (wie beim Passwort-Login,
      // lib/auth/anmeldeZiel.ts). Bis 21.10.2026 wurde ein bestehendes Konto mit
      // anderer Rolle hier abgemeldet und mit „gehört zu einem …-Konto“ zurück-
      // geschickt — das Layout leitet aber ohnehin jedes Konto in seinen Bereich.
      //
      // Eine fehlende Zeile in `nutzer_rollen` heißt NICHT „Vermieter".
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

          // Bestehendes Konto mit anderer Rolle: ohne eigenes Ziel in den eigenen
          // Bereich (ein Deep-Link bleibt; das Layout leitet dort weiter).
          if (!istNeu && effektiv !== gewaehlt && next === "/") {
            return NextResponse.redirect(`${origin}${heimVon(effektiv)}`);
          }
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Bestätigungslink ohne gelungenen Tausch: Die Adresse ist bestätigt (oder der
  // Link war alt — dann sagt es die Anmeldung). Kein Google-Fehler anzeigen.
  if (ausBestaetigung) {
    const rolle = gewaehlt === "mieter" || gewaehlt === "service" ? `&rolle=${gewaehlt}` : "";
    return NextResponse.redirect(`${origin}/login?bestaetigt=1${rolle}`);
  }

  // Kein Code oder Fehler -> zurück zum Login mit Hinweis
  return NextResponse.redirect(`${origin}/login?fehler=google`);
}
