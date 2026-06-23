import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
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

  if (!user) {
    return (
      <html lang="de">
        <body>{children}</body>
      </html>
    );
  }

  return (
    <html lang="de">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 px-8 py-8">
            <div className="mx-auto max-w-5xl">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
