import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dateiKopf } from "@/lib/net/dateiKopf";

// Scan der Vollmacht eines Vertreters (02.10.2026) — nur der eigene, nur mit Login.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const { data: v, error } = await supabase
    .from("vertreter")
    .select("datei_name,datei_type,datei_data")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return new NextResponse("Datei konnte nicht geladen werden", { status: 500 });
  if (!v?.datei_data) return new NextResponse("Keine Datei hinterlegt", { status: 404 });

  const raw = String(v.datei_data);
  const komma = raw.indexOf(",");
  const buf = Buffer.from(komma >= 0 ? raw.slice(komma + 1) : raw, "base64");
  return new NextResponse(buf, {
    status: 200,
    headers: { ...dateiKopf(v.datei_type, v.datei_name, req.nextUrl.searchParams.has("download")) },
  });
}
