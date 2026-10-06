import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dateiKopf } from "@/lib/net/dateiKopf";

// Datei aus dem Eingang (06.10.2026) — nur für den Eigentümer, solange sie nicht entschieden ist.
// Zugriff regelt zusätzlich die RLS-Regel `freigabe_eingang_lesen`; der Filter auf user_id steht
// trotzdem hier (RLS ist die zweite Linie, nicht die einzige).
export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) return new NextResponse("Nicht gefunden", { status: 404 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });

  const { data, error } = await supabase
    .from("freigabe_eingang")
    .select("datei_name,datei_type,datei_data")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data?.datei_data) return new NextResponse("Nicht gefunden", { status: 404 });

  const roh = String(data.datei_data);
  const bytes = Buffer.from(roh.slice(roh.indexOf(",") + 1), "base64");
  const download = new URL(request.url).searchParams.has("download");
  return new NextResponse(bytes, {
    headers: {
      ...dateiKopf(data.datei_type, data.datei_name ?? "dokument", download),
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, no-store",
    },
  });
}
