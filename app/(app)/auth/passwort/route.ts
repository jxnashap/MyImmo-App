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

const FEHLER = "/login?fehler=reset";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const typ = searchParams.get("type");
  const code = searchParams.get("code");

  const supabase = await createClient();
  let ok = false;

  if (tokenHash && typ === "recovery") {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  if (!ok) return NextResponse.redirect(`${origin}${FEHLER}`);

  // `getUser()` und nicht `getSession()`: Nur die erste prüft den Token gegen
  // Supabase. Ohne bestätigten Nutzer gibt es keinen Nachweis.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}${FEHLER}`);

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
