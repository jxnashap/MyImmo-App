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

  // Ohne Datei eine lesbare Seite statt Klartext „Keine Datei hinterlegt“ (Audit P5, B56). Die
  // Oberfläche zeigt ohne Datei keine Knöpfe mehr; das hier fängt alte Links und Lesezeichen.
  if (!n?.datei_data) return keineDatei();

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

/** Kleine HTML-Seite für „keine Datei“ — ohne Inline-Stil/Skript (CSP), Status bleibt 404.
 *  Nicht exportiert: Route-Dateien dürfen nur HTTP-Methoden und Segment-Konfiguration exportieren. */
function keineDatei(): NextResponse {
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Keine Datei – MyImmo</title><meta name="robots" content="noindex"></head><body><main><h1>Keine Datei hinterlegt</h1><p>Zu diesem Eintrag gehört kein Dokument zum Ansehen oder Herunterladen — er besteht nur aus Text.</p><p><a href="/">Zurück zur Übersicht</a></p></main></body></html>`;
  return new NextResponse(html, { status: 404, headers: { "Content-Type": "text/html; charset=utf-8", "X-Content-Type-Options": "nosniff" } });
}
