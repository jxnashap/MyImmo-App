"use server";

// Einladungscodes ("Schlüssel", Businessplan Kap. 14): Der Vermieter erzeugt
// je Mieter einen Code, mit dem sich der Mieter ein eigenes Konto anlegt und
// objektgenau mit seiner Wohnung verknüpft wird.
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { featureSperre } from "@/lib/planGate";

// Ohne verwechselbare Zeichen (0/O, 1/I/L).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function neuerCode(): string {
  const bytes = randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return `MI-${s.slice(0, 4)}-${s.slice(4)}`;
}

export async function erzeugeEinladungscode(mieterId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  // Tarif-Schranke. Ohne BILLING_ENFORCED kehrt featureSperre() sofort mit
  // null zurueck — ohne Datenbankabfrage, ohne Verhaltensaenderung.
  // Nur das ERZEUGEN ist geschraenkt: Bereits eingeloeste Zugaenge bleiben
  // gueltig, sonst wuerde ein Tarifwechsel Mieter aussperren, die nichts
  // dafuer koennen.
  const sperre = await featureSperre(supabase, "mieterportal");
  if (sperre) return { error: sperre };

  // Mieter muss dem angemeldeten Vermieter gehören.
  const { data: mieter } = await supabase
    .from("mieter")
    .select("id,prop_id,user_id")
    .eq("id", mieterId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!mieter) return { error: "Mieter nicht gefunden." };

  // Alte, noch nicht eingelöste Codes dieses Mieters ersetzen.
  await supabase
    .from("einladungscodes")
    .delete()
    .eq("mieter_id", mieterId)
    .eq("vermieter_id", user.id)
    .is("eingeloest_am", null);

  const code = neuerCode();
  const { data, error } = await supabase
    .from("einladungscodes")
    .insert({
      vermieter_id: user.id,
      code,
      rolle: "mieter",
      mieter_id: mieterId,
      prop_id: mieter.prop_id,
    })
    .select("code,gueltig_bis")
    .single();
  if (error) return { error: "Code konnte nicht erstellt werden." };

  revalidatePath(`/tenants/${mieterId}`);
  return { code: data.code as string, gueltigBis: data.gueltig_bis as string };
}

export async function widerrufeEinladung(mieterId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

  await supabase
    .from("einladungscodes")
    .delete()
    .eq("mieter_id", mieterId)
    .eq("vermieter_id", user.id)
    .is("eingeloest_am", null);
  revalidatePath(`/tenants/${mieterId}`);
  return { ok: true };
}
