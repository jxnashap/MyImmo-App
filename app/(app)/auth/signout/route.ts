import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  // Nur DIESE Sitzung (Audit P5, B52): ohne Scope nimmt die Bibliothek „global“ — ein Klick auf
  // „Abmelden“ im geteilten Demo-Konto beendete die Sitzungen aller Besucher.
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
