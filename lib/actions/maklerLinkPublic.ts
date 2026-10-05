"use server";

// Anmeldung des MAKLERS auf /makler-link/<token> (05.10.2026, öffentlich, ohne Konto).
// Der Code wird hier gehasht und von der Datenbank verglichen (`makler_public_anmelden`, zählt
// Fehlversuche, sperrt nach 10). Bei Erfolg trägt ein httpOnly-Cookie den Hash — nur für den
// Pfad DIESES Links, damit ein zweiter Link einen eigenen Code verlangt.
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { MAKLER_COOKIE, maklerCodeHash } from "@/lib/maklerCode";
import { FREIGABE_PFAD } from "@/lib/freigabeCode";
import { istMaklerCodeFormat, normalisiereMaklerCode } from "@/lib/makler";

export async function meldeMaklerAn(token: string, code: string): Promise<{ ok: true } | { error: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(String(token))) return { error: "Ungültiger Link." };
  const norm = normalisiereMaklerCode(String(code ?? ""));
  if (!istMaklerCodeFormat(norm)) return { error: "Der Code hat 8 Zeichen, z. B. ABCD-EF23." };

  const hash = maklerCodeHash(token, norm);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("makler_public_anmelden", { p_token: token, p_code_hash: hash });
  if (error) return { error: "Anmeldung gerade nicht möglich. Bitte später erneut versuchen." };
  if (data === "gesperrt") return { error: "Zu viele falsche Versuche. Bitte bei der Kaufinteressentin oder dem Kaufinteressenten einen neuen Link anfordern." };
  if (data !== "ok") return { error: data === "falsch" ? "Der Code stimmt nicht." : "Link abgelaufen oder ungültig." };

  (await cookies()).set(MAKLER_COOKIE, hash, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: FREIGABE_PFAD.makler(token),
    maxAge: 31 * 24 * 3600, // Ablauf des Links prüft ohnehin die Datenbank
  });
  return { ok: true };
}
