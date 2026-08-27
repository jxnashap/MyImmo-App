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
): Promise<{ ok: boolean; fehler?: string; bewerbungId?: string }> {
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
  const r = data as { ok?: boolean; error?: string; id?: string } | null;
  if (!r?.ok) return { ok: false, fehler: r?.error ?? "Dieser Link ist nicht mehr gültig." };
  // Die Bewerbungs-ID geht zurück an den Client, damit er direkt danach die
  // Dokumente anhängen kann. Die ID allein öffnet nichts: die Anhänge-RPC
  // verlangt zusätzlich das gültige Link-Token und ein Alter < 1 Stunde.
  return { ok: true, bewerbungId: r.id };
}

// Erlaubte Dokument-Typen (Whitelist — muss zur RPC passen).
const DATEI_TYPEN = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const DATEI_MAX_BYTES = 6 * 1024 * 1024; // 6 MB je Datei (RPC-Grenze: 8 MB Base64)

/**
 * Ein Dokument (Gehaltsabrechnung, SCHUFA, …) an eine soeben eingereichte
 * Bewerbung anhängen — öffentlicher Weg, je Datei ein Aufruf. Token-Prüfung,
 * 1-Stunden-Fenster und das 5-Dateien-Limit erzwingt die SECURITY-DEFINER-RPC.
 */
export async function haengeBewerbungDateiAn(
  token: string,
  bewerbungId: string,
  fd: FormData,
): Promise<{ ok: boolean; fehler?: string }> {
  // Eigenes, großzügigeres IP-Limit als beim Einreichen (siehe Zähler unten).
  const ip = (headers().get("x-forwarded-for") ?? "unbekannt").split(",")[0].trim();
  if (uploadRateLimited(ip)) {
    return { ok: false, fehler: "Zu viele Uploads — bitte in ein paar Minuten erneut versuchen." };
  }
  if (!/^[0-9a-f-]{36}$/i.test(token) || !/^[0-9a-f-]{36}$/i.test(bewerbungId)) {
    return { ok: false, fehler: "Ungültiger Link." };
  }

  const datei = fd.get("datei");
  // Dokument-Kategorie (Slot) — Whitelist wie in der RPC; unbekannte Werte
  // landen als "sonstiges".
  const slotRoh = String(fd.get("slot") ?? "").trim();
  const SLOTS = new Set(["gehalt","schufa","mietschuldenfrei","arbeitsvertrag","einkommen_selbst","buergschaft","einkommen_sonstig","wbs","sonstiges"]);
  const slot = SLOTS.has(slotRoh) ? slotRoh : "sonstiges";
  if (!(datei instanceof File) || datei.size === 0) return { ok: false, fehler: "Keine Datei gewählt." };
  if (!DATEI_TYPEN.has(datei.type)) return { ok: false, fehler: "Nur PDF-, JPG-, PNG- oder WebP-Dateien." };
  if (datei.size > DATEI_MAX_BYTES) return { ok: false, fehler: `„${datei.name}" ist größer als 6 MB.` };

  const puffer = Buffer.from(await datei.arrayBuffer());
  const dataUrl = `data:${datei.type};base64,${puffer.toString("base64")}`;
  // Gehaltsnachweise & Co. sind hochsensibel: App-Layer-Verschlüsselung wie
  // bei IBANs (AES-256-GCM, Schlüssel NUR als Vercel-Env — die DB sieht nur
  // Chiffretext). Ohne gesetzten DATA_ENCRYPTION_KEY (lokale Entwicklung)
  // fällt der Upload auf Klartext zurück; decrypt() liest später beides.
  let gespeichert = dataUrl;
  try {
    const { encrypt } = await import("@/lib/crypto/secure");
    gespeichert = encrypt(dataUrl);
  } catch {
    /* DATA_ENCRYPTION_KEY fehlt — Klartext-Fallback (Dev) */
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc("bewerbung_datei_anhaengen", {
    p_token: token,
    p_bewerbung: bewerbungId,
    p: { name: datei.name, typ: datei.type, groesse: datei.size, data: gespeichert, slot },
  });
  if (error) return { ok: false, fehler: "Upload fehlgeschlagen — bitte erneut versuchen." };
  const r = data as { ok?: boolean; error?: string } | null;
  if (!r?.ok) return { ok: false, fehler: r?.error ?? "Upload fehlgeschlagen." };
  return { ok: true };
}

// Getrennter Zähler für Datei-Uploads: max. 40 / 10 Min / IP
// (bis 12 Dateien je Bewerbung, 3 Bewerbungen je Fenster).
const uploadHits = new Map<string, number[]>();
function uploadRateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (uploadHits.get(ip) ?? []).filter((t) => now - t < FENSTER);
  if (arr.length >= 40) {
    uploadHits.set(ip, arr);
    return true;
  }
  arr.push(now);
  uploadHits.set(ip, arr);
  if (uploadHits.size > 1000) {
    for (const [k, v] of uploadHits) {
      const frisch = v.filter((t) => now - t < FENSTER);
      if (frisch.length === 0) uploadHits.delete(k);
      else uploadHits.set(k, frisch);
    }
  }
  return false;
}
