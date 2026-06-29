import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildDocPdf } from "@/lib/pdf/docPdf";
import { decryptIbanRow } from "@/lib/ibanData";
import {
  TITEL,
  ART_ZEIGT_BETRAG,
  fuelleVorlage,
  vorlageFuer,
  type DocArt,
} from "@/lib/dokumentVorlagen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const eur = (n: number) =>
  new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) +
  " €";
const deDate = (s: string) =>
  s ? new Date(s).toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }) : "";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const form = await req.formData();
  const art = (String(form.get("art") ?? "allgemein") as DocArt) || "allgemein";
  const datum = String(form.get("datum") ?? "");
  const betragRaw = String(form.get("betrag") ?? "");
  const grund = String(form.get("grund") ?? "").trim();
  const ibanId = String(form.get("ibanId") ?? "");
  const vName = String(form.get("vName") ?? "").trim();
  const vAdr = String(form.get("vAdr") ?? "").trim();
  const vorlageText = String(form.get("text") ?? "");

  const { data: tenant } = await supabase
    .from("mieter")
    .select("vorname,nachname,mieter_adresse,einheit,prop_id,kaltmiete")
    .eq("id", params.id)
    .single();
  if (!tenant) return new NextResponse("Mieter nicht gefunden", { status: 404 });

  const [{ data: property }, { data: profil }, { data: iban }] = await Promise.all([
    tenant.prop_id
      ? supabase.from("properties").select("bezeichnung,adresse").eq("id", tenant.prop_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("vermieter_profil")
      .select("name,strasse,plz,ort,email")
      .eq("user_id", user.id)
      .maybeSingle(),
    ibanId
      ? supabase.from("ibans").select("kontoname,inhaber,iban").eq("id", ibanId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const mieterName = `${tenant.vorname ?? ""} ${tenant.nachname ?? ""}`.trim();
  const objekt = property
    ? `${property.bezeichnung}${tenant.einheit ? ", " + tenant.einheit : ""}${property.adresse ? ", " + property.adresse : ""}`
    : "–";

  const kaltmiete = tenant.kaltmiete ?? 0;
  const betragNum = parseFloat(betragRaw) || 0;
  const fallbackMiete = art === "zahlungserinnerung" || art === "mahnung";
  const effBetrag = betragNum > 0 ? betragNum : fallbackMiete ? kaltmiete : 0;

  const werte: Record<string, string> = {
    mieter: mieterName || "–",
    objekt,
    betrag: effBetrag > 0 ? eur(effBetrag) : "",
    miete: kaltmiete > 0 ? eur(kaltmiete) : "",
    datum: deDate(datum),
    grund,
  };

  const quelle = vorlageText.trim() ? vorlageText : vorlageFuer(art);
  const absaetze = fuelleVorlage(quelle, werte);

  const ibanData = iban ? decryptIbanRow(iban) : null;
  const zeigtBetrag = ART_ZEIGT_BETRAG.includes(art);
  const konto = zeigtBetrag && ibanData?.iban ? ibanData : null;

  const absenderOrt = [profil?.plz, profil?.ort].filter(Boolean).join(" ") || null;

  const pdf = await buildDocPdf({
    titel: TITEL[art] ?? "Schreiben",
    absender: {
      name: vName || profil?.name || "MyImmo",
      adresse: vAdr || [profil?.strasse, absenderOrt].filter(Boolean).join(", ") || null,
      email: profil?.email ?? null,
      ort: profil?.ort ?? null,
    },
    empfaengerName: mieterName || "–",
    empfaengerAdresse: tenant.mieter_adresse || objekt,
    objekt,
    absaetze,
    konto,
  });

  const safeName = (mieterName || "Mieter").replace(/[^a-zA-Z0-9]+/g, "_");
  const filename = `${art}_${safeName}.pdf`;

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
