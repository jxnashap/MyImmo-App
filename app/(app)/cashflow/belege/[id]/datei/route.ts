import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Datei eines Belegs im Belegeingang ansehen (Ablauf B). Nur eigene Einträge; Auslieferung über einen
// kurzlebigen signierten Link (60 s) wie /kosten/<id>/rechnung. Der Typ wurde beim Hochladen aus dem
// Dateikopf bestimmt (PDF, JPEG, PNG, WebP) — nie aus dem Dateinamen.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const { data: e } = await supabase.from("beleg_eingang").select("datei_pfad,datei_name").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!e) return new NextResponse("Beleg nicht gefunden", { status: 404 });
  const { data: signed } = await supabase.storage.from("belege").createSignedUrl(e.datei_pfad, 60);
  if (!signed?.signedUrl) return new NextResponse("Beleg nicht lesbar", { status: 404 });
  return NextResponse.redirect(signed.signedUrl);
}
