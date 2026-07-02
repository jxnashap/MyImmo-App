import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { erzeugeProtokollPdf, type ProtokollFields } from "@/lib/pdf/erzeugen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const form = await req.formData();
  let raeume: ProtokollFields["raeume"] = [];
  try {
    const parsed = JSON.parse(String(form.get("raeume") ?? "[]"));
    if (Array.isArray(parsed)) {
      raeume = parsed
        .filter((r) => r && typeof r.name === "string")
        .map((r) => ({
          name: String(r.name ?? ""),
          zustand: String(r.zustand ?? ""),
          notiz: String(r.notiz ?? ""),
        }));
    }
  } catch {
    /* leere Liste, wenn JSON kaputt */
  }

  const doc = await erzeugeProtokollPdf(supabase, user.id, params.id, {
    typ: String(form.get("typ") ?? "einzug"),
    datum: String(form.get("datum") ?? ""),
    strom: String(form.get("strom") ?? "").trim(),
    gas: String(form.get("gas") ?? "").trim(),
    wasser: String(form.get("wasser") ?? "").trim(),
    schluessel: String(form.get("schluessel") ?? "").trim(),
    raeume,
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
