// Kreditantrag / Selbstauskunft als PDF. Die persönlichen Finanzdaten kommen
// verschlüsselt aus der DB (serverseitig entschlüsselt); Objekt + Darlehens-
// wunsch schickt der Client aus dem localStorage mit.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ladeSelbstauskunft } from "@/lib/actions/selbstauskunft";
import { eigenkapitalGesamt } from "@/lib/kauf/selbstauskunft";
import {
  buildKreditantragPdf, type KreditWunsch, type KreditAbsender,
} from "@/lib/pdf/kreditantragPdf";
import { baueKreditObjekt, type AuswahlEingang } from "@/lib/kauf/kreditantrag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Die Seite wird per Formular in einem NEUEN TAB geöffnet — dort kann kein
// Toast erscheinen. Fehler deshalb als lesbare Mini-Seite ausliefern statt als
// JSON, das der Nutzer sonst als rohen Text vorgesetzt bekäme.
function hinweisSeite(text: string, status: number) {
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<title>Kreditantrag — MyImmo</title><meta name="viewport" content="width=device-width,initial-scale=1">
</head><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#f5f5f5;font-family:system-ui,sans-serif;color:#0a0a0a">
<div style="max-width:420px;padding:32px;background:#fff;border:1px solid #e5e5e5;border-radius:18px;text-align:center">
<div style="font-family:Georgia,serif;font-size:22px;color:#9a7b24;margin-bottom:12px">My<em>Immo</em></div>
<p style="font-size:15px;line-height:1.6;margin:0 0 18px">${text}</p>
<button onclick="window.close()" style="font:600 13px system-ui;padding:9px 18px;border:1px solid #d4d4d4;border-radius:999px;background:#fff;cursor:pointer">Fenster schließen</button>
</div></body></html>`;
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return hinweisSeite("Bitte melde dich an, um den Kreditantrag zu erzeugen.", 401);

  const sa = await ladeSelbstauskunft();
  if (!sa) {
    return hinweisSeite(
      "Bitte zuerst die Selbstauskunft im Kauf-Assistenten ausfüllen und speichern.",
      400,
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

  // Der Knopf schickt ein echtes Formular (CSP-konform, siehe
  // KreditantragButton) — die Daten stecken im Feld „daten" als JSON.
  // JSON-Bodies bleiben zusätzlich erlaubt (Direktaufrufe/Tests).
  let body: { auswahl?: AuswahlEingang | null; darlehen?: Partial<KreditWunsch> | null } = {};
  const typ = req.headers.get("content-type") ?? "";
  try {
    if (typ.includes("form")) {
      const form = await req.formData();
      const roh = form.get("daten");
      if (typeof roh === "string" && roh) body = JSON.parse(roh);
    } else {
      body = await req.json();
    }
  } catch { /* leerer/ungültiger Body erlaubt — PDF entsteht dann ohne Objektteil */ }

  // Eigenkapital aus der Selbstauskunft, Darlehen aus dem Wunsch (D) bzw.
  // Gesamtinvest − EK — die Objekt-Auswahl (A) trägt selbst kein Darlehen mehr.
  const ek = eigenkapitalGesamt(sa);
  const wunschDarlehen = Number(body.darlehen?.darlehen) || 0;
  const objekt = baueKreditObjekt(body.auswahl, ek, wunschDarlehen);

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
