import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { featureSperre } from "@/lib/planGate";
import { erzeugeBriefPdf } from "@/lib/pdf/erzeugen";
import { istAbgelehnt } from "@/lib/briefPruefung";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const feld = (form: FormData, k: string): string | undefined => {
  const v = form.get(k);
  return v == null ? undefined : String(v);
};

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  // Tarif-Schranke. Ohne BILLING_ENFORCED kehrt featureSperre() sofort
  // mit null zurueck — ohne Datenbankabfrage, ohne Verhaltensaenderung.
  // ACHTUNG beim Scharfschalten: Diese Route ist die EINZIGE Ausnahme des
  // Demo-Kontos (data-demo-erlaubt im DocGenerator). Das Demo-Konto haette
  // mit aktivem Billing den Tarif "Kostenlos" — die Ausnahme waere damit
  // tot. Vor BILLING_ENFORCED=true entweder dem Demo-Konto ein Abo in der
  // Tabelle `abos` hinterlegen oder hier auf istDemoKonto pruefen.
  const sperre = await featureSperre(supabase, "dokumente");
  if (sperre) return new NextResponse(sperre, { status: 402 });

  const form = await req.formData();
  const doc = await erzeugeBriefPdf(supabase, user.id, params.id, {
    art: String(form.get("art") ?? "allgemein"),
    datum: String(form.get("datum") ?? ""),
    betrag: String(form.get("betrag") ?? ""),
    grund: String(form.get("grund") ?? ""),
    ibanId: String(form.get("ibanId") ?? ""),
    vName: String(form.get("vName") ?? "").trim(),
    vAdr: String(form.get("vAdr") ?? "").trim(),
    text: String(form.get("text") ?? ""),
    signieren: String(form.get("signieren") ?? ""),
    zugang: String(form.get("zugang") ?? ""),
    // P4: Zusatzfelder. Fehlt ein Feld ganz (alter Browser-Stand), rechnet briefZusatzWerte
    // mit dem Vertrag (Personen = Vertragspartner, Einzug = Mietbeginn).
    monat: feld(form, "monat"),
    personen: feld(form, "personen"),
    einzug: feld(form, "einzug"),
    eigentuemerAnderer: feld(form, "eigentuemerAnderer"),
    eigentuemer: feld(form, "eigentuemer"),
  });
  if (!doc) return new NextResponse("Mieter nicht gefunden", { status: 404 });
  // Gesamtprüfung P3: Die Oberfläche sperrt den Knopf schon; das hier ist die Schranke.
  if (istAbgelehnt(doc)) {
    return new NextResponse(doc.abgelehnt.join("\n"), { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  return new NextResponse(Buffer.from(doc.pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${doc.dateiname}"`,
      "Cache-Control": "no-store",
    },
  });
}
