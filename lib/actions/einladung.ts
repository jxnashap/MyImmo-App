"use server";

// Einladungscodes ("Schlüssel", Businessplan Kap. 14): Der Vermieter erzeugt
// je Mieter einen Code, mit dem sich der Mieter ein eigenes Konto anlegt und
// objektgenau mit seiner Wohnung verknüpft wird.
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Ohne verwechselbare Zeichen (0/O, 1/I/L).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function neuerCode(): string {
  const bytes = randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return `MI-${s.slice(0, 4)}-${s.slice(4)}`;
}

export async function erzeugeEinladungscode(mieterId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };

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
  const supabase = createClient();
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
