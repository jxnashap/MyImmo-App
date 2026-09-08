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

// Geführte Demo-Wege (08.09.2026, Feedback Phase 4): Ein Besucher soll nicht
// auf dem Dashboard landen und raten, sondern dort, wo die Frage beantwortet
// wird, die ihn hergeführt hat. WEISSLISTE, kein freier Pfad — sonst wäre der
// Parameter eine offene Weiterleitung auf Kosten der eigenen Domain.
const DEMO_ZIELE: Record<string, string> = {
  miete: "/mietkonto",
  nk: "/tenants",
  schaden: "/anliegen",
};

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
  //    Der Ausgang wird im Redirect mitgegeben. Grund: Beim ersten Live-Test am
  //    29.08.2026 schlug der Reset stumm fehl — die Route meldete `demo=1`, als
  //    sei alles gut, obwohl gar nicht zurueckgesetzt wurde (der
  //    Service-Role-Key fehlte in Vercel). Ein `console.error`, das niemand
  //    liest, ist keine Fehlerbehandlung.
  let resetStatus: "ok" | "kein-key" | "fehler" = "ok";
  const admin = createAdminClient();
  if (!admin) {
    resetStatus = "kein-key";
    console.error("Demo-Reset uebersprungen: SUPABASE_SERVICE_ROLE_KEY fehlt.");
  } else {
    const { error: resetFehler } = await admin.rpc("demo_zuruecksetzen");
    if (resetFehler) {
      // Nicht abbrechen: Ein fehlgeschlagener Reset ist aergerlich, aber die
      // Demo bleibt benutzbar — nur eben mit dem Stand, den der Vorgaenger
      // hinterlassen hat. Ein harter Fehler waere die schlechtere Erfahrung.
      resetStatus = "fehler";
      console.error("Demo-Reset fehlgeschlagen:", resetFehler.message);
    }
  }

  // 2. Anmelden — schreibt die Session-Cookies ueber den Server-Client.
  const supabase = await createClient();
  const { data: login, error: loginFehler } = await supabase.auth.signInWithPassword({
    email: DEMO_EMAIL,
    password: passwort,
  });
  if (loginFehler) {
    console.error("Demo-Login fehlgeschlagen:", loginFehler.message);
    return NextResponse.redirect(new URL("/?demo=fehler", ziel));
  }

  // 2FA-Faktoren am Demo-Konto entfernen (08.09.2026): Die Oberfläche sperrt
  // die Einrichtung, aber die Supabase-API nicht. Ein Besucher, der dem
  // geteilten Konto einen Faktor anhängt, sperrte alle anderen aus.
  if (admin && login.user) {
    const { data: faktoren } = await admin.auth.admin.mfa.listFactors({ userId: login.user.id });
    for (const f of faktoren?.factors ?? []) {
      await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId: login.user.id });
    }
  }

  // `reset` steht nur im Fehlerfall in der URL — im Normalbetrieb bleibt sie
  // sauber. Damit laesst sich von aussen (curl) pruefen, ob wirklich
  // zurueckgesetzt wurde, ohne Zugriff auf die Server-Logs.
  const gewaehlt = DEMO_ZIELE[new URL(request.url).searchParams.get("weg") ?? ""] ?? "/";
  const basis = gewaehlt === "/" ? "/?demo=1" : `${gewaehlt}?demo=1`;
  const ziel_url = resetStatus === "ok" ? basis : `${basis}&reset=${resetStatus}`;
  return NextResponse.redirect(new URL(ziel_url, ziel));
}
