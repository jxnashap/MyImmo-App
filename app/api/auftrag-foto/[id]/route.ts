import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dateiKopf } from "@/lib/net/dateiKopf";

// Liefert ein Foto aus dem Verlauf eines Auftrags (05.10.2026). Zugriff regelt die RLS-Regel
// `auftrag_notizen_lesen`: nur der Vermieter und der Partner, dem der Auftrag gehört.
export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });

  const { data, error } = await supabase
    .from("auftrag_notizen")
    .select("datei_name,datei_type,datei_data")
    .eq("id", params.id)
    .maybeSingle();
  if (error || !data?.datei_data) return new NextResponse("Nicht gefunden", { status: 404 });

  const bytes = Buffer.from(data.datei_data, "base64");
  const download = new URL(request.url).searchParams.has("download");
  return new NextResponse(bytes, {
    headers: {
      ...dateiKopf(data.datei_type, data.datei_name ?? "foto", download),
      "Content-Length": String(bytes.length),
      "Cache-Control": "private, max-age=300",
    },
  });
}
