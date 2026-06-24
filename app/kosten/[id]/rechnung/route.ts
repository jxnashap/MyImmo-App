import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const { data: k } = await supabase
    .from("kosten")
    .select("rechnung_name,rechnung_type,rechnung_data")
    .eq("id", params.id)
    .single();

  if (!k?.rechnung_data) return new NextResponse("Keine Rechnung hinterlegt", { status: 404 });

  // gespeichert als data-URL: "data:<mime>;base64,<data>"
  const raw = String(k.rechnung_data);
  const comma = raw.indexOf(",");
  const base64 = comma >= 0 ? raw.slice(comma + 1) : raw;
  const buf = Buffer.from(base64, "base64");

  const type = k.rechnung_type || "application/octet-stream";
  const name = (k.rechnung_name || "Rechnung").replace(/[^a-zA-Z0-9._-]+/g, "_");
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
