"use server";

// ÖFFENTLICHE Server-Action der Bewerbungs-Seite (kein Login): Selbstauskunft
// einreichen. Token-/Aktiv-Prüfung + Feldbegrenzung passieren in der
// SECURITY-DEFINER-RPC; hier zusätzlich ein IP-Rate-Limit als Spam-Bremse.
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// Best-effort-Limiter je Serverless-Instanz: max. 3 Bewerbungen / 10 Min / IP.
const hits = new Map<string, number[]>();
const FENSTER = 10 * 60 * 1000;
const MAX = 3;

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
    for (const [k, v] of hits) {
      const frisch = v.filter((t) => now - t < FENSTER);
      if (frisch.length === 0) hits.delete(k);
      else hits.set(k, frisch);
    }
  }
  return false;
}

export async function reicheBewerbungEin(
  token: string,
  fd: FormData,
): Promise<{ ok: boolean; fehler?: string }> {
  const ip = (headers().get("x-forwarded-for") ?? "unbekannt").split(",")[0].trim();
  if (rateLimited(ip)) {
    return { ok: false, fehler: "Zu viele Anfragen — bitte in ein paar Minuten erneut versuchen." };
  }
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { ok: false, fehler: "Ungültiger Link." };

  const name = String(fd.get("name") ?? "").trim();
  if (!name) return { ok: false, fehler: "Bitte den Namen angeben." };
  const unterschrift = String(fd.get("unterschrift") ?? "");
  if (unterschrift && !unterschrift.startsWith("data:image/png;base64,")) {
    return { ok: false, fehler: "Ungültige Unterschrift." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("bewerbung_einreichen", {
    p_token: token,
    p: {
      name,
      email: String(fd.get("email") ?? ""),
      telefon: String(fd.get("telefon") ?? ""),
      einzug_ab: String(fd.get("einzug_ab") ?? ""),
      personen: String(fd.get("personen") ?? ""),
      beruf: String(fd.get("beruf") ?? ""),
      arbeitgeber: String(fd.get("arbeitgeber") ?? ""),
      netto_einkommen: String(fd.get("netto_einkommen") ?? ""),
      raucher: String(fd.get("raucher") ?? ""),
      haustiere: String(fd.get("haustiere") ?? ""),
      schufa: String(fd.get("schufa") ?? ""),
      nachricht: String(fd.get("nachricht") ?? ""),
      unterschrift_data: unterschrift,
    },
  });
  if (error) return { ok: false, fehler: "Senden fehlgeschlagen — bitte später erneut versuchen." };
  const r = data as { ok?: boolean; error?: string } | null;
  if (!r?.ok) return { ok: false, fehler: r?.error ?? "Dieser Link ist nicht mehr gültig." };
  return { ok: true };
}
