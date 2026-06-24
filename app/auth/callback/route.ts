import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// OAuth-/PKCE-Callback: tauscht den von Supabase zurückgegebenen Code
// gegen eine Session (setzt die Auth-Cookies) und leitet weiter.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Kein Code oder Fehler -> zurück zum Login mit Hinweis
  return NextResponse.redirect(`${origin}/login?fehler=google`);
}
