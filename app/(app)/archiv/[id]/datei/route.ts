import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dateiKopf } from "@/lib/net/dateiKopf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const { data: n } = await supabase
    .from("notizen")
    .select("datei_name,datei_type,datei_data")
    .eq("id", params.id)
    .single();

  if (!n?.datei_data) return new NextResponse("Keine Datei hinterlegt", { status: 404 });

  const raw = String(n.datei_data);
  const comma = raw.indexOf(",");
  const base64 = comma >= 0 ? raw.slice(comma + 1) : raw;
  const buf = Buffer.from(base64, "base64");


  return new NextResponse(buf, {
    status: 200,
    headers: {
      ...dateiKopf(n.datei_type, n.datei_name, req.nextUrl.searchParams.has("download")),
    },
  });
}
