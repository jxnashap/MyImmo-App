import { heuteBerlin } from "@/lib/zeitraum";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pruefeFrischeAnmeldung } from "@/lib/auth/frisch";
import { baueVollexport, type ExportDb, type ExportRolle } from "@/lib/export/vollexport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Voll-Datenexport: alle eigenen Daten als ZIP — Tabellen als CSV + JSON, Dateien, manifest.json.
// Deine Daten gehören dir — jederzeit raus. Aufbau, Vollständigkeit und Manifest: lib/export/vollexport.ts
// (B05, 11.10.2026). Je Rolle eine eigene Tabellenliste mit ausdrücklicher Besitz-Spalte: Ein Mieter
// bekam früher über die damalige Policy die ganze Objektzeile (Kaufpreis) seines Vermieters mit.

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Nicht angemeldet", { status: 401 });
  // Frische Anmeldung (08.09.2026, Feedback Befund 6): Der Export liefert
  // IBANs und Dokumente ENTSCHLÜSSELT — eine offene Sitzung im Café genügte.
  // Die Oberfläche fragt vorher Passwort/2FA ab (useReAuth); wer die URL
  // direkt aufruft, bekommt hier die Hürde.
  const frisch = await pruefeFrischeAnmeldung(supabase);
  if (!frisch.ok) {
    return new NextResponse(
      "Bitte bestätige zuerst deine Anmeldung: Einstellungen → Daten & Recht → 'Alle Daten' — dort wird das Passwort bzw. der 2FA-Code abgefragt.",
      { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } },
    );
  }

  const { data: rolleRow, error: rolleFehler } = await supabase
    .from("nutzer_rollen")
    .select("rolle")
    .eq("user_id", user.id)
    .maybeSingle();
  // Ohne bekannte Rolle kein Export — sonst liefe er als Vermieter-Export mit der falschen Liste.
  if (rolleFehler) {
    return new NextResponse("Der Export ist gerade nicht möglich — bitte gleich erneut versuchen.", {
      status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  const rolleRoh = rolleRow?.rolle ?? "vermieter";
  const rolle: ExportRolle = rolleRoh === "mieter" ? "mieter" : rolleRoh === "service" ? "service" : "vermieter";

  const { zip, manifest, dateiname } = await baueVollexport(supabase as unknown as ExportDb, user.id, rolle, heuteBerlin());
  return new NextResponse(Buffer.from(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${dateiname}"`,
      "Cache-Control": "no-store",
      // Für Werkzeuge und Tests: Ist der Export vollständig? Einzelheiten in manifest.json im ZIP.
      "X-Export-Vollstaendig": manifest.vollstaendig ? "ja" : "nein",
    },
  });
}
