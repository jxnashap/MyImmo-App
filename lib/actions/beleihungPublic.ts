"use server";

// ÖFFENTLICHE Server-Action der Bank-Seite (kein Login): Rückmeldung zu
// einer Freigabe absenden. Sicherheit: Token-/Ablauf-/Aktiv-Prüfung + Mengen-
// begrenzung passieren in der SECURITY-DEFINER-RPC (DB); zusätzlich hier ein
// einfaches IP-Rate-Limit als Spam-Bremse auf Prozess-Ebene.

import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { FREIGABE_COOKIE, FREIGABE_PFAD, freigabeCodeHash } from "@/lib/freigabeCode";
import { istMaklerCodeFormat, normalisiereMaklerCode } from "@/lib/makler";

// Best-effort-Limiter je Serverless-Instanz: max. 5 Rückmeldungen / 10 Min / IP.
const hits = new Map<string, number[]>();
const FENSTER = 10 * 60 * 1000;
const MAX = 5;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < FENSTER);
  if (arr.length >= MAX) {
    hits.set(ip, arr);
    return true;
  }
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 1000) {
    // Nur abgelaufene Einträge entfernen — clear() würde aktive Limits zurücksetzen.
    for (const [k, v] of hits) {
      const frisch = v.filter((t) => now - t < FENSTER);
      if (frisch.length === 0) hits.delete(k);
      else hits.set(k, frisch);
    }
  }
  return false;
}

export async function sendeBankRueckmeldung(
  token: string,
  fd: FormData,
): Promise<{ ok: boolean; fehler?: string }> {
  const ip = ((await headers()).get("x-forwarded-for") ?? "unbekannt").split(",")[0].trim();
  if (rateLimited(ip)) {
    return { ok: false, fehler: "Zu viele Anfragen — bitte in ein paar Minuten erneut versuchen." };
  }
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { ok: false, fehler: "Ungültiger Link." };

  const nachricht = String(fd.get("nachricht") ?? "").trim();
  const name = String(fd.get("name") ?? "").trim();
  if (!name || !nachricht) return { ok: false, fehler: "Bitte Name und Nachricht ausfüllen." };

  const fehlend = String(fd.get("fehlend") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30);

  // Seit 05.10.2026 nur nach dem Zugangscode: Der Hash kommt aus dem Cookie der Anmeldung.
  const hash = (await cookies()).get(FREIGABE_COOKIE.bank)?.value;
  if (!hash) return { ok: false, fehler: "Bitte die Seite neu laden und den Zugangscode eingeben." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("beleihung_public_rueckmeldung", {
    p_code_hash: hash,
    p_token: token,
    p_name: name,
    p_bank: String(fd.get("bank") ?? "").trim(),
    p_kontakt: String(fd.get("kontakt") ?? "").trim(),
    p_nachricht: nachricht,
    p_fehlend: fehlend,
  });
  if (error) return { ok: false, fehler: "Senden fehlgeschlagen — bitte später erneut versuchen." };
  if (data !== true) return { ok: false, fehler: "Dieser Link ist abgelaufen oder wurde widerrufen." };
  return { ok: true };
}

// Anmeldung der BANK auf /beleihung/<token> (05.10.2026): Code hashen, die Datenbank vergleicht
// und zählt Fehlversuche (`beleihung_public_anmelden`, Sperre nach 10). Bei Erfolg httpOnly-Cookie
// mit dem Hash, nur für den Pfad dieses Links.
export async function meldeBankAn(token: string, code: string): Promise<{ ok: true } | { error: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(String(token))) return { error: "Ungültiger Link." };
  const norm = normalisiereMaklerCode(String(code ?? ""));
  if (!istMaklerCodeFormat(norm)) return { error: "Der Code hat 8 Zeichen, z. B. ABCD-EF23." };

  const hash = freigabeCodeHash("bank", token, norm);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("beleihung_public_anmelden", { p_token: token, p_code_hash: hash });
  if (error) return { error: "Anmeldung gerade nicht möglich. Bitte später erneut versuchen." };
  if (data === "gesperrt") return { error: "Zu viele falsche Versuche. Bitte beim Eigentümer einen neuen Link anfordern." };
  if (data !== "ok") return { error: data === "falsch" ? "Der Code stimmt nicht." : "Link abgelaufen oder ungültig." };

  (await cookies()).set(FREIGABE_COOKIE.bank, hash, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: FREIGABE_PFAD.bank(token),
    maxAge: 31 * 24 * 3600,
  });
  return { ok: true };
}
