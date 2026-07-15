import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";
import AutoLogout from "@/components/AutoLogout";
import { ToastProvider } from "@/components/Toast";
import FlashToast from "@/components/FlashToast";
import { ZeitraumProvider } from "@/components/ZeitraumProvider";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRolle } from "@/lib/rolle";
import { istFreigeschaltet } from "@/lib/freischaltung";

export const metadata: Metadata = {
  metadataBase: new URL("https://my-immo-app.vercel.app"),
  title: "MyImmo — Immobilien-Management",
  description: "Portfolio, Mieter und Dokumente für Privatvermieter",
};

// Setzt das gespeicherte Theme vor dem ersten Paint (verhindert Flackern).
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

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
    const heim = rolle === "mieter" ? "/portal" : "/service";
    if (!pathname.startsWith(heim) && !istOeffentlicheSeite) redirect(heim);
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

  const { data: props } = await supabase
    .from("properties")
    .select("id,bezeichnung,typ")
    .order("bezeichnung");
  const { data: profil } = await supabase
    .from("vermieter_profil").select("name").limit(1).maybeSingle();

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
            <Sidebar properties={props ?? []} userEmail={user.email} profilName={profil?.name ?? null} />
            <AutoLogout />
            <div className="main-wrap">
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
