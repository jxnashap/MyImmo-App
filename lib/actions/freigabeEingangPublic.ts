"use server";

// ÖFFENTLICHE Action (kein Konto): Bank oder Makler schicken über ihren Link eine Datei zurück
// (06.10.2026). Nur nach dem Zugangscode — der Hash kommt aus dem httpOnly-Cookie der Anmeldung,
// nie aus dem Formular. Typ wird aus dem Dateikopf bestimmt, nicht aus Name oder Browser-Angabe.
// Die Datenbank prüft Link, Code, Typ, Größe und Mengen ein zweites Mal.

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { FREIGABE_COOKIE, FREIGABE_PFAD, type FreigabeArt } from "@/lib/freigabeCode";
import { EINGANG_MAX_BYTES, bereinigeDateiname, erkenneEingangTyp, hochladeMeldung } from "@/lib/freigabeEingang";

export async function schickeDateiZurueck(
  art: FreigabeArt,
  token: string,
  fd: FormData,
): Promise<{ ok: true } | { error: string }> {
  if (art !== "bank" && art !== "makler") return { error: "Ungültiger Link." };
  if (!/^[0-9a-f-]{36}$/i.test(String(token))) return { error: "Ungültiger Link." };

  const hash = (await cookies()).get(FREIGABE_COOKIE[art])?.value;
  if (!hash) return { error: "Bitte die Seite neu laden und den Zugangscode eingeben." };

  const f = fd.get("datei");
  if (!f || typeof f === "string" || (f as File).size === 0) return { error: "Bitte eine Datei wählen." };
  const file = f as File;
  if (file.size > EINGANG_MAX_BYTES) return { error: "Datei zu groß (höchstens 8 MB)." };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const typ = erkenneEingangTyp(bytes);
  if (!typ) return { error: "Nur PDF, JPG, PNG oder WebP." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("freigabe_public_hochladen", {
    p_art: art,
    p_token: token,
    p_code_hash: hash,
    p_absender: String(fd.get("absender") ?? "").trim().slice(0, 200),
    p_nachricht: String(fd.get("nachricht") ?? "").trim().slice(0, 2000),
    p_datei_name: bereinigeDateiname(file.name),
    p_datei_type: typ,
    p_datei_size: bytes.length,
    p_datei_data: `data:${typ};base64,${Buffer.from(bytes).toString("base64")}`,
  });
  if (error) return { error: "Senden fehlgeschlagen — bitte später erneut versuchen." };
  const meldung = hochladeMeldung(data as string | null);
  if (meldung) return { error: meldung };

  revalidatePath(FREIGABE_PFAD[art](token));
  return { ok: true };
}
