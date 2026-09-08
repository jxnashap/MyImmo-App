// Öffentliche Datei-Auslieferung für Bank-Freigaben: ausschließlich über die
// SECURITY-DEFINER-RPC (prüft Token + aktiv + Ablauf + item_key ∈ item_keys).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dateiKopf } from "@/lib/net/dateiKopf";
import { decrypt } from "@/lib/crypto/secure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ token: string; key: string }> }
) {
  const params = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(params.token)) {
    return new NextResponse("Ungültiger Link", { status: 404 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("beleihung_public_datei", {
    p_token: params.token,
    p_item_key: params.key,
  });
  const d = Array.isArray(data) ? data[0] : data;
  if (error || !d?.datei_data) {
    return new NextResponse("Link abgelaufen oder Dokument nicht freigegeben", { status: 404 });
  }

  // Node-Runtime mit Schlüssel → tolerant entschlüsseln (Klartext-Altzeilen bleiben).
  const raw = decrypt(String(d.datei_data));
  const comma = raw.indexOf(",");
  const buf = Buffer.from(comma >= 0 ? raw.slice(comma + 1) : raw, "base64");

  return new NextResponse(buf, {
    status: 200,
    headers: {
      ...dateiKopf(d.datei_type, d.datei_name, req.nextUrl.searchParams.has("download")),
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
