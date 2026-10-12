// Jahresbericht (Cashflow-Auswertung) als PDF im MyImmo-Briefstil.
// Query: ?jahr=2026 — dieselbe Rechnung wie die Jahresbericht-Seite (lib/jahresberichtZeile.ts).
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { istVermieterKonto } from "@/lib/rolle";
import { featureSperre } from "@/lib/planGate";
import { buildJahresberichtPdf, type JahresberichtZeile } from "@/lib/pdf/berichtPdf";
import type { Property, Einnahme, Kosten, Kredit } from "@/lib/types";
import { KOSTEN_SPALTEN } from "@/lib/types";
import { jahresZeile, berichtMonate, unterjaehrigText } from "@/lib/jahresberichtZeile";
import { heuteBerlin } from "@/lib/zeitraum";
import { alleZeilen, nurKonto, unvollstaendigAntwort } from "@/lib/db/auswertung";

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

  // Stichtag in Europe/Berlin (Audit P8, C15) — wie die Seite.
  const heuteIso = heuteBerlin();
  const jahr = Number(req.nextUrl.searchParams.get("jahr")) || Number(heuteIso.slice(0, 4));

  // B08 (11.10.2026): vollständig oder gar nicht — kein PDF aus einem Teilbestand.
  const eigen = nurKonto(user.id);
  let properties: Property[], einnahmen: Einnahme[], kosten: Kosten[], kredite: Kredit[];
  try {
    [properties, einnahmen, kosten, kredite] = await Promise.all([
      alleZeilen<Property>(supabase, "properties", "*", eigen, [{ spalte: "bezeichnung" }]),
      alleZeilen<Einnahme>(supabase, "einnahmen", "*", eigen),
      alleZeilen<Kosten>(supabase, "kosten", KOSTEN_SPALTEN, eigen),
      alleZeilen<Kredit>(supabase, "kredite", "*", eigen),
    ]);
  } catch (e) {
    return unvollstaendigAntwort(e);
  }
  const { data: profil } = await supabase
    .from("vermieter_profil").select("name,strasse,plz,ort,email").eq("user_id", user.id).limit(1).maybeSingle();

  const monate = berichtMonate(jahr, heuteIso);

  const zeilen: JahresberichtZeile[] = properties.map((p) => {
    const z = jahresZeile(p.id, jahr, monate, { einnahmen, kosten, kredite, kaufdatum: p.kaufdatum });
    return { name: p.bezeichnung, einnahmen: z.e, bewirtschaftung: z.k, zins: z.zins, tilgung: z.tilgung, cashflow: z.cashflow, zinsGeschaetzt: z.zinsGeschaetzt };
  });

  const pdf = await buildJahresberichtPdf(jahr, zeilen, {
    name: profil?.name || "MyImmo",
    adresse: [profil?.strasse, [profil?.plz, profil?.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null,
    email: profil?.email ?? null,
  }, { zeitraum: unterjaehrigText(jahr, monate) });

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Jahresbericht_${jahr}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
