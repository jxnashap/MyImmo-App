// Anlage-V-Aufstellung als PDF im MyImmo-Briefstil.
// Query: ?jahr=2025&anteil=80&satz= (leer = automatisch je Baujahr)
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AFA_DEFAULT, berechneAnlageV } from "@/lib/anlageV";
import { buildAnlageVPdf } from "@/lib/pdf/berichtPdf";
import type { Property, Einnahme, Kosten, Kredit } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const q = req.nextUrl.searchParams;
  const jahr = Number(q.get("jahr")) || new Date().getFullYear() - 1;
  const anteil = q.get("anteil") !== null && q.get("anteil") !== ""
    ? Number(q.get("anteil")) || 0
    : AFA_DEFAULT.gebaeudeAnteil;
  const satzRaw = q.get("satz");
  const satz = satzRaw === null || satzRaw.trim() === "" ? null : Number(satzRaw) || 0;

  const [{ data: props }, { data: einn }, { data: kost }, { data: kred }, { data: profil }] =
    await Promise.all([
      supabase.from("properties").select("*").order("bezeichnung"),
      supabase.from("einnahmen").select("*"),
      supabase.from("kosten").select("*"),
      supabase.from("kredite").select("*"),
      supabase.from("vermieter_profil").select("name,strasse,plz,ort,email").eq("user_id", user.id).limit(1).maybeSingle(),
    ]);

  const erg = berechneAnlageV(
    jahr,
    (props ?? []) as Property[],
    (einn ?? []) as Einnahme[],
    (kost ?? []) as Kosten[],
    (kred ?? []) as Kredit[],
    { gebaeudeAnteil: anteil, satz },
  );

  const pdf = await buildAnlageVPdf(erg, {
    name: profil?.name || "MyImmo",
    adresse: [profil?.strasse, [profil?.plz, profil?.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null,
    email: profil?.email ?? null,
  });

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Anlage-V_${jahr}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
