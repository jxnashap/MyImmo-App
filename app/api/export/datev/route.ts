import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { baueDatevBuchungen, baueDatevExtf } from "@/lib/datev";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DATEV-Export (Buchungsstapel EXTF) eines Jahres — zur Übergabe an die
// Steuerkanzlei. Kontenzuordnung = SKR03-Standardvorlage (Kanzlei passt an).
export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });

  const url = new URL(request.url);
  const jahrParam = Number(url.searchParams.get("jahr"));
  const jahr = Number.isInteger(jahrParam) && jahrParam >= 2000 && jahrParam <= 2100
    ? jahrParam
    : new Date().getFullYear() - 1;

  const [{ data: einnahmen }, { data: kosten }, { data: props }] = await Promise.all([
    supabase.from("einnahmen").select("buchungsdatum,betrag,kategorie,beschreibung,prop_id"),
    supabase.from("kosten").select("buchungsdatum,betrag,kategorie,beschreibung,prop_id"),
    supabase.from("properties").select("id,bezeichnung"),
  ]);

  const nameOf = new Map(((props ?? []) as { id: string; bezeichnung: string }[]).map((p) => [p.id, p.bezeichnung]));
  const propName = (id: string | null) => (id ? nameOf.get(id) ?? "" : "");

  const buchungen = baueDatevBuchungen(jahr, (einnahmen ?? []) as any[], (kosten ?? []) as any[], propName);

  const now = new Date();
  const p2 = (n: number) => String(n).padStart(2, "0");
  const zeitstempel =
    `${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}` +
    `${p2(now.getHours())}${p2(now.getMinutes())}${p2(now.getSeconds())}000`;

  const extf = baueDatevExtf(buchungen, { jahr, zeitstempel, bezeichnung: `MyImmo ${jahr}` });

  return new NextResponse(extf, {
    headers: {
      // EXTF ist eine CSV; Windows-1252 wäre klassisch, wir liefern UTF-8 mit BOM.
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="EXTF_Buchungsstapel_MyImmo_${jahr}.csv"`,
    },
  });
}
