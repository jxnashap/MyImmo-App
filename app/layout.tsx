import type { Metadata } from "next";
import "./globals.css";
import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";
import AutoLogout from "@/components/AutoLogout";
import { ToastProvider } from "@/components/Toast";
import FlashToast from "@/components/FlashToast";
import { ZeitraumProvider } from "@/components/ZeitraumProvider";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
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
