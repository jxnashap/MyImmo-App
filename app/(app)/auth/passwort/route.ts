import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NACHWEIS_COOKIE, NACHWEIS_SEKUNDEN, stelleNachweisAus } from "@/lib/auth/resetNachweis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Löst einen „Passwort vergessen"-Link ein und schickt weiter zum Formular.
//
// WARUM ES DIESE ROUTE GIBT (09.09.2026)
// `resetPasswordForEmail` zeigte auf `/login` — und dort gab es weder eine
// Einlösung noch ein Formular für ein neues Passwort. Wer sein Passwort
// vergaß, landete auf dem Anmeldeformular und kam nicht weiter: In den
// Einstellungen verlangt der Wechsel das ALTE Passwort, also genau das, was
// vergessen wurde. Der Rückweg ins eigene Konto fehlte vollständig.
//
// ZWEI LINKFORMEN, BEIDE BEDIENT
// · `token_hash` + `type=recovery` → `verifyOtp` auf dem SERVER. Das ist der
//   wichtige Fall: Er funktioniert GERÄTEÜBERGREIFEND. Wer den Reset am Rechner
//   anstößt und die Mail auf dem Handy öffnet, ist der Normalfall, nicht die
//   Ausnahme. Voraussetzung ist die angepasste E-Mail-Vorlage in Supabase.
// · `code` → `exchangeCodeForSession` (PKCE). Das liefert die Standard-Vorlage
//   heute schon, funktioniert aber NUR auf demselben Gerät: Der `code_verifier`
//   liegt im Browser, der den Reset angefordert hat.
// Beides steht hier, damit der Weg sofort funktioniert und nach Umstellen der
// Vorlage auch von einem zweiten Gerät.
//
// Nach erfolgreicher Prüfung wird ein kurzlebiger Nachweis gesetzt
// (`lib/auth/resetNachweis.ts`). Ohne ihn verweigert das Formular — sonst wäre
// eine Seite, die ein Passwort OHNE das alte setzt, für jede fremde offene
// Sitzung erreichbar.

// Warum das Einlösen scheiterte — als Parameter an die Anmeldeseite.
//
// WARUM UNTERSCHIEDEN WIRD (09.09.2026): Die erste Fassung schickte jeden
// Fehlschlag mit derselben Meldung zurück. Beim ersten echten Test hiess es
// dann „Link abgelaufen oder bereits benutzt" — und niemand konnte sagen, ob
// der Link wirklich alt war, ob er auf einem anderen Geraet geoeffnet wurde
// oder ob ueberhaupt kein Token beim Server ankam. Eine Fehlermeldung, die
// jede Ursache gleich benennt, kostet eine ganze Runde Raten.
type Grund =
  /** Weder token_hash noch code kamen an. Passiert, wenn der Token im
   *  URL-Fragment steht (#access_token…) — das schickt der Browser NIE an den
   *  Server. Dann muss die E-Mail-Vorlage auf `token_hash` umgestellt werden. */
  | "ohne-token"
  /** `code` da, Tausch gescheitert: meist fehlender `code_verifier`, weil die
   *  Mail in einem ANDEREN Browser/Geraet geoeffnet wurde als dem, der den
   *  Reset angefordert hat. Oder der Code wurde schon eingeloest. */
  | "geraet"
  /** `token_hash` da, aber abgelaufen oder schon benutzt. */
  | "abgelaufen";

const zurueck = (origin: string, grund: Grund) =>
  NextResponse.redirect(`${origin}/login?fehler=reset&grund=${grund}`);

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const typ = searchParams.get("type");
  const code = searchParams.get("code");

  const supabase = await createClient();
  let ok = false;
  let grund: Grund = "ohne-token";

  if (tokenHash && typ === "recovery") {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    ok = !error;
    grund = "abgelaufen";
    if (error) console.error("Reset (token_hash) gescheitert:", error.message);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
    grund = "geraet";
    if (error) console.error("Reset (code) gescheitert:", error.message);
  } else {
    console.error("Reset ohne Token — weder token_hash noch code im Aufruf.");
  }

  if (!ok) return zurueck(origin, grund);

  // `getUser()` und nicht `getSession()`: Nur die erste prüft den Token gegen
  // Supabase. Ohne bestätigten Nutzer gibt es keinen Nachweis.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return zurueck(origin, grund);

  const antwort = NextResponse.redirect(`${origin}/auth/passwort-neu`);
  antwort.cookies.set(NACHWEIS_COOKIE, stelleNachweisAus(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: NACHWEIS_SEKUNDEN,
  });
  return antwort;
}
