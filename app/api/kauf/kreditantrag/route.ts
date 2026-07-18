// Kreditantrag / Selbstauskunft als PDF. Die persönlichen Finanzdaten kommen
// verschlüsselt aus der DB (serverseitig entschlüsselt); Objekt + Darlehens-
// wunsch schickt der Client aus dem localStorage mit.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ladeSelbstauskunft } from "@/lib/actions/selbstauskunft";
import {
  buildKreditantragPdf, type KreditObjekt, type KreditWunsch, type KreditAbsender,
} from "@/lib/pdf/kreditantragPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });

  const sa = await ladeSelbstauskunft();
  if (!sa) {
    return NextResponse.json(
      { error: "Bitte zuerst die Selbstauskunft ausfüllen und speichern." },
      { status: 400 },
    );
  }

  const { data: profil } = await supabase
    .from("vermieter_profil")
    .select("name,strasse,plz,ort,email")
    .limit(1)
    .maybeSingle();
  const absender: KreditAbsender = {
    name: profil?.name || "MyImmo",
    adresse: [profil?.strasse, [profil?.plz, profil?.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null,
    email: profil?.email ?? null,
  };

  let body: { auswahl?: Partial<KreditObjekt> | null; darlehen?: Partial<KreditWunsch> | null } = {};
  try { body = await req.json(); } catch { /* leerer Body erlaubt */ }

  const objekt: KreditObjekt | null = body.auswahl && (body.auswahl.kaufpreis || body.auswahl.darlehen)
    ? {
        name: body.auswahl.name ?? "",
        adresse: body.auswahl.adresse ?? "",
        kaufpreis: Number(body.auswahl.kaufpreis) || 0,
        gesamtInvest: Number(body.auswahl.gesamtInvest) || 0,
        eigenkapital: Number(body.auswahl.eigenkapital) || 0,
        darlehen: Number(body.auswahl.darlehen) || 0,
        kaltmiete: Number(body.auswahl.kaltmiete) || 0,
      }
    : null;

  const wunsch: KreditWunsch | null = body.darlehen && body.darlehen.darlehen
    ? {
        darlehen: Number(body.darlehen.darlehen) || 0,
        zinsbindung: Number(body.darlehen.zinsbindung) || 0,
        anfangstilgung: Number(body.darlehen.anfangstilgung) || 0,
        sollzins: Number(body.darlehen.sollzins) || 0,
        monatsrate: Number(body.darlehen.monatsrate) || 0,
        sondertilgung: !!body.darlehen.sondertilgung,
        prioritaet: String(body.darlehen.prioritaet ?? ""),
      }
    : null;

  const pdf = await buildKreditantragPdf(absender, sa, objekt, wunsch);
  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Selbstauskunft_Finanzierungsanfrage.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
