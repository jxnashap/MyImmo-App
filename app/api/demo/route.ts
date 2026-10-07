import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { darfWeiter } from "@/lib/net/bremse";
import { DEMO_EMAIL, DEMO_MIETER_EMAIL, DEMO_SERVICE_EMAIL, DEMO_ZIELE } from "@/lib/demo";

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

// Geführte Demo-Wege: Weißliste `DEMO_ZIELE` in `lib/demo.ts`, neben
// `demoDarfRoute` — damit ein Test beide gegeneinander prüfen kann. Die erste
// Fassung (08.09.2026) stand hier und führte in gesperrte Bereiche.

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
  // Mieter-Sicht (01.10.2026): `?rolle=mieter` meldet am zweiten Demo-Konto
  // an und landet im Mieterportal. Das Konto wird beim ersten Aufruf per
  // Service-Role angelegt (gleiches Passwort) und nach jedem Reset mit der
  // Demo-Mieterin verknüpft (`demo_mieter_verknuepfen`, Migration
  // 20261001150000) — der Reset schreibt die Anliegen ohne mieter_user_id neu.
  const rolle = new URL(request.url).searchParams.get("rolle");
  const alsMieter = rolle === "mieter";
  // Service-Sicht (01.10.2026): `?rolle=service` meldet als Hausmeister an.
  const alsService = rolle === "service";

  let resetStatus: "ok" | "kein-key" | "fehler" = "ok";
  const admin = createAdminClient();
  if (!admin) {
    resetStatus = "kein-key";
    console.error("Demo-Reset uebersprungen: SUPABASE_SERVICE_ROLE_KEY fehlt.");
  } else {
    // Service-Partner VOR dem Reset: Der Reset ordnet die Beispiel-Aufträge
    // über die E-Mail ihrem Partner zu — fehlt das Konto, bliebe der Auftrag
    // ohne Partner. Ein späteres UPDATE ginge nicht: der Trigger
    // auftraege_service_spaltenschutz setzt service_user_id zurück, wenn
    // nicht der Vermieter selbst schreibt. Die Funktion nennt die fehlenden
    // Konten; nur dann wird angelegt (sonst kostete jeder Start drei Aufrufe).
    const { data: fehlend, error: sFehler } = await admin.rpc("demo_service_verknuepfen");
    if (sFehler) console.error("Demo-Service verknuepfen fehlgeschlagen:", sFehler.message);
    else if (Array.isArray(fehlend) && fehlend.length > 0) {
      for (const email of fehlend as string[]) {
        const { error: anlegeFehler } = await admin.auth.admin.createUser({ email, password: passwort, email_confirm: true });
        if (anlegeFehler && !/already|exists/i.test(anlegeFehler.message)) {
          console.error("Demo-Service-Konto anlegen fehlgeschlagen:", anlegeFehler.message);
        }
      }
      const { error: s2Fehler } = await admin.rpc("demo_service_verknuepfen");
      if (s2Fehler) console.error("Demo-Service verknuepfen fehlgeschlagen:", s2Fehler.message);
    }

    const { error: resetFehler } = await admin.rpc("demo_zuruecksetzen");
    if (resetFehler) {
      // Nicht abbrechen: Ein fehlgeschlagener Reset ist aergerlich, aber die
      // Demo bleibt benutzbar — nur eben mit dem Stand, den der Vorgaenger
      // hinterlassen hat. Ein harter Fehler waere die schlechtere Erfahrung.
      resetStatus = "fehler";
      console.error("Demo-Reset fehlgeschlagen:", resetFehler.message);
    }
    // Nebenkosten am Objekt: Die Kaskade von `properties` leert sie beim Reset; diese reine
    // Einfüge-Funktion legt das Beispiel wieder an (Migration 20261007210000, Audit B5).
    const { error: nkFehler } = await admin.rpc("demo_nk_nachfuellen");
    if (nkFehler) console.error("Demo-Nebenkosten nachfuellen fehlgeschlagen:", nkFehler.message);
    if (alsMieter) {
      // Anlegen ist idempotent: existiert das Konto, antwortet Supabase mit
      // „already been registered" — das ist der Normalfall, kein Fehler.
      const { error: anlegeFehler } = await admin.auth.admin.createUser({
        email: DEMO_MIETER_EMAIL,
        password: passwort,
        email_confirm: true,
      });
      if (anlegeFehler && !/already|exists/i.test(anlegeFehler.message)) {
        console.error("Demo-Mieter anlegen fehlgeschlagen:", anlegeFehler.message);
      }
    }
    const { data: verknuepft, error: vFehler } = await admin.rpc("demo_mieter_verknuepfen");
    if (vFehler) console.error("Demo-Mieter verknuepfen fehlgeschlagen:", vFehler.message);
    else if (alsMieter && verknuepft === false) {
      console.error("Demo-Mieter nicht verknuepft: Konto fehlt.");
      return NextResponse.redirect(new URL("/?demo=fehler", ziel));
    }
  }

  // 2. Anmelden — schreibt die Session-Cookies ueber den Server-Client.
  const supabase = await createClient();
  const { data: login, error: loginFehler } = await supabase.auth.signInWithPassword({
    email: alsMieter ? DEMO_MIETER_EMAIL : alsService ? DEMO_SERVICE_EMAIL : DEMO_EMAIL,
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
  // `Object.hasOwn`, nicht `DEMO_ZIELE[weg]`: `?weg=constructor` fände sonst
  // über den Prototyp eine Funktion und leitete auf deren Quelltext weiter.
  const weg = new URL(request.url).searchParams.get("weg") ?? "";
  const gewaehlt = alsMieter ? "/portal" : alsService ? "/service" : Object.hasOwn(DEMO_ZIELE, weg) ? DEMO_ZIELE[weg] : "/";
  const basis = gewaehlt === "/" ? "/?demo=1" : `${gewaehlt}?demo=1`;
  const ziel_url = resetStatus === "ok" ? basis : `${basis}&reset=${resetStatus}`;
  return NextResponse.redirect(new URL(ziel_url, ziel));
}
