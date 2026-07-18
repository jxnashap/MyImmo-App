import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt, blindIndex, isEncrypted, decrypt } from "@/lib/crypto/secure";
import { normalizeIban } from "@/lib/iban";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Einmalige, idempotente Migration: verschlüsselt bestehende Klartext-IBANs des
// eingeloggten Nutzers und befüllt den Blind-Index. Nach einmaligem Aufruf
// (nachdem DATA_ENCRYPTION_KEY in Vercel gesetzt ist) sind alle Altzeilen
// verschlüsselt; weitere Aufrufe sind no-ops. RLS stellt sicher, dass nur die
// eigenen Zeilen verarbeitet werden.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const { data: rows, error } = await supabase
    .from("ibans")
    .select("id, iban, inhaber, iban_bidx");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let migriert = 0;
  for (const r of rows ?? []) {
    const schonFertig = isEncrypted(r.iban) && !!r.iban_bidx;
    if (schonFertig) continue;

    // decrypt() lässt Klartext unverändert durch → liefert hier die Klar-IBAN.
    const klarIban = normalizeIban(decrypt(r.iban ?? ""));
    const update = {
      iban: isEncrypted(r.iban) ? r.iban : encrypt(klarIban),
      iban_bidx: blindIndex(klarIban),
      inhaber:
        r.inhaber == null || isEncrypted(r.inhaber)
          ? r.inhaber
          : encrypt(r.inhaber),
    };
    const { error: upErr } = await supabase
      .from("ibans")
      .update(update)
      .eq("id", r.id);
    if (upErr) return NextResponse.json({ error: upErr.message, migriert }, { status: 500 });
    migriert++;
  }

  // Darlehensnummern (kredite.darlnr) — Klartext-Altzeilen verschlüsseln.
  const { data: kredite } = await supabase.from("kredite").select("id, darlnr");
  let kreditMigriert = 0;
  for (const k of kredite ?? []) {
    if (!k.darlnr || isEncrypted(k.darlnr)) continue;
    const { error: upErr } = await supabase
      .from("kredite")
      .update({ darlnr: encrypt(k.darlnr) })
      .eq("id", k.id);
    if (upErr) return NextResponse.json({ error: upErr.message, migriert, kreditMigriert }, { status: 500 });
    kreditMigriert++;
  }

  // Kautions-Bank (mieter.kaution_bank) — Altbestand ebenfalls verschlüsseln.
  const { data: mieter } = await supabase.from("mieter").select("id, kaution_bank");
  let kautionMigriert = 0;
  for (const m of mieter ?? []) {
    if (!m.kaution_bank || isEncrypted(m.kaution_bank)) continue;
    const { error: upErr } = await supabase
      .from("mieter")
      .update({ kaution_bank: encrypt(m.kaution_bank) })
      .eq("id", m.id);
    if (upErr) return NextResponse.json({ error: upErr.message, migriert, kreditMigriert, kautionMigriert }, { status: 500 });
    kautionMigriert++;
  }

  return NextResponse.json({ ok: true, migriert, kreditMigriert, kautionMigriert, gesamt: rows?.length ?? 0 });
}
