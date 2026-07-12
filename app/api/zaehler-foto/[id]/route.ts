import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Foto einer Zählerstand-Meldung (RLS: nur Mieter-Konto + Vermieter).
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });

  const { data } = await supabase
    .from("zaehlerstand_meldungen")
    .select("foto_name,foto_type,foto_data")
    .eq("id", params.id)
    .maybeSingle();
  if (!data?.foto_data) return new NextResponse("Kein Foto", { status: 404 });

  const bytes = Buffer.from(data.foto_data, "base64");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": data.foto_type || "image/jpeg",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="${encodeURIComponent(data.foto_name || "zaehler.jpg")}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
