// Öffentliche Datei-Auslieferung für Makler-Links (05.10.2026): ausschließlich über die
// SECURITY-DEFINER-Funktion `makler_public_datei` (prüft Token + aktiv + Ablauf + item_key ∈
// item_keys + Code-Hash aus dem Cookie und schreibt den Abruf ins Protokoll).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dateiKopf } from "@/lib/net/dateiKopf";
import { decrypt } from "@/lib/crypto/secure";
import { MAKLER_COOKIE } from "@/lib/maklerCode";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ token: string; key: string }> }
) {
  const params = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(params.token) || !/^[a-z_]{1,40}$/.test(params.key)) {
    return new NextResponse("Ungültiger Link", { status: 404 });
  }
  const hash = req.cookies.get(MAKLER_COOKIE)?.value;
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) {
    return new NextResponse("Bitte zuerst den Zugangscode eingeben", { status: 403 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("makler_public_datei", {
    p_token: params.token,
    p_item_key: params.key,
    p_code_hash: hash,
  });
  const d = Array.isArray(data) ? data[0] : data;
  if (error || !d?.datei_data) {
    return new NextResponse("Link abgelaufen oder Dokument nicht freigegeben", { status: 404 });
  }

  // decrypt() ist tolerant: verschlüsselte Blobs werden entschlüsselt, Klartext-Altzeilen bleiben.
  const raw = decrypt(String(d.datei_data));
  const comma = raw.indexOf(",");
  const buf = Buffer.from(comma >= 0 ? raw.slice(comma + 1) : raw, "base64");

  return new NextResponse(buf, {
    status: 200,
    headers: {
      ...dateiKopf(d.datei_type, d.datei_name, req.nextUrl.searchParams.has("download")),
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "private, no-store",
    },
  });
}
