import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Geplanter Job für die Immobilienbewertung (täglich via vercel.json).
// PHASE 1 = Gerüst: erreichbar + abgesichert, führt aber noch keine Schreibvorgänge
// aus. Echte Neuberechnung/Fortschreibung aktiviert sich, sobald (a) mindestens eine
// Datenquelle per Feature-Flag aktiv ist UND (b) ein SUPABASE_SERVICE_ROLE_KEY
// hinterlegt ist (nötig, um über alle Nutzer hinweg RLS-konform zu aktualisieren).
//
// Change-Detection-Logik (Stichtag/Version/Hash je Quelle), Umkreis-Comparables und
// Index-Fortschreibung docken hier an, sobald die Quellen live sind.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  // Vercel Cron sendet automatisch "Authorization: Bearer <CRON_SECRET>", wenn gesetzt.
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const quellenAktiv = {
    boris: process.env.VALUATION_BORIS_ENABLED === "true",
    is24: process.env.VALUATION_IS24_ENABLED === "true",
    avm: process.env.VALUATION_AVM_ENABLED === "true",
    serviceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
  const aktivierbar = quellenAktiv.serviceRole && (quellenAktiv.boris || quellenAktiv.is24 || quellenAktiv.avm);

  return NextResponse.json({
    ok: true,
    aktiv: aktivierbar,
    hinweis: aktivierbar
      ? "Bereit — Neuberechnung/Fortschreibung würde hier laufen."
      : "Gerüst erreichbar. Automatik aktiviert sich mit Datenquelle(n) + SUPABASE_SERVICE_ROLE_KEY.",
    quellenAktiv,
    stand: new Date().toISOString(),
  });
}
