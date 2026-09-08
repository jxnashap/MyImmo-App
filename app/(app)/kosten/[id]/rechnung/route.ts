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

  const { data: k } = await supabase
    .from("kosten")
    .select("rechnung_name,rechnung_type,rechnung_path,rechnung_data")
    .eq("id", params.id)
    .single();

  // Neuer Weg: Beleg liegt im Storage → kurzlebige Signed-URL (60 s).
  if (k?.rechnung_path) {
    const dl = req.nextUrl.searchParams.get("download");
    const { data: signed } = await supabase.storage
      .from("belege")
      .createSignedUrl(k.rechnung_path, 60, dl ? { download: k.rechnung_name ?? true } : undefined);
    if (signed?.signedUrl) return NextResponse.redirect(signed.signedUrl);
  }

  // Fallback: alte Base64-Belege (rechnung_data) wie bisher ausliefern.
  if (!k?.rechnung_data) return new NextResponse("Kein Beleg hinterlegt", { status: 404 });

  // gespeichert als data-URL: "data:<mime>;base64,<data>"
  const raw = String(k.rechnung_data);
  const comma = raw.indexOf(",");
  const base64 = comma >= 0 ? raw.slice(comma + 1) : raw;
  const buf = Buffer.from(base64, "base64");


  return new NextResponse(buf, {
    status: 200,
    headers: {
      ...dateiKopf(k.rechnung_type, k.rechnung_name, req.nextUrl.searchParams.has("download")),
    },
  });
}
