import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";
import { ladeNeuigkeiten } from "@/lib/neuigkeiten";
import AutoLogout from "@/components/AutoLogout";
import OnboardingTour from "@/components/OnboardingTour";
import { ToastProvider } from "@/components/Toast";
import FlashToast from "@/components/FlashToast";
import { ZeitraumProvider } from "@/components/ZeitraumProvider";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRolle } from "@/lib/rolle";
import { istFreigeschaltet } from "@/lib/freischaltung";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.myimmoapp.de"),
  title: "MyImmo — Immobilien-Management",
  description: "Portfolio, Mieter und Dokumente für Privatvermieter",
};

// Mobile: Seite immer auf Gerätebreite, kein seitliches Rausragen/Rauszoomen.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

// Setzt das gespeicherte Theme + den Sidebar-Rail-Zustand vor dem ersten Paint
// (verhindert Flackern) — selbes Muster für beide Einstellungen.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}if(localStorage.getItem('rail')==='1'){document.documentElement.setAttribute('data-rail','1');}}catch(e){}})();`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // CSP-Nonce aus der Middleware (für das Inline-Theme-Script).
  const nonce = headers().get("x-nonce") ?? undefined;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // ohne Sidebar (Login/Willkommen)
    return (
      <html lang="de" suppressHydrationWarning>
        <head>
          <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
        </head>
        <body>{children}</body>
      </html>
    );
  }

  // Rollen-Weiche (Businessplan Kap. 14): Mieter-Konten arbeiten im
  // Mieterportal (eigene, schlanke Shell) — nicht in der Vermieter-App.
  const pathname = headers().get("x-pathname") ?? "";
  const rolle = await getRolle(supabase, user.id);
  const istOeffentlicheSeite = ["/impressum", "/datenschutz", "/agb", "/avv", "/bewerben", "/beleihung", "/auftrag"].some(
    (p) => pathname.startsWith(p)
  );

  // Freischaltungs-Gate: neu registrierte Konten (auch via Google) müssen
  // Zugangscode + Consent bestätigen, bevor die App nutzbar ist. Ohne
  // Freischaltung nur /willkommen (und öffentliche Seiten) erreichbar.
  if (!istOeffentlicheSeite && !pathname.startsWith("/willkommen")) {
    if (!(await istFreigeschaltet(supabase, user.id))) redirect("/willkommen");
  }
  // Willkommens-Gate ohne App-Shell rendern (keine Navigation vor Freischaltung).
  if (pathname.startsWith("/willkommen")) {
    return (
      <html lang="de" suppressHydrationWarning>
        <head>
          <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
        </head>
        <body>{children}</body>
      </html>
    );
  }
  if (rolle === "mieter" || rolle === "service") {
    // Mieter → /portal, Service → /service: jeweils eigene schlanke Shell.
    // `/konto` ist zusätzlich erlaubt — dort liegen Passwort, Datenexport und
    // Kontolöschung. Ohne diese Ausnahme hätten Mieter- und Service-Konten
    // keinerlei Einstellungen und könnten ihre DSGVO-Rechte nicht ausüben.
    const heim = rolle === "mieter" ? "/portal" : "/service";
    const erlaubt = pathname.startsWith(heim) || pathname.startsWith("/konto") || istOeffentlicheSeite;
    if (!erlaubt) redirect(heim);
    return (
      <html lang="de" suppressHydrationWarning>
        <head>
          <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
        </head>
        <body>
          <ToastProvider>{children}</ToastProvider>
        </body>
      </html>
    );
  }
  // Vermieter & Hausverwaltung nutzen die volle App — Portal-Shells sind tabu.
  if (pathname.startsWith("/portal") || pathname.startsWith("/service")) redirect("/");

  // Öffentliche Seiten (Bewerbung, Bank-Freigabe, Auftrag, Rechtstexte) IMMER
  // ohne App-Hülle ausliefern — auch wenn gerade jemand angemeldet ist. Sonst
  // sieht der eingeloggte Vermieter beim Prüfen seines Bewerbungs-Links die
  // eigene Sidebar statt der Seite, die der Bewerber bekommt.
  if (istOeffentlicheSeite) {
    return (
      <html lang="de" suppressHydrationWarning>
        <head>
          <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
        </head>
        <body>{children}</body>
      </html>
    );
  }

  const { data: props } = await supabase
    .from("properties")
    .select("id,bezeichnung,typ")
    .order("bezeichnung");
  // Mieter für die Befehlspalette: „NK Müller" / „Mieterhöhung Müller" führt
  // direkt zur passenden Dokument-Seite dieses Mieters.
  const { data: mieter } = await supabase
    .from("mieter")
    .select("id,vorname,nachname")
    .order("nachname");
  const tenants = (mieter ?? []).map((m) => ({
    id: m.id as string,
    name: [m.vorname, m.nachname].filter(Boolean).join(" ").trim() || "Mieter",
  }));
  const { data: profil } = await supabase
    .from("vermieter_profil").select("name").limit(1).maybeSingle();
  // Zähler für die Navigation (offene Anliegen/Bewerbungen, unbestätigte Mieteingänge)
  const neu = await ladeNeuigkeiten();

  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ToastProvider>
          <Suspense fallback={null}>
            <FlashToast />
          </Suspense>
          <div className="app">
            <Sidebar properties={props ?? []} tenants={tenants} userEmail={user.email} profilName={profil?.name ?? null} badges={{ "/anliegen": neu.mieterportal, "/cashflow": neu.cashflow }} />
            <AutoLogout />
            <OnboardingTour neuerNutzer={(props ?? []).length === 0} />
            <div className="main-wrap">
              {/* Demo-Hinweis: Ohne ihn haelt ein Besucher seine Eingaben fuer
                  echt und ist ueberrascht, wenn sie beim naechsten Start weg
                  sind. Der Vergleich mit der festen Adresse genuegt — das
                  Demo-Konto ist ein einzelnes, festes Konto. */}
              {user.email === "demo.vermieter@myimmo.test" && (
                <div
                  role="status"
                  style={{
                    background: "var(--blue-dim)",
                    color: "var(--blue)",
                    padding: "8px 16px",
                    fontSize: 13,
                    textAlign: "center",
                  }}
                >
                  <strong>Demo-Modus.</strong> Du siehst Beispieldaten und kannst
                  alles ausprobieren. Änderungen werden beim nächsten Start der
                  Demo zurückgesetzt.
                </div>
              )}
              <main className="main">
                <ZeitraumProvider>{children}</ZeitraumProvider>
              </main>
            </div>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
