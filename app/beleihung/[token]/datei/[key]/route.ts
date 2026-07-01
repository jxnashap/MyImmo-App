// Öffentliche Datei-Auslieferung für Bank-Freigaben: ausschließlich über die
// SECURITY-DEFINER-RPC (prüft Token + aktiv + Ablauf + item_key ∈ item_keys).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string; key: string } },
) {
  if (!/^[0-9a-f-]{36}$/i.test(params.token)) {
    return new NextResponse("Ungültiger Link", { status: 404 });
  }
  const supabase = createClient();
  const { data, error } = await supabase.rpc("beleihung_public_datei", {
    p_token: params.token,
    p_item_key: params.key,
  });
  const d = Array.isArray(data) ? data[0] : data;
  if (error || !d?.datei_data) {
    return new NextResponse("Link abgelaufen oder Dokument nicht freigegeben", { status: 404 });
  }

  const raw = String(d.datei_data);
  const comma = raw.indexOf(",");
  const buf = Buffer.from(comma >= 0 ? raw.slice(comma + 1) : raw, "base64");
  const name = (d.datei_name || "Dokument").replace(/[^a-zA-Z0-9._-]+/g, "_");
  const disposition = req.nextUrl.searchParams.get("download") ? "attachment" : "inline";

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": d.datei_type || "application/octet-stream",
      "Content-Disposition": `${disposition}; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
