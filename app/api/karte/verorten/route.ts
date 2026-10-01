import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { darfWeiter } from "@/lib/net/bremse";
import { geocodeAdresse, geoAenderung, koordinaten, sollVerorten } from "@/lib/geocode";

// Verortet EIN eigenes Objekt (01.10.2026). Die Portfolio-Karte ruft das aus
// dem Browser nacheinander auf, mit Pause dazwischen — die Seite rendert
// sofort, die Marker erscheinen nach und nach. Vorher wartete der Server vor
// dem ersten Byte auf bis zu drei Nominatim-Anfragen.
//
// Antwort: { art: "treffer", lat, lng } | { art: "leer" } | { art: "gedrosselt" }
//        | { art: "uebersprungen" } (schon verortet, keine Adresse, oder das
//          gemerkte Ergebnis verbietet eine neue Anfrage — siehe sollVerorten).
// Bei „gedrosselt" hört der Browser für diesen Aufruf auf.

export const dynamic = "force-dynamic";

const SPALTEN = "id,adresse,lat,lng,latitude,longitude,geo_status,geo_versucht_am";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  let id = "";
  try {
    id = String(((await req.json()) as { id?: unknown })?.id ?? "");
  } catch {
    /* leerer oder kaputter Rumpf → unten 400 */
  }
  if (!id) return NextResponse.json({ error: "Objekt fehlt." }, { status: 400 });

  const { data: p, error } = await supabase
    .from("properties")
    .select(SPALTEN)
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!p) return NextResponse.json({ error: "Objekt nicht gefunden." }, { status: 404 });

  const k = koordinaten(p);
  if (k) return NextResponse.json({ art: "treffer", ...k });
  if (!sollVerorten(p, Date.now())) return NextResponse.json({ art: "uebersprungen" });

  // Zwei Bremsen: je Konto (ein Nutzer mit vielen Objekten oder einer
  // Schleife im Browser) und gesamt — Nominatim zählt die App als Ganzes.
  if (!(await darfWeiter("karte_verorten", 40, 300, user.id)) || !(await darfWeiter("nominatim", 50, 60, "alle"))) {
    return NextResponse.json({ art: "gedrosselt" });
  }

  const erg = await geocodeAdresse(p.adresse as string);
  const { data: gespeichert, error: schreibFehler } = await supabase
    .from("properties")
    .update(geoAenderung(erg, new Date().toISOString()))
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  // Demo-Konto: Die Schreibsperre wirft — dann zeigen wir den Treffer trotzdem,
  // gemerkt wird er nicht (die Demo-Objekte haben ihre Koordinaten ohnehin).
  if (schreibFehler || !gespeichert) {
    return NextResponse.json(erg.art === "treffer" ? erg : { art: erg.art, nichtGespeichert: true });
  }
  return NextResponse.json(erg);
}
