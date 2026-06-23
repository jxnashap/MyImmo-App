import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "MyImmo — Immobilien-Management",
  description: "Portfolio, Mieter und Dokumente für Privatvermieter",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="de">
      <body>
        <header className="border-b border-white/10 px-6 py-4">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/" className="text-lg font-semibold text-gold">
                MyImmo
              </Link>
              {user && (
                <nav className="flex gap-4 text-sm text-white/70">
                  <Link href="/" className="hover:text-white">Portfolio</Link>
                  <Link href="/properties" className="hover:text-white">Objekte</Link>
                  <Link href="/tenants" className="hover:text-white">Mieter</Link>
                </nav>
              )}
            </div>
            {user && (
              <form action="/auth/signout" method="post">
                <button className="text-sm text-white/50 hover:text-white">Abmelden</button>
              </form>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
