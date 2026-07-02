import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { erzeugeBriefPdf } from "@/lib/pdf/erzeugen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const form = await req.formData();
  const doc = await erzeugeBriefPdf(supabase, user.id, params.id, {
    art: String(form.get("art") ?? "allgemein"),
    datum: String(form.get("datum") ?? ""),
    betrag: String(form.get("betrag") ?? ""),
    grund: String(form.get("grund") ?? ""),
    ibanId: String(form.get("ibanId") ?? ""),
    vName: String(form.get("vName") ?? "").trim(),
    vAdr: String(form.get("vAdr") ?? "").trim(),
    text: String(form.get("text") ?? ""),
  });
  if (!doc) return new NextResponse("Mieter nicht gefunden", { status: 404 });

  return new NextResponse(Buffer.from(doc.pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${doc.dateiname}"`,
      "Cache-Control": "no-store",
    },
  });
}
