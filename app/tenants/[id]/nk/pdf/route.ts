import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { erzeugeNkPdf } from "@/lib/pdf/erzeugen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const jahr = Number(req.nextUrl.searchParams.get("jahr")) || new Date().getFullYear() - 1;

  const doc = await erzeugeNkPdf(supabase, params.id, jahr);
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
