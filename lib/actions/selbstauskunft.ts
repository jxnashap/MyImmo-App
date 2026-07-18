"use server";

import { createClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/crypto/secure";
import {
  normalisiereSelbstauskunft,
  type SelbstauskunftDaten,
} from "@/lib/kauf/selbstauskunft";

export type SelbstauskunftResult = { ok: boolean; error?: string };

// Lädt die (verschlüsselte) Selbstauskunft des angemeldeten Nutzers und gibt
// sie entschlüsselt zurück. null, wenn noch nichts gespeichert ist.
export async function ladeSelbstauskunft(): Promise<SelbstauskunftDaten | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("selbstauskunft")
    .select("daten_enc")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data?.daten_enc) return null;

  try {
    const json = decrypt(data.daten_enc);
    return normalisiereSelbstauskunft(JSON.parse(json));
  } catch {
    // Schlüssel fehlt oder Blob defekt → wie "noch nichts" behandeln.
    return null;
  }
}

// Verschlüsselt und speichert (Upsert je Nutzer) die Selbstauskunft.
export async function speichereSelbstauskunft(daten: SelbstauskunftDaten): Promise<SelbstauskunftResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht angemeldet." };

  let enc: string;
  try {
    enc = encrypt(JSON.stringify(normalisiereSelbstauskunft(daten)));
  } catch {
    return { ok: false, error: "Verschlüsselung ist nicht konfiguriert (DATA_ENCRYPTION_KEY fehlt)." };
  }

  const { error } = await supabase
    .from("selbstauskunft")
    .upsert(
      { user_id: user.id, daten_enc: enc, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) return { ok: false, error: "Speichern fehlgeschlagen. Bitte erneut versuchen." };
  return { ok: true };
}
