import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { darfWeiter } from "@/lib/net/bremse";

// Oeffentlicher Demo-Zugang: setzt den Demo-Bestand zurueck und meldet den
// Besucher am Demo-Konto an. Danach steht die volle App mit 6 Objekten,
// 6 Mietern und rund 190 Buchungen bereit.
//
// Der Reset laeuft BEIM BETRETEN, nicht bei jeder Seitennavigation — sonst
// koennte man in der Demo nichts anlegen und danach ansehen, und jede
// Navigation wuerde ~250 Zeilen loeschen und neu schreiben. Wer die Demo
// erneut betritt, bekommt einen frischen Stand.
//
// EINSCHRAENKUNG, bewusst in Kauf genommen: Alle Besucher teilen EIN Konto.
// Startet jemand die Demo neu, waehrend ein anderer darin arbeitet, verliert
// der zweite seine Aenderungen. Bei mehr Andrang waere der naechste Schritt ein
// Pool mehrerer Demo-Konten (demo1..demo5) — die Struktur hier bleibt gleich,
// es kaeme nur eine Auswahl des freien Kontos davor.
//
// Warum GET und nicht POST: Der Einstieg ist ein Link auf der Landingpage; ein
// Formular-POST waere fuer den Besucher dasselbe, macht das Teilen des Links
// aber unmoeglich.

export const dynamic = "force-dynamic";

const DEMO_EMAIL = "demo.vermieter@myimmo.test";

export async function GET(request: Request) {
  const ziel = new URL(request.url).origin;

  const passwort = process.env.DEMO_PASSWORT;
  if (!passwort) {
    // Fehlt die Env, ist die Demo schlicht nicht eingerichtet — keine
    // Fehlerseite, sondern zurueck zur Startseite mit Hinweis.
    return NextResponse.redirect(new URL("/?demo=aus", ziel));
  }

  // Der Reset ist teuer (loescht und schreibt ~250 Zeilen). Ohne Bremse liesse
  // sich der Endpunkt in einer Schleife aufrufen und die Datenbank belasten.
  if (!(await darfWeiter("demo-start", 6, 300))) {
    return NextResponse.redirect(new URL("/?demo=bremse", ziel));
  }

  // 1. Bestand auf den Schnappschuss zuruecksetzen (Service-Role; die Funktion
  //    ist fuer anon/authenticated ausdruecklich gesperrt).
  //    `createAdminClient()` gibt null zurueck, wenn der Service-Role-Key fehlt
  //    — dann wird NICHT zurueckgesetzt, die Demo aber trotzdem geoeffnet.
  const admin = createAdminClient();
  if (!admin) {
    console.error("Demo-Reset uebersprungen: SUPABASE_SERVICE_ROLE_KEY fehlt.");
  } else {
    const { error: resetFehler } = await admin.rpc("demo_zuruecksetzen");
    if (resetFehler) {
      // Nicht abbrechen: Ein fehlgeschlagener Reset ist aergerlich, aber die
      // Demo bleibt benutzbar — nur eben mit dem Stand, den der Vorgaenger
      // hinterlassen hat. Ein harter Fehler waere die schlechtere Erfahrung.
      console.error("Demo-Reset fehlgeschlagen:", resetFehler.message);
    }
  }

  // 2. Anmelden — schreibt die Session-Cookies ueber den Server-Client.
  const supabase = createClient();
  const { error: loginFehler } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: passwort,
  });
  if (loginFehler) {
    console.error("Demo-Login fehlgeschlagen:", loginFehler.message);
    return NextResponse.redirect(new URL("/?demo=fehler", ziel));
  }

  return NextResponse.redirect(new URL("/?demo=1", ziel));
}
