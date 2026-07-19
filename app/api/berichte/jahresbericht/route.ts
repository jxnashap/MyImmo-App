// Jahresbericht (Cashflow-Auswertung) als PDF im MyImmo-Briefstil.
// Query: ?jahr=2026 — Berechnung identisch zur Jahresbericht-Seite.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildJahresberichtPdf, type JahresberichtZeile } from "@/lib/pdf/berichtPdf";
import type { Property, Einnahme, Kosten, Kredit } from "@/lib/types";
import { KOSTEN_SPALTEN } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const jahr = Number(req.nextUrl.searchParams.get("jahr")) || new Date().getFullYear();

  const [{ data: props }, { data: einn }, { data: kost }, { data: kred }, { data: profil }] =
    await Promise.all([
      supabase.from("properties").select("*").order("bezeichnung"),
      supabase.from("einnahmen").select("*"),
      supabase.from("kosten").select(KOSTEN_SPALTEN),
      supabase.from("kredite").select("*"),
      supabase.from("vermieter_profil").select("name,strasse,plz,ort,email").eq("user_id", user.id).limit(1).maybeSingle(),
    ]);

  const properties = (props ?? []) as Property[];
  const einnahmen = (einn ?? []) as Einnahme[];
  const kosten = (kost ?? []) as Kosten[];
  const kredite = (kred ?? []) as Kredit[];

  const inYear = (d: string | null) => !!d && d.startsWith(String(jahr));
  const heute = new Date();
  const monate = jahr < heute.getFullYear() ? 12 : jahr > heute.getFullYear() ? 12 : heute.getMonth() + 1;

  const zeilen: JahresberichtZeile[] = properties.map((p) => {
    const e = einnahmen.filter((x) => x.prop_id === p.id && inYear(x.buchungsdatum)).reduce((s, x) => s + (x.betrag ?? 0), 0);
    const k = kosten.filter((x) => x.prop_id === p.id && inYear(x.buchungsdatum)).reduce((s, x) => s + (x.betrag ?? 0), 0);
    const propKredite = kredite.filter((x) => x.prop_id === p.id);
    const zins = propKredite.reduce((s, kr) => s + (((kr.restschuld ?? 0) * (kr.zinssatz ?? 0)) / 100 / 12) * monate, 0);
    const rate = propKredite.reduce((s, kr) => s + (kr.monatsrate ?? 0) * monate, 0);
    const tilgung = Math.max(0, rate - zins);
    return { name: p.bezeichnung, einnahmen: e, bewirtschaftung: k, zins, tilgung, cashflow: e - k - rate };
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
