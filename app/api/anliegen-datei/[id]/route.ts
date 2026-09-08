import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dateiKopf } from "@/lib/net/dateiKopf";

// Liefert einen Anliegen-Anhang aus. Zugriff regelt die RLS-Policy
// (nur Mieter-Konto des Anliegens + Vermieter).
export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });

  const { data } = await supabase
    .from("anliegen_dateien")
    .select("name,mime,daten")
    .eq("id", params.id)
    .maybeSingle();
  if (!data) return new NextResponse("Nicht gefunden", { status: 404 });

  const bytes = Buffer.from(data.daten, "base64");
  const download = new URL(request.url).searchParams.has("download");
  return new NextResponse(bytes, {
    headers: {
      ...dateiKopf(data.mime, data.name, download),
      "Content-Length": String(bytes.length),
    },
  });
}
