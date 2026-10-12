import { heuteBerlin, zeitstempelBerlin } from "@/lib/zeitraum";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { istVermieterKonto } from "@/lib/rolle";
import { featureSperre } from "@/lib/planGate";
import { baueDatevBuchungen, baueDatevExtf } from "@/lib/datev";
import { alleZeilen, nurKonto, unvollstaendigAntwort } from "@/lib/db/auswertung";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DATEV-Export (Buchungsstapel EXTF) eines Jahres — zur Übergabe an die
// Steuerkanzlei. Kontenzuordnung = SKR03-Standardvorlage (Kanzlei passt an).
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });
  // NUR Vermieter-Konten. Die RLS-Policy `properties_select_zugang` gibt
  // einem MIETER die komplette Objektzeile seiner Wohnung — inklusive
  // Kaufpreis, Wert und Kaufdatum. Ohne diese Prüfung und ohne den expliziten
  // `user_id`-Filter unten bekäme ein Mieter hier die Zahlen seines Vermieters.
  // (In /api/export/alles war das bereits behoben; diese Route nicht.)
  if (!(await istVermieterKonto(supabase, user.id))) {
    return new NextResponse("Nur für Vermieter-Konten", { status: 403 });
  }
  // Tarif-Schranke. Im Early Access (ohne BILLING_ENFORCED) kehrt
  // featureSperre() sofort mit null zurueck — ohne Datenbankabfrage.
  const sperre = await featureSperre(supabase, "steuer");
  if (sperre) return new NextResponse(sperre, { status: 402 });

  const url = new URL(request.url);
  const jahrParam = Number(url.searchParams.get("jahr"));
  const jahr = Number.isInteger(jahrParam) && jahrParam >= 2000 && jahrParam <= 2100
    ? jahrParam
    : Number(heuteBerlin().slice(0, 4)) - 1;

  // B08 (11.10.2026): vollständig oder gar nicht — ein Buchungsstapel für die Kanzlei, dem still
  // Buchungen fehlen (ab 1.001 Zeilen oder bei einem Abfragefehler), ist schlimmer als keiner.
  type Zeile = { buchungsdatum: string; betrag: number; kategorie: string; beschreibung: string | null; prop_id: string | null };
  const eigen = nurKonto(user.id);
  let einnahmen: Zeile[], kosten: Zeile[], props: { id: string; bezeichnung: string }[];
  try {
    [einnahmen, kosten, props] = await Promise.all([
      alleZeilen<Zeile>(supabase, "einnahmen", "buchungsdatum,betrag,kategorie,beschreibung,prop_id", eigen),
      alleZeilen<Zeile>(supabase, "kosten", "buchungsdatum,betrag,kategorie,beschreibung,prop_id", eigen),
      alleZeilen<{ id: string; bezeichnung: string }>(supabase, "properties", "id,bezeichnung", eigen),
    ]);
  } catch (e) {
    return unvollstaendigAntwort(e);
  }

  const nameOf = new Map(props.map((p) => [p.id, p.bezeichnung]));
  const propName = (id: string | null) => (id ? nameOf.get(id) ?? "" : "");

  const buchungen = baueDatevBuchungen(jahr, einnahmen, kosten, propName);

  // Erstellungszeit im Kopf der EXTF-Datei in Berliner Ortszeit (Audit P8, C15) — vorher UTC.
  const zeitstempel = `${zeitstempelBerlin()}000`;

  const extf = baueDatevExtf(buchungen, { jahr, zeitstempel, bezeichnung: `MyImmo ${jahr}` });

  return new NextResponse(extf, {
    headers: {
      // EXTF ist eine CSV; Windows-1252 wäre klassisch, wir liefern UTF-8 mit BOM.
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="EXTF_Buchungsstapel_MyImmo_${jahr}.csv"`,
    },
  });
}
