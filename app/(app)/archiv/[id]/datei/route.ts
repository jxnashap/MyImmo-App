import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dateiKopf } from "@/lib/net/dateiKopf";
import { istDemoKonto } from "@/lib/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const { data: n } = await supabase
    .from("notizen")
    .select("datei_name,datei_type,datei_data")
    .eq("id", params.id)
    .single();

  if (!n?.datei_data) return new NextResponse("Keine Datei hinterlegt", { status: 404 });

  // Abrufnachweis (02.10.2026): Öffnet ein Mieter ein ihm zugestelltes Dokument, hält
  // die Datenbank den ERSTEN Abruf fest — nur seine eigene Zustellung, nur einmal. Beim
  // Vermieter trifft der Aufruf keine Zeile. Scheitert er, bekommt der Mieter die Datei
  // trotzdem: Der Nachweis darf den Zugang nicht verhindern. In der Demo nicht (dort
  // wird nichts gespeichert; der Schreibschutz-Trigger würde werfen).
  if (!istDemoKonto(user.email)) {
    const { error: abrufFehler } = await supabase.rpc("zustellung_abgerufen", { p_notiz: params.id });
    if (abrufFehler) console.error("zustellung_abgerufen:", abrufFehler.message);
  }

  const raw = String(n.datei_data);
  const comma = raw.indexOf(",");
  const base64 = comma >= 0 ? raw.slice(comma + 1) : raw;
  const buf = Buffer.from(base64, "base64");


  return new NextResponse(buf, {
    status: 200,
    headers: {
      ...dateiKopf(n.datei_type, n.datei_name, req.nextUrl.searchParams.has("download")),
    },
  });
}
