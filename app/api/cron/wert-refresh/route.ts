import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { holeIndexReihe } from "@/lib/wert/hpi";
import { fortschreibeKaufpreis } from "@/lib/wert/fortschreibung";
import { protokolliereWert } from "@/lib/wert/protokoll";

// Automatischer Portfolio-Wert-Refresh (alle ~2 Wochen per GitHub-Action-Cron).
// Aktualisiert je Objekt den GESCHÄTZTEN Marktwert (marktwert_aktuell + Stand)
// über die amtliche Häuserpreisindex-Fortschreibung und schreibt einen Verlaufs-
// punkt (Wertentwicklungs-Chart füllt sich von allein). Der manuell gepflegte
// `wert` wird NICHT überschrieben — vorschlagen statt still ändern (der Nutzer
// übernimmt per Klick auf der Objektseite).
//
// Schutz: Header `Authorization: Bearer <CRON_SECRET>` oder `?secret=`.
// Nötige Env (Vercel): CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY,
// optional OWNER_USER_ID (nur dieses Konto = MVP „dein Portfolio"; ohne = alle).

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  return handle(req);
}
export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET nicht gesetzt" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.replace(/^Bearer\s+/i, "").trim();
  const fromQuery = new URL(req.url).searchParams.get("secret") ?? "";
  if (bearer !== secret && fromQuery !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY nicht gesetzt" }, { status: 503 });
  }

  const owner = process.env.OWNER_USER_ID?.trim() || null;
  let query = supabase
    .from("properties")
    .select("id,user_id,kaufpreis,kaufdatum,marktwert_aktuell");
  if (owner) query = query.eq("user_id", owner);
  const { data: props, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const hpi = await holeIndexReihe();
  const heute = new Date().toISOString().slice(0, 10);
  let aktualisiert = 0;
  let unveraendert = 0;
  let uebersprungen = 0;

  for (const p of (props ?? []) as {
    id: string; user_id: string; kaufpreis: number | null; kaufdatum: string | null; marktwert_aktuell: number | null;
  }[]) {
    const f = fortschreibeKaufpreis(p.kaufpreis, p.kaufdatum ?? null, hpi.reihe);
    if (!f) {
      uebersprungen++; // kein Kaufpreis/Kaufdatum oder Kauf im letzten Quartal
      continue;
    }
    const wert = Math.round(f.wert);
    if (Math.round(p.marktwert_aktuell ?? 0) === wert) {
      unveraendert++;
      continue;
    }
    await supabase
      .from("properties")
      .update({ marktwert_aktuell: wert, marktwert_stand: heute })
      .eq("id", p.id);
    // Verlaufspunkt (dedupt intern gegen den letzten Stand).
    await protokolliereWert(
      supabase as never,
      p.user_id,
      p.id,
      wert,
      "index-auto",
      "HPI-Fortschreibung (Auto-Refresh)",
    );
    aktualisiert++;
  }

  return NextResponse.json({
    ok: true,
    stand: heute,
    indexLive: hpi.live,
    scope: owner ? "owner" : "alle",
    gesamt: (props ?? []).length,
    aktualisiert,
    unveraendert,
    uebersprungen,
  });
}
