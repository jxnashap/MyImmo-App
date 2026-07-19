import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { holeIndexReihe } from "@/lib/wert/hpi";
import { fortschreibeKaufpreis } from "@/lib/wert/fortschreibung";
import { protokolliereWert } from "@/lib/wert/protokoll";
import { geocode } from "@/lib/valuation/sources/geocode";
import { bodenrichtwertAbrufen } from "@/lib/valuation/sources/boris";

// Automatischer Portfolio-Wert-Refresh (alle ~2 Wochen per GitHub-Action-Cron).
// Pro Objekt:
//  1) GESCHÄTZTER Marktwert (marktwert_aktuell + Stand) über Häuserpreisindex-
//     Fortschreibung (Eurostat) + Verlaufspunkt (Wertentwicklungs-Chart).
//  2) Regionale Eingaben frisch halten (best-effort, nicht fatal):
//     - fehlende Koordinaten via Geocoding (Nominatim) nachtragen,
//     - Bodenrichtwert (BORIS) abrufen, wenn per ENV konfiguriert.
//     Diese fließen in die ImmoWertV-Bewertung auf der Objektseite ein.
// Der manuell gepflegte `wert` wird NIE überschrieben — vorschlagen statt still ändern.
//
// Schutz: Header `Authorization: Bearer <CRON_SECRET>` oder `?secret=`.
// Env (Vercel): CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY, optional OWNER_USER_ID.
// Für BORIS zusätzlich: VALUATION_BORIS_ENABLED=true + BORIS_ENDPOINT_URL.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Nominatim erlaubt ~1 Anfrage/Sek. → Pause zwischen Geocodes. Pro Lauf gedeckelt,
// damit die Route im Zeitbudget bleibt; der Rest kommt beim nächsten Lauf dran.
const GEOCODE_PAUSE_MS = 1100;
const GEOCODE_PRO_LAUF = 8;

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
    .select("id,user_id,kaufpreis,kaufdatum,marktwert_aktuell,adresse,latitude,longitude,bodenrichtwert");
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
  let geokodiert = 0;
  let bodenrichtwerte = 0;
  let geoBudget = GEOCODE_PRO_LAUF;

  for (const p of (props ?? []) as {
    id: string; user_id: string; kaufpreis: number | null; kaufdatum: string | null;
    marktwert_aktuell: number | null; adresse: string | null;
    latitude: number | null; longitude: number | null; bodenrichtwert: number | null;
  }[]) {
    // --- 1) Index-Fortschreibung → geschätzter Marktwert ---
    const f = fortschreibeKaufpreis(p.kaufpreis, p.kaufdatum ?? null, hpi.reihe);
    if (f) {
      const wert = Math.round(f.wert);
      if (Math.round(p.marktwert_aktuell ?? 0) !== wert) {
        await supabase
          .from("properties")
          .update({ marktwert_aktuell: wert, marktwert_stand: heute })
          .eq("id", p.id);
        await protokolliereWert(
          supabase as never,
          p.user_id,
          p.id,
          wert,
          "index-auto",
          "HPI-Fortschreibung (Auto-Refresh)",
        );
        aktualisiert++;
      } else {
        unveraendert++;
      }
    } else {
      uebersprungen++; // kein Kaufpreis/Kaufdatum oder Kauf im letzten Quartal
    }

    // --- 2) Regionale Eingaben best-effort frisch halten (nicht fatal) ---
    let lat = p.latitude;
    let lng = p.longitude;
    try {
      if ((lat == null || lng == null) && p.adresse && geoBudget > 0) {
        geoBudget--;
        const g = await geocode(p.adresse);
        if (g) {
          lat = g.lat;
          lng = g.lng;
          await supabase.from("properties").update({ latitude: lat, longitude: lng }).eq("id", p.id);
          geokodiert++;
        }
        await sleep(GEOCODE_PAUSE_MS); // Nominatim-Policy respektieren
      }
      if (lat != null && lng != null) {
        const brw = await bodenrichtwertAbrufen(lat, lng);
        if (brw && Math.round(brw.wert) !== Math.round(p.bodenrichtwert ?? 0)) {
          await supabase
            .from("properties")
            .update({ bodenrichtwert: brw.wert, bodenrichtwert_stichtag: brw.stichtag })
            .eq("id", p.id);
          bodenrichtwerte++;
        }
      }
    } catch {
      /* best-effort: Fehler beim Geocoding/BORIS ignorieren, Objekt-Wert steht schon */
    }
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
    geokodiert,
    bodenrichtwerte,
    borisAktiv: process.env.VALUATION_BORIS_ENABLED === "true" && !!process.env.BORIS_ENDPOINT_URL,
  });
}
