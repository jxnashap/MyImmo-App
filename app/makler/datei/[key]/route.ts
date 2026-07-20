// Liefert die im Makler-Ordner hinterlegte Datei eines Checklisten-Items aus
// (inline oder Download). Zugriff nur für den Eigentümer (RLS, user-scoped).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto/secure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { key: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const { data: d } = await supabase
    .from("makler_dokumente")
    .select("datei_name,datei_type,datei_data")
    .eq("user_id", user.id)
    .eq("item_key", params.key)
    .maybeSingle();

  if (!d?.datei_data) return new NextResponse("Keine Datei hinterlegt", { status: 404 });

  // decrypt() ist tolerant: verschlüsselte Blobs werden entschlüsselt,
  // unverschlüsselte Klartext-Altzeilen unverändert zurückgegeben.
  const raw = decrypt(String(d.datei_data));
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
    },
  });
}
