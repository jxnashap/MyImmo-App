import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Liefert einen Anliegen-Anhang aus. Zugriff regelt die RLS-Policy
// (nur Mieter-Konto des Anliegens + Vermieter).
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
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
      "Content-Type": data.mime,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${encodeURIComponent(data.name)}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
