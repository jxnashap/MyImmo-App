import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
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

  const type = n.datei_type || "application/octet-stream";
  const name = (n.datei_name || "Dokument").replace(/[^a-zA-Z0-9._-]+/g, "_");
  const disposition = req.nextUrl.searchParams.get("download") ? "attachment" : "inline";

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Content-Disposition": `${disposition}; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
