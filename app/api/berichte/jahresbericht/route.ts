// Jahresbericht (Cashflow-Auswertung) als PDF im MyImmo-Briefstil.
// Query: ?jahr=2026 — dieselbe Rechnung wie die Jahresbericht-Seite (lib/jahresberichtZeile.ts).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { istVermieterKonto } from "@/lib/rolle";
import { featureSperre } from "@/lib/planGate";
import { buildJahresberichtPdf, type JahresberichtZeile } from "@/lib/pdf/berichtPdf";
import type { Property, Einnahme, Kosten, Kredit } from "@/lib/types";
import { KOSTEN_SPALTEN } from "@/lib/types";
import { jahresZeile } from "@/lib/jahresberichtZeile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  // NUR Vermieter-Konten. Die RLS-Policy `properties_select_zugang` gibt
  // einem MIETER die komplette Objektzeile seiner Wohnung — inklusive
  // Kaufpreis, Wert und Kaufdatum. Ohne diese Prüfung und ohne den expliziten
  // `user_id`-Filter unten bekäme ein Mieter hier die Zahlen seines Vermieters.
  // (In /api/export/alles war das bereits behoben; diese Route nicht.)
  if (!(await istVermieterKonto(supabase, user.id))) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  // Tarif-Schranke. Im Early Access (ohne BILLING_ENFORCED) kehrt
  // featureSperre() sofort mit null zurueck — ohne Datenbankabfrage.
  const sperre = await featureSperre(supabase, "steuer");
  if (sperre) return NextResponse.redirect(new URL("/einstellungen?tab=abo", req.url));

  const jahr = Number(req.nextUrl.searchParams.get("jahr")) || new Date().getFullYear();

  const [{ data: props }, { data: einn }, { data: kost }, { data: kred }, { data: profil }] =
    await Promise.all([
      supabase.from("properties").select("*").eq("user_id", user.id).order("bezeichnung"),
      supabase.from("einnahmen").select("*").eq("user_id", user.id),
      supabase.from("kosten").select(KOSTEN_SPALTEN).eq("user_id", user.id),
      supabase.from("kredite").select("*").eq("user_id", user.id),
      supabase.from("vermieter_profil").select("name,strasse,plz,ort,email").eq("user_id", user.id).limit(1).maybeSingle(),
    ]);

  const properties = (props ?? []) as Property[];
  const einnahmen = (einn ?? []) as Einnahme[];
  const kosten = (kost ?? []) as Kosten[];
  const kredite = (kred ?? []) as Kredit[];

  const heute = new Date();
  const monate = jahr < heute.getFullYear() ? 12 : jahr > heute.getFullYear() ? 12 : heute.getMonth() + 1;

  const zeilen: JahresberichtZeile[] = properties.map((p) => {
    const z = jahresZeile(p.id, jahr, monate, { einnahmen, kosten, kredite, kaufdatum: p.kaufdatum });
    return { name: p.bezeichnung, einnahmen: z.e, bewirtschaftung: z.k, zins: z.zins, tilgung: z.tilgung, cashflow: z.cashflow, zinsGeschaetzt: z.zinsGeschaetzt };
  });

  const pdf = await buildJahresberichtPdf(jahr, zeilen, {
    name: profil?.name || "MyImmo",
    adresse: [profil?.strasse, [profil?.plz, profil?.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null,
    email: profil?.email ?? null,
  });

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Jahresbericht_${jahr}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
